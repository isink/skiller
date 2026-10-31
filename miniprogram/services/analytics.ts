import { REQUEST_TIMEOUT_MS, SUPABASE_ANON_KEY, SUPABASE_URL } from "./config";

/** Must match the check constraint on public.mp_events (migrations 024 and 025). */
export const MP_EVENT_NAMES = ["page_view", "search", "search_empty", "js_error", "perf", "copy_install", "share"] as const;
export type MpEventName = typeof MP_EVENT_NAMES[number];

export interface MpEventFields {
  page?: string;
  query?: string;
  resultCount?: number;
  error?: string;
  meta?: Record<string, unknown>;
}

const ANON_ID_KEY = "skiller.miniprogram.anon-id.v1";
const MAX_QUERY_LENGTH = 200;
const MAX_ERROR_LENGTH = 2000;
const MAX_PAGE_LENGTH = 200;
const THROTTLE_MS: Record<MpEventName, number> = {
  page_view: 3000,
  search: 2000,
  search_empty: 2000,
  js_error: 10000,
  perf: 3000,
  copy_install: 1500,
  share: 1500,
};
const MAX_THROTTLE_KEYS = 200;
const FAILURES_KEY = "skiller.miniprogram.analytics-failures.v1";
const MAX_FAILURES = 5;
const MAX_FAILURE_MESSAGE_LENGTH = 200;

const lastSentAt = new Map<string, number>();
let sessionAnonId = "";

function clip(value: string, max: number): string {
  return value.length > max ? value.slice(0, max) : value;
}

function randomId(): string {
  const random = () => Math.random().toString(36).slice(2, 10);
  return `a${Date.now().toString(36)}${random()}${random()}`;
}

/** Random per-device id. It is not derived from any WeChat account identifier. */
export function getAnonId(): string {
  try {
    const stored = wx.getStorageSync(ANON_ID_KEY);
    if (typeof stored === "string" && stored) return stored;
  } catch { /* Fall through to the in-memory id. */ }
  // Kept in memory so an unwritable storage still yields one id per session.
  if (!sessionAnonId) sessionAnonId = randomId();
  try { wx.setStorageSync(ANON_ID_KEY, sessionAnonId); }
  catch { /* A non-persistent id still groups events within this session. */ }
  return sessionAnonId;
}

/** A finished search counts as empty only when a real query returned no rows. */
export function isEmptySearch(query: string, resultCount: number): boolean {
  return query.trim().length > 0 && resultCount === 0;
}

function shouldSend(event: MpEventName, fields: MpEventFields): boolean {
  const key = `${event}|${fields.page ?? ""}|${fields.query ?? ""}|${fields.error ?? ""}|${String(fields.meta?.id ?? "")}|${String(fields.meta?.target ?? "")}|${String(fields.meta?.channel ?? "")}`;
  const now = Date.now();
  const last = lastSentAt.get(key);
  if (last !== undefined && now - last < THROTTLE_MS[event]) return false;
  if (lastSentAt.size >= MAX_THROTTLE_KEYS) lastSentAt.clear();
  lastSentAt.set(key, now);
  return true;
}

/**
 * Which build sent the event: `env` is develop, trial or release; `app_version`
 * is the released version and is empty outside release. Kept in `meta` so no
 * migration is needed. Empty when the API is unavailable.
 */
export function appBuildMeta(): Record<string, string> {
  try {
    const info = typeof wx.getAccountInfoSync === "function" ? wx.getAccountInfoSync()?.miniProgram : null;
    const env = typeof info?.envVersion === "string" ? info.envVersion : "";
    if (!env) return {};
    const version = typeof info.version === "string" ? info.version : "";
    return version ? { env, app_version: version } : { env };
  } catch { return {}; }
}

function buildRow(event: MpEventName, fields: MpEventFields): Record<string, unknown> {
  const row: Record<string, unknown> = { event, anon_id: getAnonId() };
  if (fields.page) row.page = clip(fields.page, MAX_PAGE_LENGTH);
  if (fields.query !== undefined) row.query = clip(fields.query.trim(), MAX_QUERY_LENGTH);
  if (fields.resultCount !== undefined) row.result_count = fields.resultCount;
  if (fields.error) row.error = clip(fields.error, MAX_ERROR_LENGTH);
  const build = appBuildMeta();
  const meta = Object.keys(build).length ? { ...fields.meta, ...build } : fields.meta;
  if (meta) row.meta = meta;
  return row;
}

interface SendFailure {
  event: string;
  errMsg: string;
  at: number;
}

function storedFailures(): SendFailure[] {
  try {
    const value = wx.getStorageSync(FAILURES_KEY);
    return Array.isArray(value) ? value.filter((item) => item && typeof item.errMsg === "string" && typeof item.at === "number") : [];
  } catch { return []; }
}

function saveFailures(failures: SendFailure[]): void {
  try { wx.setStorageSync(FAILURES_KEY, failures); }
  catch { /* Without storage the failure is only kept in the realtime log. */ }
}

/** Keeps the latest few send errors locally and mirrors them to the realtime log. */
function recordFailure(event: MpEventName, errMsg: string): void {
  const failure: SendFailure = { event, errMsg: clip(errMsg, MAX_FAILURE_MESSAGE_LENGTH), at: Date.now() };
  saveFailures([...storedFailures(), failure].slice(-MAX_FAILURES));
  try {
    const logger = typeof wx.getRealtimeLogManager === "function" ? wx.getRealtimeLogManager() : null;
    logger?.warn("mp_events send failed", event, failure.errMsg);
  } catch { /* The realtime log is a best-effort diagnostic. */ }
}

interface SendResult { ok: boolean; errMsg: string }

function post(event: MpEventName, fields: MpEventFields): Promise<SendResult> {
  return new Promise((resolve) => {
    try {
      wx.request({
        url: `${SUPABASE_URL}/rest/v1/mp_events`,
        method: "POST",
        timeout: REQUEST_TIMEOUT_MS,
        header: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        data: buildRow(event, fields),
        success(response?: { statusCode?: number }) {
          const status = response?.statusCode;
          resolve(typeof status === "number" && (status < 200 || status >= 300)
            ? { ok: false, errMsg: `HTTP ${status}` }
            : { ok: true, errMsg: "" });
        },
        fail(error?: { errMsg?: string }) { resolve({ ok: false, errMsg: error?.errMsg || "request:fail" }); },
      });
    } catch (error) {
      resolve({ ok: false, errMsg: error instanceof Error ? error.message : "request:fail" });
    }
  });
}

let flushing = false;

/** After a successful send the network works again: report the stored failures once as a js_error. */
async function flushFailures(): Promise<void> {
  if (flushing) return;
  const failures = storedFailures();
  if (failures.length === 0) return;
  flushing = true;
  try {
    const result = await post("js_error", {
      page: "analytics",
      error: `mp_events send failed x${failures.length}: ${failures.map((item) => item.errMsg).join(" | ")}`,
      meta: { action: "analytics_send_failures", failures },
    });
    if (result.ok) {
      const lastReported = failures[failures.length - 1].at;
      saveFailures(storedFailures().filter((item) => item.at > lastReported));
    }
  } finally {
    flushing = false;
  }
}

/** Fire-and-forget. Never rejects and never throws; analytics must not affect the app. */
export async function trackEvent(event: MpEventName, fields: MpEventFields = {}): Promise<void> {
  try {
    if (!shouldSend(event, fields)) return;
    const result = await post(event, fields);
    if (result.ok) await flushFailures();
    else recordFailure(event, result.errMsg);
  } catch { /* Reporting must never break the caller. */ }
}

export function trackPageView(page: string, meta?: Record<string, unknown>): Promise<void> {
  return trackEvent("page_view", { page, meta });
}

export type InstallCopyTarget = "primary" | "alternative" | "source_link";

/** Needs migration 025: earlier databases reject the new event names and the report is dropped. */
export function trackCopyInstall(skill: { id: string; slug: string }, kind: string, target: InstallCopyTarget, page = "pages/detail/index"): Promise<void> {
  return trackEvent("copy_install", {
    page,
    meta: { action: "copy_install", id: skill.id, slug: skill.slug, kind, target },
  });
}

export type ShareChannel = "button" | "menu" | "timeline";

/** `skill` is null when a page shares itself rather than one skill (home, landing without a hot tool). */
export function trackShare(skill: { id: string; slug: string } | null, channel: ShareChannel, withCard: boolean, page = "pages/detail/index"): Promise<void> {
  return trackEvent("share", {
    page,
    meta: skill
      ? { action: "share", id: skill.id, slug: skill.slug, channel, card: withCard }
      : { action: "share", channel, card: withCard },
  });
}

/** Reports `search`, plus `search_empty` when a non-blank query found nothing. */
export function trackSearch(page: string, query: string, resultCount: number): Promise<void> {
  const reports = [trackEvent("search", { page, query, resultCount })];
  if (isEmptySearch(query, resultCount)) reports.push(trackEvent("search_empty", { page, query, resultCount }));
  return Promise.all(reports).then(() => undefined);
}

function describeError(error: unknown): string {
  if (typeof error === "string") return error;
  if (error && typeof error === "object") {
    const { stack, message } = error as { stack?: unknown; message?: unknown };
    if (typeof stack === "string" && stack) return stack;
    if (typeof message === "string" && message) return message;
    try { return JSON.stringify(error); } catch { /* Fall through. */ }
  }
  return String(error);
}

function currentPageRoute(): string | undefined {
  try {
    const pages = typeof getCurrentPages === "function" ? getCurrentPages() : [];
    const route = pages.length ? pages[pages.length - 1].route : undefined;
    return typeof route === "string" ? route : undefined;
  } catch { return undefined; }
}

export function trackError(error: unknown, page?: string): Promise<void> {
  try {
    return trackEvent("js_error", {
      page: page ?? currentPageRoute(),
      error: clip(describeError(error), MAX_ERROR_LENGTH),
    });
  } catch {
    return Promise.resolve();
  }
}

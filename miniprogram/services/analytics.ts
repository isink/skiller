import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./config";

export type MpEventName = "page_view" | "search" | "search_empty" | "js_error" | "perf";

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
};
const MAX_THROTTLE_KEYS = 200;

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
  const key = `${event}|${fields.page ?? ""}|${fields.query ?? ""}|${fields.error ?? ""}`;
  const now = Date.now();
  const last = lastSentAt.get(key);
  if (last !== undefined && now - last < THROTTLE_MS[event]) return false;
  if (lastSentAt.size >= MAX_THROTTLE_KEYS) lastSentAt.clear();
  lastSentAt.set(key, now);
  return true;
}

function buildRow(event: MpEventName, fields: MpEventFields): Record<string, unknown> {
  const row: Record<string, unknown> = { event, anon_id: getAnonId() };
  if (fields.page) row.page = clip(fields.page, MAX_PAGE_LENGTH);
  if (fields.query !== undefined) row.query = clip(fields.query.trim(), MAX_QUERY_LENGTH);
  if (fields.resultCount !== undefined) row.result_count = fields.resultCount;
  if (fields.error) row.error = clip(fields.error, MAX_ERROR_LENGTH);
  if (fields.meta) row.meta = fields.meta;
  return row;
}

/** Fire-and-forget. Never rejects and never throws; analytics must not affect the app. */
export function trackEvent(event: MpEventName, fields: MpEventFields = {}): Promise<void> {
  return new Promise((resolve) => {
    try {
      if (!shouldSend(event, fields)) { resolve(); return; }
      wx.request({
        url: `${SUPABASE_URL}/rest/v1/mp_events`,
        method: "POST",
        header: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        data: buildRow(event, fields),
        success() { resolve(); },
        fail() { resolve(); },
      });
    } catch {
      resolve();
    }
  });
}

export function trackPageView(page: string, meta?: Record<string, unknown>): Promise<void> {
  return trackEvent("page_view", { page, meta });
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

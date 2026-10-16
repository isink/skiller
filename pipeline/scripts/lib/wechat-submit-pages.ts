export type WxPage = { path: string; query?: string };
export type FetchLike = (input: string, init?: { method?: string; headers?: Record<string, string>; body?: string }) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}>;

export const DETAIL_PAGE_PATH = "pages/detail/index";
export const EXPLORE_PAGE_PATH = "pages/explore/index";
export const STATIC_PAGES: WxPage[] = [
  { path: "pages/landing/index" },
  { path: "pages/home/index" },
  { path: EXPLORE_PAGE_PATH },
  { path: "pages/radar/index" },
];
export const DEFAULT_BATCH_SIZE = 100;
// WeChat accepts up to 1000 pages per request.
export const MAX_BATCH_SIZE = 1000;

const TOKEN_URL = "https://api.weixin.qq.com/cgi-bin/token";
const SUBMIT_URL = "https://api.weixin.qq.com/wxa/search/wxaapi_submitpages";
const ID_PATTERN = /^[0-9a-f-]{36}$/i;
const SLUG_PATTERN = /^[a-z0-9][a-z0-9_-]*$/i;

export interface Options { dryRun: boolean; batchSize: number; limit?: number }

export function parseArgs(argv: string[]): Options {
  const options: Options = { dryRun: false, batchSize: DEFAULT_BATCH_SIZE };
  for (const arg of argv) {
    if (arg === "--dry-run") options.dryRun = true;
    else if (arg.startsWith("--batch-size=")) options.batchSize = positive(arg, MAX_BATCH_SIZE);
    else if (arg.startsWith("--limit=")) options.limit = positive(arg);
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

function positive(arg: string, maximum = Number.MAX_SAFE_INTEGER): number {
  const [name, raw] = arg.split("=");
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0 || value > maximum) {
    throw new Error(`${name} must be an integer between 1 and ${maximum}`);
  }
  return value;
}

export function buildPages(skillIds: string[], categorySlugs: string[] = []): WxPage[] {
  const pages: WxPage[] = [...STATIC_PAGES];
  for (const slug of new Set(categorySlugs)) {
    if (SLUG_PATTERN.test(slug)) pages.push({ path: EXPLORE_PAGE_PATH, query: `category=${encodeURIComponent(slug)}` });
  }
  for (const id of new Set(skillIds)) {
    if (ID_PATTERN.test(id)) pages.push({ path: DETAIL_PAGE_PATH, query: `id=${id}` });
  }
  return pages;
}

export function chunk<T>(items: T[], size: number): T[][] {
  if (!Number.isInteger(size) || size <= 0) throw new Error("Batch size must be a positive integer");
  const batches: T[][] = [];
  for (let index = 0; index < items.length; index += size) batches.push(items.slice(index, index + size));
  return batches;
}

async function readRows<T>(fetchImpl: FetchLike, url: string, key: string): Promise<T[]> {
  const response = await fetchImpl(url, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  if (!response.ok) throw new Error(`Supabase request failed (${response.status})`);
  const rows = await response.json();
  if (!Array.isArray(rows)) throw new Error("Supabase response must be an array");
  return rows as T[];
}

/** Every skill id, read in id order with a keyset cursor so pages never overlap. */
export async function fetchSkillIds(
  fetchImpl: FetchLike,
  supabaseUrl: string,
  anonKey: string,
  limit?: number,
  pageSize = 1000,
): Promise<string[]> {
  const ids: string[] = [];
  let after = "";
  while (limit === undefined || ids.length < limit) {
    const size = limit === undefined ? pageSize : Math.min(pageSize, limit - ids.length);
    const cursor = after ? `&id=gt.${encodeURIComponent(after)}` : "";
    const rows = await readRows<{ id: string }>(
      fetchImpl, `${supabaseUrl}/rest/v1/skills?select=id&order=id.asc&limit=${size}${cursor}`, anonKey,
    );
    for (const row of rows) {
      if (typeof row.id !== "string" || (after && row.id <= after)) throw new Error("Skill ids must be strictly ordered");
      after = row.id;
      ids.push(row.id);
    }
    if (rows.length < size) break;
  }
  return ids;
}

export async function fetchCategorySlugs(fetchImpl: FetchLike, supabaseUrl: string, anonKey: string): Promise<string[]> {
  const rows = await readRows<{ slug: string }>(fetchImpl, `${supabaseUrl}/rest/v1/categories?select=slug&order=slug.asc`, anonKey);
  return rows.map((row) => row.slug).filter((slug) => typeof slug === "string");
}

type WechatResult = { errcode?: number; errmsg?: string; access_token?: string };

export async function getAccessToken(fetchImpl: FetchLike, appId: string, secret: string): Promise<string> {
  const query = `grant_type=client_credential&appid=${encodeURIComponent(appId)}&secret=${encodeURIComponent(secret)}`;
  const response = await fetchImpl(`${TOKEN_URL}?${query}`);
  const body = await response.json() as WechatResult;
  if (!response.ok || !body.access_token) {
    throw new Error(`WeChat token request failed (errcode ${body.errcode ?? response.status}: ${body.errmsg ?? "no access_token"})`);
  }
  return body.access_token;
}

export interface SubmitResult { batches: number; pages: number; submitted: number; dryRun: boolean }

export interface SubmitInput {
  pages: WxPage[];
  batchSize: number;
  dryRun: boolean;
  appId?: string;
  appSecret?: string;
  fetchImpl: FetchLike;
  log?: (message: string) => void;
  sleep?: (ms: number) => Promise<void>;
  delayMs?: number;
}

/** Fails fast on the first rejected batch; the token is never logged. */
export async function submitPages(input: SubmitInput): Promise<SubmitResult> {
  const log = input.log ?? (() => {});
  const batches = chunk(input.pages, input.batchSize);
  const result: SubmitResult = { batches: batches.length, pages: input.pages.length, submitted: 0, dryRun: input.dryRun };
  if (input.dryRun) {
    log(`[dry-run] ${input.pages.length} pages in ${batches.length} batches; no WeChat API calls made`);
    batches.forEach((batch, index) => log(`[dry-run] batch ${index + 1}/${batches.length}: ${batch.length} pages, first ${JSON.stringify(batch[0])}`));
    return result;
  }
  if (!input.appId || !input.appSecret) throw new Error("WECHAT_MP_APPID and WECHAT_MP_APPSECRET are required");
  const sleep = input.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const token = await getAccessToken(input.fetchImpl, input.appId, input.appSecret);
  for (const [index, batch] of batches.entries()) {
    const response = await input.fetchImpl(`${SUBMIT_URL}?access_token=${encodeURIComponent(token)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pages: batch }),
    });
    const body = await response.json() as WechatResult;
    if (!response.ok || body.errcode !== 0) {
      throw new Error(`Batch ${index + 1}/${batches.length} rejected (errcode ${body.errcode ?? response.status}: ${body.errmsg ?? "unknown"}); ${result.submitted} pages submitted before it`);
    }
    result.submitted += batch.length;
    log(`batch ${index + 1}/${batches.length} submitted (${batch.length} pages)`);
    if (index < batches.length - 1) await sleep(input.delayMs ?? 500);
  }
  return result;
}

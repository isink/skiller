/**
 * Submits mini program pages (skill detail pages, categories, WorkBuddy scene
 * collections and main pages)
 * to WeChat search via wxa/search/wxaapi_submitpages.
 *
 *   npx tsx scripts/wechat-submit-pages.ts --dry-run
 *   npx tsx scripts/wechat-submit-pages.ts [--batch-size=100] [--limit=500]
 *
 * Env: WECHAT_MP_APPID, WECHAT_MP_APPSECRET (not needed for --dry-run);
 * SUPABASE_URL and SUPABASE_ANON_KEY (default to the mini program's public config).
 * --dry-run reads skill ids from Supabase but makes no WeChat API calls.
 */
import "dotenv/config";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "../../miniprogram/services/config";
import { SCENES } from "../../miniprogram/services/scenes";
import {
  buildPages, fetchCategorySlugs, fetchSkillIds, parseArgs, submitPages,
  type FetchLike,
} from "./lib/wechat-submit-pages";

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const fetchImpl = fetch as unknown as FetchLike;
  const supabaseUrl = process.env.SUPABASE_URL || SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY || SUPABASE_ANON_KEY;
  const [ids, slugs] = await Promise.all([
    fetchSkillIds(fetchImpl, supabaseUrl, anonKey, options.limit),
    fetchCategorySlugs(fetchImpl, supabaseUrl, anonKey),
  ]);
  const pages = buildPages(ids, slugs, SCENES.map((scene) => scene.slug));
  const result = await submitPages({
    pages,
    batchSize: options.batchSize,
    dryRun: options.dryRun,
    appId: process.env.WECHAT_MP_APPID,
    appSecret: process.env.WECHAT_MP_APPSECRET,
    fetchImpl,
    log: (message) => console.log(message),
  });
  console.log(`${result.dryRun ? "Would submit" : "Submitted"} ${result.dryRun ? result.pages : result.submitted} pages (${ids.length} skills).`);
}

main().catch((error) => {
  console.error(`✖ ${error instanceof Error ? error.message : error}`);
  process.exit(1);
});

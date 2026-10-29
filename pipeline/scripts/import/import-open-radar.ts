/**
 * 开源雷达候选抓取：热门开源项目日榜 + Product Hunt 日热门 → public.open_radar_items（草稿池）。
 *
 *   npm run import:open-radar                      # 抓取全部来源并写库
 *   npm run import:open-radar -- --dry-run         # 只抓取、过滤并打印，不写库、不需要 Supabase 变量
 *   npm run import:open-radar -- --source github   # 只跑一个来源：github | product-hunt | all
 *
 * 环境变量（详见 pipeline/README.md「开源雷达」）：
 *   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY   写库必需（dry-run 不需要）
 *   PRODUCT_HUNT_TOKEN                         Product Hunt API 令牌；缺失时「全部」模式跳过该来源
 *   OPEN_RADAR_MIN_STARS_TODAY (20) / OPEN_RADAR_MIN_VOTES (30)   热度阈值
 *   OPEN_RADAR_AI_ONLY (1)                     只保留 AI 相关候选；设为 0 关闭
 *   OPEN_RADAR_GH_LIMIT (25) / OPEN_RADAR_PH_LIMIT (20)           每个来源最多保留条数
 *   OPEN_RADAR_GH_LANGUAGE                     可选，限定日榜语言（如 python）
 *   OPEN_RADAR_PH_WINDOW_HOURS (48)            Product Hunt 回看窗口
 *
 * 抓到的一律是 draft；只有人工把 status 改为 published 后，小程序才会读到。
 * 重复运行是安全的：已存在的条目只刷新热度与来源字段，不覆盖审核内容或状态。
 */

import "dotenv/config";
import { collectCandidates, parseSourceChoice } from "../lib/open-radar-run";
import { persistCandidates, type OpenRadarDb } from "../lib/open-radar-store";

function argValue(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  if (index >= 0) return args[index + 1];
  return args.find((arg) => arg.startsWith(`${name}=`))?.slice(name.length + 1);
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const choice = parseSourceChoice(argValue(args, "--source"));

  const { options, outcomes } = await collectCandidates(choice, process.env);
  console.log(
    `→ 过滤条件：日榜增星 ≥ ${options.minStarsToday}，PH 票数 ≥ ${options.minVotes}，AI 相关 ${options.aiOnly ? "开" : "关"}`,
  );

  let failed = 0;
  let db: OpenRadarDb | undefined;
  for (const outcome of outcomes) {
    if (outcome.skipped) {
      console.warn(`⚠ ${outcome.source}：已跳过（${outcome.skipped}）`);
      continue;
    }
    if (outcome.error) {
      console.error(`✖ ${outcome.source}：${outcome.error.message}`);
      failed++;
      continue;
    }
    console.log(`✓ ${outcome.source}：抓取 ${outcome.fetched} 条，保留 ${outcome.kept.length} 条`);
    if (dryRun) {
      for (const item of outcome.kept) {
        const heat = item.source === "github_trending" ? `+${item.starsToday}★` : `${item.votesCount} 票`;
        console.log(`    ${heat.padEnd(10)} ${item.title} — ${(item.summary ?? "").slice(0, 70)}`);
      }
      continue;
    }
    if (outcome.kept.length === 0) continue;
    try {
      db ??= (await import("./lib/supabase")).db as unknown as OpenRadarDb;
      const result = await persistCandidates(db, outcome.source, outcome.kept);
      console.log(`  ↳ 新增草稿 ${result.inserted} 条，刷新已有 ${result.refreshed} 条`);
    } catch (error) {
      console.error(`✖ ${outcome.source} 写库失败：${error instanceof Error ? error.message : error}`);
      failed++;
    }
  }

  if (dryRun) console.log("（dry-run：未写入数据库）");
  if (failed > 0) process.exit(1);
}

main().catch((error) => {
  console.error("\n✖ 开源雷达抓取失败：");
  console.error(error);
  process.exit(1);
});

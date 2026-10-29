/**
 * 开源雷达 README 一次性回填：给已入库的日榜条目补上项目 README（清洗后写入 readme_md）。
 *
 *   npm run backfill:open-radar-readme                       # 补齐已发布且还没有 README 的条目
 *   npm run backfill:open-radar-readme -- --dry-run          # 只抓取并打印长度，不写库
 *   npm run backfill:open-radar-readme -- --status all       # published | draft | rejected | all（默认 published）
 *   npm run backfill:open-radar-readme -- --force            # 已有 README 的条目也重新抓取覆盖
 *
 * 环境变量：SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY（dry-run 同样需要，用来读取条目）；
 * GITHUB_TOKEN 可选，提升接口限额。只写 readme_md，不动标题、摘要、状态等任何审核内容。
 */

import "dotenv/config";
import { backfillReadmes, type BackfillRow } from "../lib/open-radar-backfill";
import { fetchGithubReadme } from "../lib/open-radar-readme";

const STATUSES = ["published", "draft", "rejected", "all"] as const;

function argValue(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  if (index >= 0) return args[index + 1];
  return args.find((arg) => arg.startsWith(`${name}=`))?.slice(name.length + 1);
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const force = args.includes("--force");
  const status = argValue(args, "--status") ?? "published";
  if (!(STATUSES as readonly string[]).includes(status)) throw new Error(`--status must be one of ${STATUSES.join(", ")} (got "${status}")`);

  const { db } = await import("./lib/supabase");
  let query = db.from("open_radar_items").select("id, full_name, readme_md").eq("source", "github_trending").not("full_name", "is", null);
  if (status !== "all") query = query.eq("status", status);
  const { data, error } = await query.order("created_at", { ascending: true });
  if (error) throw new Error(`读取条目失败：${error.message}`);
  const rows = (data ?? []) as BackfillRow[];
  console.log(`→ 待检查 ${rows.length} 条（status=${status}${force ? "，强制覆盖" : "，仅补缺"}）`);

  const token = process.env.GITHUB_TOKEN || null;
  const result = await backfillReadmes(
    rows,
    {
      fetchReadme: (fullName) => fetchGithubReadme(fullName, { token }),
      save: async (id, readme) => {
        if (dryRun) {
          console.log(`    ${id} README ${readme.length} 字符`);
          return;
        }
        const { error: updateError } = await db.from("open_radar_items").update({ readme_md: readme }).eq("id", id);
        if (updateError) throw new Error(updateError.message);
      },
      onError: (row, err) => console.warn(`  ⚠ ${row.full_name} 失败：${err.message}`),
    },
    { force },
  );
  console.log(`✓ 写入 ${result.updated} 条，已有跳过 ${result.skipped} 条，无 README ${result.missing} 条，失败 ${result.failed} 条${dryRun ? "（dry-run：未写库）" : ""}`);
  if (result.failed > 0) process.exit(1);
}

main().catch((error) => {
  console.error("\n✖ README 回填失败：");
  console.error(error);
  process.exit(1);
});

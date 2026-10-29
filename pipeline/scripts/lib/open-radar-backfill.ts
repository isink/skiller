import { scrubReadme } from "./open-radar-readme";

export type BackfillRow = { id: string; full_name: string | null; readme_md: string | null };

export type BackfillResult = { updated: number; skipped: number; missing: number; failed: number };

export type BackfillDeps = {
  fetchReadme: (fullName: string) => Promise<string | null>;
  save: (id: string, readme: string) => Promise<void>;
  onError?: (row: BackfillRow, error: Error) => void;
};

/**
 * 给已有条目补 README（一次性回填）。默认只处理还没有 README 的行；force 时重新抓取并覆盖。
 * 写入的永远是清洗后的文本；仓库没有 README、清洗后为空、或单条失败都只计数，不中断整批。
 */
export async function backfillReadmes(
  rows: readonly BackfillRow[],
  deps: BackfillDeps,
  options: { force?: boolean } = {},
): Promise<BackfillResult> {
  const result: BackfillResult = { updated: 0, skipped: 0, missing: 0, failed: 0 };
  for (const row of rows) {
    if (!row.full_name || (!options.force && row.readme_md?.trim())) {
      result.skipped++;
      continue;
    }
    try {
      const readme = scrubReadme(await deps.fetchReadme(row.full_name));
      if (readme === null) {
        result.missing++;
        continue;
      }
      await deps.save(row.id, readme);
      result.updated++;
    } catch (error) {
      result.failed++;
      deps.onError?.(row, error instanceof Error ? error : new Error(String(error)));
    }
  }
  return result;
}

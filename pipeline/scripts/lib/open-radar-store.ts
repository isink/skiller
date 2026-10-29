import type { OpenRadarCandidate, OpenRadarMetricsPatch, OpenRadarRow, OpenRadarSource } from "./open-radar";
import { toMetricsPatch, toRow } from "./open-radar";

type DbError = { message: string } | null;

/** supabase-js 客户端中本模块用到的最小子集，便于测试时替换。 */
export type OpenRadarDb = {
  from(table: "open_radar_items"): {
    select(columns: string): {
      eq(column: string, value: string): {
        in(column: string, values: string[]): PromiseLike<{ data: Array<{ source_id: string }> | null; error: DbError }>;
      };
    };
    upsert(rows: OpenRadarRow[], options: { onConflict: string; ignoreDuplicates: boolean }): PromiseLike<{ error: DbError }>;
    update(values: OpenRadarMetricsPatch): {
      eq(column: string, value: string): { eq(column: string, value: string): PromiseLike<{ error: DbError }> };
    };
  };
};

export type PersistResult = { source: OpenRadarSource; inserted: number; refreshed: number };

const BATCH_SIZE = 100;

function chunks<T>(items: readonly T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) result.push(items.slice(index, index + size));
  return result;
}

/**
 * 写入候选池。新条目插入为 draft（由数据库默认值决定）；已存在的条目只刷新热度，
 * 不触碰 status、标题、摘要或任何审核内容，所以已发布的条目不会被重新抓取打回或改写。
 */
export async function persistCandidates(
  db: OpenRadarDb,
  source: OpenRadarSource,
  candidates: readonly OpenRadarCandidate[],
  seenAt: Date = new Date(),
): Promise<PersistResult> {
  let inserted = 0;
  let refreshed = 0;
  for (const batch of chunks(candidates, BATCH_SIZE)) {
    const existing = await db.from("open_radar_items").select("source_id").eq("source", source)
      .in("source_id", batch.map((candidate) => candidate.sourceId));
    if (existing.error) throw new Error(`读取已有候选失败：${existing.error.message}`);
    const known = new Set((existing.data ?? []).map((row) => row.source_id));

    const fresh = batch.filter((candidate) => !known.has(candidate.sourceId));
    if (fresh.length > 0) {
      const { error } = await db.from("open_radar_items")
        .upsert(fresh.map((candidate) => toRow(candidate, seenAt)), { onConflict: "source,source_id", ignoreDuplicates: true });
      if (error) throw new Error(`写入候选失败：${error.message}`);
      inserted += fresh.length;
    }

    for (const candidate of batch.filter((item) => known.has(item.sourceId))) {
      const { error } = await db.from("open_radar_items").update(toMetricsPatch(candidate, seenAt))
        .eq("source", source).eq("source_id", candidate.sourceId);
      if (error) throw new Error(`刷新候选失败：${error.message}`);
      refreshed++;
    }
  }
  return { source, inserted, refreshed };
}

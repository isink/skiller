import "dotenv/config";
import { db as supabase } from "./import/lib/supabase";

const PAGE_SIZE = 500;
const WRITE_CONCURRENCY = 20;
const APPLY = process.argv.includes("--apply");

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`缺少环境变量 ${name}`);
  return value;
}

async function readAll(table: "skills" | "categories"): Promise<Record<string, unknown>[]> {
  const rows: Record<string, unknown>[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .order("id", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw new Error(`读取 Supabase ${table} 失败：${error.message}`);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) return rows;
  }
}

async function inBatches<T>(items: T[], size: number, action: (item: T) => Promise<unknown>): Promise<void> {
  for (let start = 0; start < items.length; start += size) {
    await Promise.all(items.slice(start, start + size).map(action));
    console.log(`  已处理 ${Math.min(start + size, items.length)} / ${items.length}`);
  }
}

async function main(): Promise<void> {
  const [skills, categories] = await Promise.all([readAll("skills"), readAll("categories")]);
  if (!skills.length || !categories.length) {
    throw new Error(`源数据为空（skills=${skills.length}, categories=${categories.length}），为避免误删已中止。`);
  }
  console.log(`Supabase 源数据：${skills.length} 条技能，${categories.length} 个分类。`);
  if (!APPLY) {
    console.log("这是预览，没有写入 CloudBase。确认环境变量后，使用 --apply 执行幂等迁移和过期记录清理。");
    return;
  }

  const cloudbase = require("@cloudbase/js-sdk");
  const app = cloudbase.init({
    env: required("CLOUDBASE_ENV_ID"),
    accessKey: required("CLOUDBASE_API_KEY"),
  });
  const target = app.database();

  console.log("迁移 skills...");
  await inBatches(skills, WRITE_CONCURRENCY, (row) => {
    const id = String(row.id ?? "");
    if (!id) throw new Error("发现没有 id 的 skill 记录。");
    return target.collection("skills").doc(id).set(row);
  });

  console.log("迁移 categories...");
  await inBatches(categories, WRITE_CONCURRENCY, (row) => {
    const id = String(row.slug ?? "");
    if (!id) throw new Error("发现没有 slug 的 category 记录。");
    return target.collection("categories").doc(id).set(row);
  });

  // Remove records deleted at the source only after both source snapshots were
  // read and all current rows were upserted successfully.
  for (const [collection, sourceRows, key] of [
    ["skills", skills, "id"],
    ["categories", categories, "slug"],
  ] as const) {
    const sourceIds = new Set(sourceRows.map((row) => String(row[key])));
    const staleIds: string[] = [];
    for (let offset = 0; ; offset += 1000) {
      const result = await target.collection(collection).field({ _id: true }).skip(offset).limit(1000).get();
      const docs = result.data ?? [];
      staleIds.push(...docs.map((doc: { _id: string }) => doc._id).filter((id: string) => !sourceIds.has(id)));
      if (docs.length < 1000) break;
    }
    if (staleIds.length) {
      console.log(`清理 ${collection} 中 ${staleIds.length} 条源端已删除的记录...`);
      await inBatches(staleIds, WRITE_CONCURRENCY, (id) => target.collection(collection).doc(id).remove());
    }
  }
  console.log("迁移完成。请在 CloudBase 控制台核对集合记录数后再切换小程序环境 ID。");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

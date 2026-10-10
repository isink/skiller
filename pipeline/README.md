# Skiller Data Pipeline

Independent Node.js pipeline that imports skills from GitHub sources into Supabase, then enriches them with Chinese content via DeepSeek API. The current WeChat mini program reads the public Supabase catalog directly; the CloudBase migration command remains available as an optional fallback.

Decoupled from the iOS app — the app reads from Supabase, doesn't run this pipeline.

## Quick start

```bash
cd pipeline
npm ci
npm run check

# 一把梭（需要本地代理 127.0.0.1:7890）
npm run sync:local

# 分步
npm run import:all      # 拉新 skill（要代理）
npm run apply:overrides # 最终严格校验精选/排序/分类目标
npm run reclassify      # 重新分类 misc
npm run enrich:skills   # 中文化（不要代理）

# 导入趋势新词
npm run upsert:trending -- path/to/terms.json
```

## Trending Terms (新词雷达)

导入 AI 新词到小程序"新词雷达"功能:

```bash
npm run upsert:trending -- data/trending-terms.json
```

**JSON 格式** (数组,每项为对象):

```json
[
  {
    "term": "RAG",
    "summary": "检索增强生成,结合外部知识库提升LLM准确性",
    "score": 0.92,
    "heat": 8500,
    "status": "已命中",
    "discovered_at": "2026-10-01",
    "recheck_at": "2026-11-01",
    "trends_heat": 12000,
    "source": "google-trends",
    "url": "https://trends.google.com/..."
  }
]
```

**字段说明**:
- `term` (必填): 新词名称,用作唯一键
- `summary`: 中文简介(约30字)
- `score`: 评分 0-1
- `heat`: 热度值
- `status`: 状态(`待观察` | `已命中` | `未命中` | `已转选题`)
- `discovered_at`: 发现日期 (YYYY-MM-DD)
- `recheck_at`: 复查日期 (YYYY-MM-DD)
- `trends_heat`: Google Trends 热度
- `source`: 来源平台(不会显示在小程序)
- `url`: 来源链接(不会显示在小程序)

除 `term` 外其他字段均可选。脚本通过 `term` 字段执行 upsert。

**数据库迁移**: 先在 Supabase SQL Editor 执行 `pipeline/supabase/migrations/019_trending_terms.sql`。

## Required env vars (.env)

```
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
DEEPSEEK_API_KEY=...
GITHUB_TOKEN=...           # 可选，提升 GitHub API 限流
CLOUDBASE_ENV_ID=...       # 仅使用可选 CloudBase 迁移时需要
CLOUDBASE_API_KEY=...      # 仅使用可选 CloudBase 迁移时需要，服务端专用
```

CloudBase 迁移脚本默认只读取 Supabase 并报告数据量；只有传入 `--apply` 才会幂等写入 CloudBase 的 `skills`、`categories` 集合，并在成功写完后清理目标端已不存在的记录。不要将 CloudBase API Key 放进小程序配置或提交到 Git。

## 运行方式

主同步只手动跑。技能来源元数据由 Supabase Cron 每 15 分钟调用一次 `refresh-skill-metadata` Edge Function 分批刷新；它不会运行导入、富化或修改技能正文。先应用 `017_skill_source_freshness.sql` 和 `018_batched_skill_metadata_refresh.sql`，再部署函数并配置 Cron。只读 GitHub Token 放在 Edge Function Secret `SKILLER_GITHUB_TOKEN`，服务端密钥放在 Supabase Vault 供 Cron 调用，均不能放进小程序。`.github/workflows/refresh-skill-metadata.yml` 仅保留手动运行入口，避免两个定时器重复刷新。

每轮最多请求 GitHub 60 次，优先核对 36 个仓库的 Star，剩余配额核对具体 `SKILL.md` 的最近提交日期。一个仓库每天最多核对一次；仓库没有新提交时，不重复请求文件。数据库记录每条成功进度，失败或超时的条目留到下一轮，不会把旧值标成当天核对。当前约 2,847 个仓库、7,818 个技能，首次补齐文件日期预计需要多天。函数保留 JWT 验证，并在内部再要求服务端密钥；数据库 RPC、游标和租约只授予 `service_role`。租约防止手动调用和 Cron 同时重复处理。

函数主动在约 105 秒内停止新请求，低于 Supabase Free Edge Function 的 150 秒运行上限。每 15 分钟一次约为每月 2,880 次调用；实际配额和项目用量应以 Supabase Dashboard 为准。

部署顺序：

1. 在现有线上库的 SQL Editor 单独执行 `018_batched_skill_metadata_refresh.sql`。不要对这个旧项目运行整份 `schema.sql` 或直接 `supabase db push`。
2. 在 Supabase **Edge Functions → Secrets** 新增专用、只读的 `SKILLER_GITHUB_TOKEN`；不要复用已无法读回的 GitHub Actions Secret，也不要把令牌放进代码或聊天。部署 `supabase/functions/refresh-skill-metadata/index.ts` 为同名函数，保持 **Verify JWT** 开启。
3. 在 Supabase **Integrations** 启用 Cron 和 `pg_net`。将项目的 legacy `service_role` API key 存进 Vault，名称为 `skiller_refresh_service_role_key`。Cron 作业使用 Vault 解密值作为 `Authorization: Bearer` 和 `apikey` 调用函数；不要把密钥字面值写入作业 SQL。
4. 在项目 URL 核对无误后执行 `supabase/cron/refresh-skill-metadata.sql`，建立名为 `skiller-refresh-skill-metadata`、表达式为 `*/15 * * * *` 的 Cron 作业。SQL 从 Vault 读取密钥，不含密钥字面值。

5. 在 Cron 的运行记录和 Edge Function 日志确认返回 `checkedRepos`、`checkedFiles`；再查 `github_repo_refresh_state` 与 `skills.github_stars_checked_at`、`skills.source_checked_at` 的数量是否增长。`pg_net` 返回的 `request_id` 只表示请求已排队，不能单凭它判定刷新成功。GitHub 403/429、令牌失效、Supabase 写入失败都要看函数日志；修复后下一轮会续跑。

`npm run refresh:metadata` 先逐仓库核对 GitHub Star，再按剩余 API 配额核对每个 `SKILL.md` 的文件存在性和最近提交。进度保存在 `github_repo_refresh_state` 和 `skills` 的核对字段中；首次补齐可能跨多个每日任务。默认每轮最多 4,500 次 GitHub API 请求，可用 `MAX_GITHUB_REQUESTS` 调低。日志会给出尚待核对数；GitHub API 或 Supabase 写入失败时任务返回非零，已完成记录可在下一轮继续。旧的 `backfill:stars` 仅处理空 Star，不替代每日刷新。

`npm run refresh:metadata` 及手动 GitHub Actions 工作流仍可作为运维备用方式。若手动运行，请先暂停 Supabase Cron，以免与 Edge Function 同时写入。

`npm run check` 会先做完整 TypeScript 类型检查，再运行离线单元测试；`npm run check:full` 还会启动两套名称唯一、彼此隔离的本地 Supabase：一套验证最终 schema 和安全行为，另一套从带历史数据的代表性 013 基线 fixture 依次升级到 018，再在升级结果上重放 014–018 验证幂等性。两套实例都会删除容器与数据卷，清理失败也会让门禁失败。GitHub Actions 对 pipeline 相关改动自动运行这道完整门禁。流水线脚本只要有一条写入或 enrichment 失败，就必须返回非零退出码，不能把部分失败伪装成成功。Antigravity 索引少于 1,000 条会被视为异常截断并在写入前失败；若上游确实永久缩小，需要人工核对后再调整该安全线。

`sources.json` 会先完整校验，再由 `apply_skill_overrides` 在一个数据库事务内应用。单来源导入阶段允许尚未出现的 slug 只告警；`sync` 在全部来源完成后会严格再应用一次，仍有遗漏就非零退出。富化会分页审计全部 skill，把空白、越界和双语标签不配对的历史数据重新入队；已有一侧合法标签时保留该侧、只生成对应翻译。`fill_skill_enrichment` 同时校验读取时的 `updated_at`，源内容在生成期间变化就拒绝旧结果并要求重跑。

## 数据库变更与验证

`supabase/schema.sql` 是全新环境使用的最终快照；`supabase/migrations/` 是现有环境的增量历史。不要把最终快照加载到已有项目，也不要把 `supabase/tests/security.sql` 指向线上数据库。

最简单的本地验证命令是 `npm run test:db`。它要求 Docker daemon 和 Supabase CLI 可用，只操作带随机后缀的 `skiller-db-test-*` 一次性本地实例，不连接 linked 项目。若要手工验证另一套一次性 Supabase，也可以这样执行（普通 PostgreSQL 不包含 `auth.users` 和 Supabase 角色，不能替代）：

```bash
test -n "$SKILLER_TEST_DATABASE_URL"
psql "$SKILLER_TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/schema.sql
psql "$SKILLER_TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/security.sql
```

现有环境的发布顺序必须分阶段：

1. 执行 `014_favorites_sync.sql`，建立账号级收藏和账号删除契约。
2. 执行 `015_skills_contract.sql`，先补齐 App/流水线依赖的字段和安全举报 RPC。
3. 发布已经改用 `submit_skill_report` 的 App，并确认旧版直写入口不再需要。
4. 执行 `016_lock_down_public_writes.sql`，关闭旧提交/举报直写、移除 ntfy 触发器和伪安装计数 RPC。
5. 016 成功并读回函数权限后，才更新/运行本版 pipeline；此前暂停 `sync`，因为精选配置和富化写入已依赖新的原子 RPC。
6. 执行 `017_skill_source_freshness.sql`，确认三个展示字段与内部仓库刷新表存在、权限正确，然后才能运行 `refresh:metadata` 或上传显示新字段的小程序版本。
7. 执行 `018_batched_skill_metadata_refresh.sql`，部署 Edge Function 并启动 Cron 后，按上面的运行记录核对实际刷新进度。

这个项目早期迁移曾通过 SQL Editor 手工执行，远端对象可能存在、migration history 却为空。任何 linked push 之前都必须先运行只读的 `supabase migration list --linked` 和 `supabase db push --linked --dry-run`：只要 dry-run 仍列出 `001`–`013`，立即停止。不得直接 push；需先核对线上对象，再经单独授权修复 migration history。否则会重放含去重删除和旧公开写入口的历史迁移，并可能在中途失败后留下不安全状态。

执行前还要只读检查孤儿收藏、负数安装计数和待处理的提交/举报数量。历史 ntfy topic 曾进入仓库，关闭触发器不能替代在 ntfy 侧轮换或停用该 topic。

## 历史

数据管道原本和 Expo iOS app 共享 `/Skiller/ios/` 目录，2026-04-28 迁移到 native 项目下独立成一个子模块（`native/pipeline/`）。旧 Expo 项目 `Skiller/ios/` 现已整体删除，`Skiller/ios/scripts` 不再存在。同时弃用了 GitHub Actions 自动同步，改为纯手动跑。

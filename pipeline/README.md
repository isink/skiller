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
- `summary`: 中文简介(约30字)，兼容 `summary_zh`；仅补充缺失简介，已有内容默认保留
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

已有雷达表再执行 `supabase/migrations/022_preserve_trending_term_summaries.sql`，使直接调用 REST 的旧导入程序也保留非空简介。它只增加触发器，不改写已有记录：非 `postgres` 角色的 UPDATE/upsert 不得覆盖已填写的简介，仍可更新评分等字段、插入新词和补充空简介。人工修订由 `postgres` 通过 SQL Editor 按词条及来源精确更新。保护不覆盖管理员直写或删除后重建记录。

脚本先保存元数据，再按数据库条件补空简介；第二步失败会报错，可重跑。`NULL` 和空字符串可补，旧的纯空格内容需人工整理。本次来源核对与写入调查保存在 `../docs/data/`，不要用未经核对的整表内容覆盖人工简介。

### 新词热榜

榜单使用独立的来源数据，不把旧 `score` 或 `heat` 当作实时热度。**项目榜**按 GitHub 来源仓库的累计 Star 排序，**模型榜**按 Hugging Face 模型近 30 天下载量排序。它们衡量受欢迎程度，不代表最近涨幅。新闻、社交帖子和 HF Spaces 等没有对应指标的条目仍在“最新发现”中展示。

部署顺序：

1. 在 SQL Editor 执行 `supabase/migrations/023_radar_popularity.sql`，增加服务端来源状态表、租约、受限 RPC 和公开视图的四个热度字段。此迁移不修改简介、旧评分和旧热度。
2. 部署 `supabase/functions/refresh-radar-popularity/index.ts` 为同名 Edge Function，保持 **Verify JWT** 开启。复用 Edge Function Secret `SKILLER_GITHUB_TOKEN`，无需把令牌放入小程序，也无需 HF 密钥（读取公开模型）。
3. 确认现有 Vault Secret `skiller_refresh_service_role_key` 后，执行 `supabase/cron/refresh-radar-popularity.sql`。作业 `skiller-refresh-radar-popularity` 在每小时第 7、22、37、52 分钟运行，与技能元数据任务错峰；密钥只从 Vault 读取。
4. 从 Cron 和函数日志核对 `checked`、`missing`、`failed`，并确认 `trending_terms_public.popularity_count` 和 `popularity_checked_at` 已有成功值。Cron 入队成功不等于外部抓取成功。

每批最多处理 40 个来源，约 90 秒内结束，请求间隔至少 1 秒。同一来源成功后最早 60 分钟复查；来源多或请求失败时会更晚。已完成的每项结果立即保存，失败指数退避；403/429 将对应平台的冷却时间写入数据库，后续批次也遵守 `Retry-After`，没有有效时间时默认冷却 1 小时，另一平台继续。失败不更新成功核对时间，404 清空可展示值，保留诊断状态供后续重试。租约避免重叠执行。

小程序前台每 60 秒读取最新榜单，热榜单次返回最多 50 条，标明指标和核对时间；超过 24 小时未核对的来源不参与热榜。用户向下阅读时先提示“榜单有更新”，点击后再换序。进入后台即停止轮询。数据库尚未应用 023 时自动显示原有最新发现列表；网络错误不会被误判成缺少迁移。数据定时更新后，下次请求即可看到；首次启用这些新界面仍需发布小程序代码。

指标口径参考 [GitHub 仓库接口](https://docs.github.com/en/rest/repos/repos#get-a-repository) 与 [Hugging Face 下载统计](https://huggingface.co/docs/hub/models-download-stats)。

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

## 每日导入与首页新鲜度

`.github/workflows/daily-import.yml` 每天 00:30 UTC 运行 `IMPORT_NEW_ONLY=1` 的导入：只插入库里还没有的技能（Antigravity 索引差异、Anthropic 官方目录、GitHub 代码搜索，以及 `DISCOVER_RECENT_DAYS`（默认 3）天内有推送的技能仓库），随后重新应用 `sources.json`、重分类 misc，并用 DeepSeek 富化最新技能（`LIMIT`，默认 300）。每周一 01:30 UTC 跑一次完整刷新（`IMPORT_NEW_ONLY=0`），同步已有技能的描述和 SKILL.md。也可手动 `workflow_dispatch`。

- 所有导入器对已有技能都不再写 `rank`、`score`、`featured`；这三个字段只在新技能首次插入时作为初始值写入，之后只由 `sources.json` 和 `apply_skill_overrides` 修改（`scripts/lib/curation.ts`）。
- Anthropic 官方导入优先读取 `skills/<slug>/SKILL.md`，兼容旧根目录布局。移动目录后仍使用 `pdf`、`docx` 等原有 slug，正文、来源链接与提交日期都指向实际文件路径；完整刷新更新原记录，不生成重复技能。
- GitHub 代码搜索限制为每分钟 10 次，脚本固定间隔 6.5 秒；仓库搜索限制为每分钟 30 次，间隔 2.5 秒。每次搜索最多返回 1,000 条，所以新仓库发现使用带推送日期窗口的仓库搜索，再用 git tree 找 `SKILL.md`。
- 富化队列先处理没有中文描述的技能，再按 `created_at` 从新到旧，最后按 Star；新技能不会再排在历史积压之后。
- Actions Secrets：`SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY`、`DEEPSEEK_API_KEY`，以及建议配置的 `SKILLER_GITHUB_TOKEN`（只读 PAT；未配置时退回内置 `github.token`）。定时工作流只在默认分支上生效。

首页“本周热门”读取 `github_repo_star_snapshots`：`apply_skill_repo_metadata` 在每次仓库刷新时顺带写入当天快照（不增加 GitHub 请求），`get_hot_skills` 取最近快照与约 7 天前基线的差值，每个仓库只返回一个代表技能。基线不足 2 天的仓库不会上榜，所以上线后头几天榜单可能少于 3 条，小程序此时会隐藏该区。`get_latest_skills` 返回每个仓库最多 2 个、已有中文描述的新技能。快照由 pg_cron 任务 `skiller-prune-star-snapshots` 每天保留 45 天。上线前在 SQL Editor 单独执行 `supabase/migrations/020_hot_and_latest_skills.sql`（可重复执行）。

仓库改名时 GitHub 会重定向旧名，导入器与元数据刷新会先用 `GET /repos/{owner}/{repo}` 取规范的 `full_name`，再写入 `github_url`、slug 和 Star 快照，避免同一仓库按新旧两个 key 重复计数。部署此改动前，先在 SQL Editor 执行一次 `supabase/migrations/024_merge_renamed_repo_ecc.sql`（可重复执行），合并已存的 `affaan-m/everything-claude-code` 与 `affaan-m/ECC`。

完整主同步（`npm run sync`）仍可手动运行。技能来源元数据由 Supabase Cron 每 15 分钟调用一次 `refresh-skill-metadata` Edge Function 分批刷新；它不会运行导入、富化或修改技能正文。先应用 `017_skill_source_freshness.sql` 和 `018_batched_skill_metadata_refresh.sql`，再部署函数并配置 Cron。只读 GitHub Token 放在 Edge Function Secret `SKILLER_GITHUB_TOKEN`，服务端密钥放在 Supabase Vault 供 Cron 调用，均不能放进小程序。`.github/workflows/refresh-skill-metadata.yml` 仅保留手动运行入口，避免两个定时器重复刷新。

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

`npm run check` 会先做完整 TypeScript 类型检查，再运行离线单元测试；`npm run check:full` 还会启动两套名称唯一、彼此隔离的本地 Supabase：一套验证最终 schema、安全行为和原文变化后的中文失效，另一套从带历史数据的代表性 013 基线 fixture 依次升级到 021，再在升级结果上重放 014–021 验证幂等性。两套实例都会删除容器与数据卷，清理失败也会让门禁失败。GitHub Actions 对 pipeline 相关改动自动运行这道完整门禁。流水线脚本只要有一条写入或 enrichment 失败，就必须返回非零退出码，不能把部分失败伪装成成功。Antigravity 索引少于 1,000 条会被视为异常截断并在写入前失败；若上游确实永久缩小，需要人工核对后再调整该安全线。

`sources.json` 会先完整校验，再由 `apply_skill_overrides` 在一个数据库事务内应用。单来源导入阶段允许尚未出现的 slug 只告警；`sync` 在全部来源完成后会严格再应用一次，仍有遗漏就非零退出。富化会分页审计全部 skill，把空白、越界和双语标签不配对的历史数据重新入队；已有一侧合法标签时保留该侧、只生成对应翻译。`fill_skill_enrichment` 同时校验读取时的 `updated_at`，源内容在生成期间变化就拒绝旧结果并要求重跑。

## 原文更新后的中文刷新

现有库执行 `supabase/migrations/021_invalidate_changed_skill_enrichment.sql` 后，技能名称、英文介绍或 SKILL.md 正文实际变化时，数据库会同时清除旧中文简介、摘要和双语使用场景，使现有富化队列重新生成。相同原文重复导入、Star/核对时间更新和人工精选排序不会触发清除；源版本仍由 `updated_at` 校验，原文变化前生成的结果会被拒绝。等待富化的技能显示“中文简介待补充”，热门/最新收录区暂时略过它们。迁移本身不批量清空历史译文。

社区代码搜索只提供部分仓库信息，导入会额外读取并缓存仓库 API 元数据，成功取得有效 Star 后才写核对时间；失败不更新旧数据。CLI 备用刷新与 Edge Function 都调用 `apply_skill_repo_metadata`，在同一事务中写 Star、核对状态与当天快照，避免备用任务遗漏热门榜历史。

部署时先执行单独的 021 增量迁移，再发布更新的 pipeline。小程序的稳定分页和收藏返回刷新属于代码变更，需要上传、审核、发布后才对正式用户生效。

## 小程序增长：空搜索补录与「微信小程序 SKILL」专题

- **空搜索补录**：小程序搜索无结果时上报 `search_empty`。`npm run report:empty-search`（需要 `SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY`，建议带 `GITHUB_TOKEN`）读取近 7 天记录，按搜索词聚合排序，跳过站内已有匹配的词，用 GitHub 仓库搜索找出带 `SKILL.md` 的候选仓库并输出 Markdown 报告。默认只读；加 `--import` 才会复用 `import:discover` 的导入逻辑把未收录的候选入库，之后照常运行 `npm run enrich:skills` 生成中文简介。常用参数：`--days`、`--limit`、`--min-count`、`--per-term`、`--min-stars`、`--no-github`、`--out 文件`。
- **访问事件**：`copy_install`（复制安装命令/链接）和 `share`（分享详情页）由 `migrations/025_mp_events_install_share.sql` 加入 `mp_events` 的事件白名单。迁移执行前，小程序上报这两类事件会被数据库拒绝并被静默忽略，不影响使用。
- **「微信小程序 SKILL」专题**：分类 `mp-skill` 由 `migrations/026_mp_skill_category.sql` 创建。`npm run import:mp-skills` 默认只做干跑（列出会收录的范例仓库）；确认后加 `-- --apply` 才写库。判定标准是同一目录下同时有 `SKILL.md` 和 `mcp.json`（微信官方《小程序 AI 开发模式》的 SKILL 目录结构），官方示例仓库里的其他 `SKILL.md` 也一并收录。中文简介留给 `enrich:skills` 根据技能内容生成，不照抄 README。`import:discover` 重新导入这些技能时会保留 `mp-skill` 分类和标签。

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
8. 执行 `020_hot_and_latest_skills.sql` 建立 Star 快照和热门/最新收录 RPC，再执行 `021_invalidate_changed_skill_enrichment.sql`，使实际变化的原文进入重新中文化队列。最后发布包含上述修复的 pipeline 和小程序代码。

排查提示：每日导入报 `Could not find the function public.apply_skill_overrides(...)` 或 `public.fill_skill_enrichment(...)` 时，说明线上库尚未执行 `016_lock_down_public_writes.sql`（可用 anon key 调 `increment_install_count` 验证：仍存在即 016 未执行）。`enrich:skills` 现在会在调用 DeepSeek 前预检该 RPC，缺失时立即失败。

富化对 LLM 输出采用“修复 + 带反馈重试”：超长的描述/摘要在句子边界截断，一组超长的使用场景标签被丢弃（只要仍剩至少 3 组合规标签对），其余问题（过短、标签对不齐、JSON 非法）会把具体问题回传给模型最多重试 3 次。数据库函数的 50–80 / 150–250 / 4–8 字约束不变。

这个项目早期迁移曾通过 SQL Editor 手工执行，远端对象可能存在、migration history 却为空。任何 linked push 之前都必须先运行只读的 `supabase migration list --linked` 和 `supabase db push --linked --dry-run`：只要 dry-run 仍列出 `001`–`013`，立即停止。不得直接 push；需先核对线上对象，再经单独授权修复 migration history。否则会重放含去重删除和旧公开写入口的历史迁移，并可能在中途失败后留下不安全状态。

执行前还要只读检查孤儿收藏、负数安装计数和待处理的提交/举报数量。历史 ntfy topic 曾进入仓库，关闭触发器不能替代在 ntfy 侧轮换或停用该 topic。

## 开源雷达候选抓取

每天抓取「热门开源项目日榜」和 Product Hunt 日热门，写入候选池 `public.open_radar_items`（建表见 `supabase/migrations/027_open_radar_items.sql`，已同步进 `schema.sql`）。抓到的只是候选：新条目一律是 `status = 'draft'`，只有人工改成 `published`，小程序「开源雷达」才能读到。

### 一次性准备

1. 在 Supabase SQL Editor 执行 `027_open_radar_items.sql`（可重复执行）。它建好基表、触发器和受限视图 `open_radar_published`：基表仅 `service_role` 可读写；`anon` 只能读视图里 `status = 'published'` 的行，且读不到来源字段（`source`、`source_url`、`full_name`、热度数字等）。
2. 申请 Product Hunt 开发者令牌：<https://www.producthunt.com/v2/oauth/applications> 创建应用，用 Developer Token（或 client credentials 换取的 access token）。

### 环境变量

| 变量 | 必需 | 说明 |
| --- | --- | --- |
| `SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY` | 写库时必需 | service role 密钥，仅服务端使用；`--dry-run` 不需要 |
| `PRODUCT_HUNT_TOKEN` | 抓 PH 时必需 | 缺失时 `--source all` 会跳过 PH 并告警；`--source product-hunt` 会直接报错 |
| `OPEN_RADAR_MIN_STARS_TODAY` | 否，默认 `20` | 日榜项目当日新增 star 下限 |
| `OPEN_RADAR_MIN_VOTES` | 否，默认 `30` | PH 帖子票数下限 |
| `OPEN_RADAR_AI_ONLY` | 否，默认 `1` | 只保留名称/描述/话题命中 AI 关键词的候选，`0` 关闭 |
| `OPEN_RADAR_GH_LIMIT`、`OPEN_RADAR_PH_LIMIT` | 否，默认 `25`、`20` | 每个来源按热度保留的最大条数 |
| `OPEN_RADAR_GH_LANGUAGE` | 否 | 日榜限定语言，如 `python` |
| `OPEN_RADAR_PH_WINDOW_HOURS` | 否，默认 `48` | PH 回看窗口（1–168 小时），按票数取前 50 再过滤 |

日榜来自公开的 trending 页面，不需要令牌；页面结构变化导致解析不到任何条目时会明确报错，而不是静默写入空结果。

### 运行

```bash
cd pipeline
npm ci
npm run import:open-radar -- --dry-run          # 只抓取、过滤并打印，不写库
npm run import:open-radar                       # 抓取全部来源并写库
npm run import:open-radar -- --source github    # 只抓一个来源：github | product-hunt | all
```

定时运行：`.github/workflows/open-radar-fetch.yml` 每天 01:00 UTC 执行，也可在 Actions 页面手动触发（可选来源和 dry-run）。需要在仓库 Secrets 里配置 `SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY`、`PRODUCT_HUNT_TOKEN`。任一来源失败时整个任务标红，但另一个来源仍会照常写入。

### 数据语义

- 去重键是 `(source, source_id)`：日榜用小写仓库全名，PH 用帖子 id。重复运行安全：已存在的条目只刷新热度和 `last_seen_at`，不会改动 `status`、标题、摘要或任何审核内容，已发布的条目不会被打回草稿。
- `title` / `summary` 是来源站点的原文占位（日榜标题只取仓库名，PH 摘要取 tagline）；自产中文内容写在 `title_zh`、`summary_zh`、`pitfalls`、`install_command`、`article_url`、`package_url`。小程序显示 `title_zh`（缺省回退 `title`）与 `summary_zh`（缺省回退 `summary`）。
- `full_name` 等来源字段只在后台；对外视图不含它们。为守住「对外不出现 GitHub 字样」，数据库约束 `open_radar_items_published_no_brand` 禁止把标题、摘要、踩坑要点或安装命令里含 `github` 的条目发布，需先改写再发布。

### 审核发布

在 Supabase 后台（或 SQL）补充中文内容后发布：

```sql
update public.open_radar_items
set title_zh = '示例项目', summary_zh = '一句话中文摘要', status = 'published'
where id = '<条目 id>';
-- 发布时间 published_at 由触发器自动写入；不要的候选可改为 'rejected'
```

## 历史

数据管道原本和 Expo iOS app 共享 `/Skiller/ios/` 目录，2026-04-28 迁移到 native 项目下独立成一个子模块（`native/pipeline/`）。旧 Expo 项目 `Skiller/ios/` 现已整体删除，`Skiller/ios/scripts` 不再存在。同时弃用了 GitHub Actions 自动同步，改为纯手动跑。

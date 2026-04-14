# Importers

Two one-shot scripts that populate the Supabase `skills` table.

| Script              | Source                                                                                     | Count   | SKILL.md body? |
| ------------------- | ------------------------------------------------------------------------------------------ | ------- | -------------- |
| `import:antigravity`| [`sickn33/antigravity-awesome-skills`](https://github.com/sickn33/antigravity-awesome-skills) `skills_index.json` | ~1,400  | metadata only  |
| `import:anthropic`  | [`anthropics/skills`](https://github.com/anthropics/skills) directory tree                  | ~16     | full body      |

Both are idempotent (`upsert` on `slug`), so you can re-run them at will.

## Setup

1. Create a Supabase project and run `supabase/schema.sql`.
2. Copy `.env.example` → `.env` and fill in `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (**service role**, not anon — importers need write access).
3. Optional: `GITHUB_TOKEN=ghp_...` to raise the GitHub API rate limit from 60/hr to 5000/hr. Only affects `import:anthropic`.

## Run

```bash
npm run import:antigravity    # ~1,400 community skills, 5–10s
npm run import:anthropic      # 16 official skills, ~30s
npm run import:all            # both, in that order
```

## How it works

### `import-antigravity.ts`

1. Ensures the 9 curated categories exist in `public.categories`.
2. `fetch()`es the raw `skills_index.json` (~400 KB).
3. Maps each upstream entry to our row shape:
   - `id` → `slug`
   - `name` or `id` → human-readable `name` via `slugify.idToDisplayName()`
   - `category` → one of 9 curated slugs via `category-map.ts`
   - `risk`, `plugin.targets`, upstream category → `tags[]`
   - `source` → `author` (extracts GitHub org if the source is a URL)
   - `path` → `github_url`
4. Upserts in batches of 200.
5. Applies `sources.json` overrides (`featured`, `ranks`, `categoryOverrides`).

### `import-anthropic.ts`

1. `GET /repos/anthropics/skills/contents` to list top-level directories.
2. For each directory, fetches `<dir>/SKILL.md` via `raw.githubusercontent.com`.
3. Parses YAML frontmatter (tiny hand-rolled parser, no `yaml` dep).
4. Upserts with `skill_md_content = <full markdown>` so the detail screen can render it.
5. Sets `featured: true` and a baseline `rank: 80` for every official skill; `sources.json` can override.
6. Applies `sources.json` overrides.

## Curation

Edit [`sources.json`](./sources.json) to:

- Add/remove slugs from the `featured` array
- Bump specific skills' `rank`
- Re-route a skill to a different category

Re-run either importer and the overrides will be re-applied.

## Adding a new source

Both scripts follow the same pattern: fetch → map → upsert → applyOverrides. To add, say, a SkillsMP import, drop a new file under `scripts/import/`, share `lib/`, and register it in `package.json` scripts.

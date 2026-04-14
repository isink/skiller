# Iskill

A native mobile app for browsing [Claude Skills](https://docs.anthropic.com/claude/docs/skills). There isn't a dedicated mobile app in the ecosystem — the existing platforms (SkillHub, SkillsMP, etc.) are all web. Iskill fills that gap.

## Stack

| Layer        | Choice                       |
| ------------ | ---------------------------- |
| Framework    | React Native + Expo (SDK 52) |
| Router       | Expo Router 4                |
| Styling      | NativeWind 4 (Tailwind)      |
| Data         | Supabase (PostgreSQL)        |
| Build / ship | Expo EAS                     |

The app runs out of the box against bundled sample data; plug in Supabase credentials to go live.

## Project layout

```
app/
  _layout.tsx              Root stack, theme, providers
  (tabs)/
    _layout.tsx            Tab bar
    index.tsx              Home — featured + search
    explore.tsx            Category browser
    favorites.tsx          Local favorites (AsyncStorage)
    profile.tsx            Settings, links, status
  skill/
    [id].tsx               Detail: description, tags, install cmd, SKILL.md
components/                SkillCard, SearchBar, CategoryChip, EmptyState
lib/
  supabase.ts              Supabase client (anon)
  skills.ts                Data queries (falls back to sample data)
  favorites.ts             AsyncStorage-backed favorites store + hooks
  sample-data.ts           Offline skills + categories
types/
  skill.ts                 Skill / Category types
supabase/
  schema.sql               Tables, RLS, triggers
  seed.sql                 Categories + 16 hand-curated Anthropic skills (quick-start)
scripts/import/
  import-antigravity.ts    1,400+ community skills from skills_index.json
  import-anthropic.ts      16 official skills with full SKILL.md bodies
  sources.json             Curation overrides (featured, rank, category)
  lib/                     Shared supabase client, slugify, category-map
```

## Getting started

```bash
# 1. Install deps
npm install

# 2. Configure Supabase (optional — sample data is bundled)
cp .env.example .env
# edit .env with your project URL + anon key

# 3. Run
npm run ios       # iOS simulator
npm run android   # Android emulator
npm start         # pick a target
```

## Supabase setup

1. Create a new Supabase project.
2. In the SQL editor, run `supabase/schema.sql`.
3. Run `supabase/seed.sql` to load the initial skill catalog.
4. Copy the project URL + anon key into `.env`:

```
EXPO_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=ey...
```

Restart `expo start` after editing `.env`. The Profile tab shows a green "Connected to Supabase" row once wired up.

## Schema

```
categories  (id, slug, name, icon)
skills      (id, slug, name, description, category, tags[],
             author, github_url, skill_md_content,
             rank, score, install_count, featured,
             created_at, updated_at)
favorites   (user_id, skill_id, created_at)
```

Reads on `skills` and `categories` are public via RLS. `favorites` is per-user.

## Data strategy

- **Offline dev**: 16 official Anthropic skills live in `lib/sample-data.ts`, rendered whenever Supabase env vars are missing.
- **Bootstrap (real data)**: no hand-rolled scraper — we piggyback on existing curated indexes.
  - `npm run import:antigravity` pulls ~1,400 community skills from [`sickn33/antigravity-awesome-skills`](https://github.com/sickn33/antigravity-awesome-skills)' `skills_index.json`.
  - `npm run import:anthropic` pulls the 16 official skills from [`anthropics/skills`](https://github.com/anthropics/skills), including the full `SKILL.md` body for the detail screen.
  - `npm run import:all` runs both.
  - Curation (featured, rank, category overrides) lives in [`scripts/import/sources.json`](./scripts/import/sources.json) and is reapplied on every run.
  - See [`scripts/import/README.md`](./scripts/import/README.md) for details.
- **Growth**: [`.github/workflows/sync-skills.yml`](./.github/workflows/sync-skills.yml) runs `npm run import:all` every day at 06:00 UTC and can also be triggered manually with a target choice. See below for the one-time secret setup.

## Automatic sync (GitHub Actions)

[`.github/workflows/sync-skills.yml`](./.github/workflows/sync-skills.yml) runs the importers on a cron so the catalog stays fresh without any manual work.

**One-time setup:**

1. Push this repo to GitHub.
2. Go to *Settings → Secrets and variables → Actions → New repository secret* and add:
   - `SUPABASE_URL` — your project URL (e.g. `https://xxx.supabase.co`)
   - `SUPABASE_SERVICE_ROLE_KEY` — from *Project Settings → API → service_role*
3. Done. The workflow runs daily at 06:00 UTC.

**Running manually:** *Actions → Sync skills → Run workflow*. You can pick `all`, `antigravity`, or `anthropic` as the target.

The workflow uses the repo's automatic `GITHUB_TOKEN` to lift the GitHub REST API rate limit from 60 req/hr to 1,000 req/hr — no personal token required.

## Shipping

Target App Store category: **Productivity** or **Developer Tools**.

```bash
npx eas-cli build --platform ios
npx eas-cli submit --platform ios
```

## MVP checklist

- [x] Home feed (featured + search)
- [x] Category browse
- [x] Skill detail with SKILL.md preview
- [x] One-tap copy install command
- [x] Local favorites
- [x] Importers for community + official skills
- [x] GitHub cron sync pipeline
- [ ] Authenticated cloud favorites
- [ ] Push notifications for new skills

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
    favorites.tsx          Local favorites (MMKV)
    profile.tsx            Settings, links, status
  skill/
    [id].tsx               Detail: description, tags, install cmd, SKILL.md
components/                SkillCard, SearchBar, CategoryChip, EmptyState
lib/
  supabase.ts              Supabase client (anon)
  skills.ts                Data queries (falls back to sample data)
  favorites.ts             MMKV-backed favorites store + hooks
  sample-data.ts           Offline skills + categories
types/
  skill.ts                 Skill / Category types
supabase/
  schema.sql               Tables, RLS, triggers
  seed.sql                 ~16 official Anthropic skills
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

- **Bootstrap**: the ~16 Anthropic official skills are shipped in `seed.sql` and mirrored in `lib/sample-data.ts` for offline dev.
- **Growth**: a cron scraper (separate repo) will pull community skills from GitHub and upsert them into `skills`. A human review flag (`featured` + `rank`) curates the home feed.

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
- [ ] Authenticated cloud favorites
- [ ] GitHub cron sync pipeline
- [ ] Push notifications for new skills

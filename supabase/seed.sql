-- Iskill seed data
-- Run after schema.sql. Safe to re-run: uses ON CONFLICT upserts.

-- Categories ---------------------------------------------------------------
insert into public.categories (slug, name, icon) values
  ('official',  'Official',       'star'),
  ('docs',      'Docs & Writing', 'document-text'),
  ('code',      'Code',           'code-slash'),
  ('data',      'Data',           'stats-chart'),
  ('office',    'Office',         'briefcase'),
  ('design',    'Design',         'color-palette'),
  ('devops',    'DevOps',         'git-branch'),
  ('research',  'Research',       'search'),
  ('misc',      'Misc',           'ellipsis-horizontal')
on conflict (slug) do update set
  name = excluded.name,
  icon = excluded.icon;

-- Skills -------------------------------------------------------------------
insert into public.skills
  (slug, name, description, category, tags, author, github_url, rank, score, install_count, featured)
values
  ('pdf', 'PDF', 'Read, extract and fill PDF files with high fidelity.',
   'office', array['pdf','documents','extraction'], 'anthropics',
   'https://github.com/anthropics/skills/tree/main/pdf', 100, 98, 12400, true),
  ('docx', 'DOCX', 'Create and edit Word documents with styles, tables and images.',
   'office', array['word','docx','office'], 'anthropics',
   'https://github.com/anthropics/skills/tree/main/docx', 95, 96, 9800, true),
  ('xlsx', 'XLSX', 'Read, analyze and generate Excel spreadsheets with formulas.',
   'office', array['excel','spreadsheet','office'], 'anthropics',
   'https://github.com/anthropics/skills/tree/main/xlsx', 94, 95, 9500, true),
  ('pptx', 'PPTX', 'Build PowerPoint decks programmatically.',
   'office', array['powerpoint','slides','office'], 'anthropics',
   'https://github.com/anthropics/skills/tree/main/pptx', 90, 94, 7200, true),
  ('canva', 'Canva Design', 'Turn prompts into Canva designs via the Canva API.',
   'design', array['canva','design','image'], 'anthropics',
   'https://github.com/anthropics/skills/tree/main/canva', 78, 88, 4300, true),
  ('brand-guidelines', 'Brand Guidelines', 'Keep generated content consistent with your brand voice and palette.',
   'design', array['brand','writing','style'], 'anthropics',
   'https://github.com/anthropics/skills/tree/main/brand-guidelines', 72, 86, 2100, false),
  ('artifacts-builder', 'Artifacts Builder', 'Scaffold React artifacts with sensible defaults for Claude.',
   'code', array['react','artifacts','scaffold'], 'anthropics',
   'https://github.com/anthropics/skills/tree/main/artifacts-builder', 86, 92, 6100, true),
  ('webapp-testing', 'Webapp Testing', 'Drive Playwright to test any webapp end-to-end.',
   'code', array['playwright','testing','e2e'], 'anthropics',
   'https://github.com/anthropics/skills/tree/main/webapp-testing', 80, 89, 5200, true),
  ('mcp-builder', 'MCP Builder', 'Generate Model Context Protocol servers from a spec.',
   'devops', array['mcp','protocol','server'], 'anthropics',
   'https://github.com/anthropics/skills/tree/main/mcp-builder', 82, 90, 4800, true),
  ('slack-gif-creator', 'Slack GIF Creator', 'Make custom Slack emoji and reaction GIFs from prompts.',
   'design', array['slack','gif','emoji'], 'anthropics',
   'https://github.com/anthropics/skills/tree/main/slack-gif-creator', 60, 78, 1900, false),
  ('algorithmic-art', 'Algorithmic Art', 'Generate generative art with p5.js and svg output.',
   'design', array['art','creative','svg'], 'anthropics',
   'https://github.com/anthropics/skills/tree/main/algorithmic-art', 58, 76, 1500, false),
  ('internal-comms', 'Internal Comms', 'Draft internal announcements, changelogs and standup notes.',
   'docs', array['writing','comms','standup'], 'anthropics',
   'https://github.com/anthropics/skills/tree/main/internal-comms', 66, 82, 2300, false),
  ('financial-analysis', 'Financial Analysis', 'Parse 10-Ks, run ratios and produce executive summaries.',
   'data', array['finance','analysis','reports'], 'anthropics',
   'https://github.com/anthropics/skills/tree/main/financial-analysis', 84, 91, 3700, true),
  ('research-writer', 'Research Writer', 'Citation-heavy long-form research documents.',
   'research', array['research','citations','writing'], 'anthropics',
   'https://github.com/anthropics/skills/tree/main/research-writer', 74, 87, 2800, true),
  ('data-analyst', 'Data Analyst', 'Clean, query and visualize tabular data with pandas.',
   'data', array['pandas','analysis','viz'], 'anthropics',
   'https://github.com/anthropics/skills/tree/main/data-analyst', 88, 93, 6400, true),
  ('skill-creator', 'Skill Creator', 'Meta-skill that helps you author new SKILL.md files.',
   'official', array['meta','authoring'], 'anthropics',
   'https://github.com/anthropics/skills/tree/main/skill-creator', 99, 97, 8800, true)
on conflict (slug) do update set
  name          = excluded.name,
  description   = excluded.description,
  category      = excluded.category,
  tags          = excluded.tags,
  author        = excluded.author,
  github_url    = excluded.github_url,
  rank          = excluded.rank,
  score         = excluded.score,
  install_count = excluded.install_count,
  featured      = excluded.featured;

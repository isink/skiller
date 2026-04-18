export type Category = {
  id: string;
  slug: string;
  name: string;
  icon: string;
};

export type Skill = {
  id: string;
  slug: string;
  name: string;
  description: string;
  description_zh: string | null;
  category: string;
  tags: string[];
  use_cases: string[];
  author: string;
  github_url: string;
  skill_md_content: string | null;
  skill_md_summary_zh: string | null;
  published_at: string | null;
  github_stars: number | null;
  rank: number;
  score: number;
  featured: boolean;
  created_at: string;
  updated_at: string;
};

export type SkillListItem = Pick<
  Skill,
  | "id"
  | "slug"
  | "name"
  | "description"
  | "description_zh"
  | "category"
  | "tags"
  | "use_cases"
  | "author"
  | "github_stars"
  | "rank"
  | "score"
  | "featured"
  | "created_at"
  | "published_at"
>;

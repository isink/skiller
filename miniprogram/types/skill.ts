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
  github_stars: number | null;
  github_stars_checked_at?: string | null;
  source_updated_at?: string | null;
  source_checked_at?: string | null;
  rank: number;
  score: number;
  featured: boolean;
  created_at: string;
  published_at: string | null;
  skill_md_content?: string | null;
};

export type Category = { id: string; slug: string; name: string; icon: string };

export type SkillBlock = {
  type: "heading" | "paragraph" | "list" | "quote" | "code" | "rule";
  level?: number;
  text: string;
  inline: Array<{ type: "text"; text: string } | { name: string; children: Array<{ type: "text"; text: string }> }>;
};

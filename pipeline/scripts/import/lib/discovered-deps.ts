import { env } from "./env";
import { db } from "./supabase";
import { upsertSkillsPreservingCuration } from "./upsert";
import { createGitHubRepoMetadataResolver, logRepoRename } from "../../lib/github-repo-metadata";
import { fetchSkillMdFromContentsUrl, githubJson } from "../../lib/github-api";
import type { ImportDeps, SkillPlacement } from "../../lib/github-discovered-skill";

/** Database and GitHub plumbing shared by every importer that stores discovered SKILL.md files. */
export function createDiscoveredImportDeps(
  existingSlugs: Set<string>,
  placements?: ReadonlyMap<string, SkillPlacement>,
): ImportDeps {
  const getRepoMetadata = createGitHubRepoMetadataResolver((fullName) => githubJson(
    `https://api.github.com/repos/${fullName.split("/").map(encodeURIComponent).join("/")}`,
    env.githubToken,
  ), undefined, logRepoRename);
  return {
    fetchSkillMd: (url) => fetchSkillMdFromContentsUrl(url, env.githubToken),
    getRepoMetadata,
    existingSlugs,
    renameSlug: async (from, to) => {
      const { error } = await db.from("skills").update({ slug: to }).eq("slug", from);
      if (error) throw new Error(error.message);
    },
    upsert: async (row) => { await upsertSkillsPreservingCuration([row], existingSlugs); },
    placements,
  };
}

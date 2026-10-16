import { env } from "./env";
import { createGitHubRepoMetadataResolver, logRepoRename } from "../../lib/github-repo-metadata";

function authHeaders(): Record<string, string> {
  const h: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "skiller-importer",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (env.githubToken) h.Authorization = `Bearer ${env.githubToken}`;
  return h;
}

/** Canonical name, default branch and stars for a repository, fetched once per run. */
export const getRepoMetadata = createGitHubRepoMetadataResolver(async (fullName) => {
  const res = await fetch(`https://api.github.com/repos/${fullName.split("/").map(encodeURIComponent).join("/")}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`GitHub repo API ${res.status} ${res.statusText}: ${fullName}`);
  return res.json();
}, undefined, logRepoRename);

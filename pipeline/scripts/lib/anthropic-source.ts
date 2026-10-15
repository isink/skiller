export type AnthropicSkillSource = {
  /** Keep the historical directory slug even when the upstream moves it. */
  slug: string;
  directoryPath: string;
  skillFilePath: string;
};

type DirectoryEntry = { name: string; path: string; type: string };

function skillDirectories(payload: unknown): DirectoryEntry[] {
  if (!Array.isArray(payload)) throw new Error("GitHub directory response must be an array");
  const entries: DirectoryEntry[] = [];
  for (const value of payload) {
    const entry = value as Partial<DirectoryEntry> | null;
    if (!entry || typeof entry.name !== "string" || typeof entry.path !== "string"
      || typeof entry.type !== "string") {
      throw new Error("GitHub directory response contains an invalid entry");
    }
    if (entry.type === "dir" && !entry.name.startsWith(".")) {
      entries.push(entry as DirectoryEntry);
    }
  }
  return entries;
}

/** Modern repositories keep skills under skills/; older ones used the root. */
export async function discoverAnthropicSkillSources(
  readDirectory: (path: string) => Promise<unknown>,
): Promise<AnthropicSkillSource[]> {
  const rootDirectories = skillDirectories(await readDirectory(""));
  const container = rootDirectories.find((entry) => entry.name === "skills");
  const directories = container
    ? skillDirectories(await readDirectory(container.path))
    : rootDirectories;
  return directories.map((entry) => ({
    slug: entry.name,
    directoryPath: entry.path,
    skillFilePath: `${entry.path}/SKILL.md`,
  }));
}

/** All requests refer to the selected file, never to a slug-derived root path. */
export function anthropicSkillURLs(
  source: AnthropicSkillSource,
  repository: { owner: string; repo: string; branch: string },
): { rawUrl: string; githubUrl: string; commitsUrl: string } {
  const encodePath = (path: string) => path.split("/").map(encodeURIComponent).join("/");
  const repoPath = `${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.repo)}`;
  const branch = encodePath(repository.branch);
  const query = new URLSearchParams({ path: source.skillFilePath, sha: repository.branch });
  return {
    rawUrl: `https://raw.githubusercontent.com/${repoPath}/${branch}/${encodePath(source.skillFilePath)}`,
    githubUrl: `https://github.com/${repoPath}/tree/${branch}/${encodePath(source.directoryPath)}`,
    commitsUrl: `https://api.github.com/repos/${repoPath}/commits?${query}`,
  };
}

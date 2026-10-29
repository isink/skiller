import { fetchGithubTrending } from "./github-trending";
import {
  filterCandidates,
  readFilterOptions,
  type OpenRadarCandidate,
  type OpenRadarFilterOptions,
  type OpenRadarSource,
} from "./open-radar";
import { fetchProductHuntPosts } from "./product-hunt";

export type SourceChoice = "all" | "github" | "product-hunt";

export function parseSourceChoice(value: string | undefined): SourceChoice {
  if (value === undefined || value === "all") return "all";
  if (value === "github" || value === "product-hunt") return value;
  throw new Error(`--source must be one of all, github, product-hunt (got "${value}")`);
}

export type CollectDeps = {
  fetchGithub?: (language: string | undefined) => Promise<OpenRadarCandidate[]>;
  fetchProductHunt?: (token: string, windowHours: number) => Promise<OpenRadarCandidate[]>;
};

export type SourceOutcome = {
  source: OpenRadarSource;
  fetched: number;
  kept: OpenRadarCandidate[];
  /** 来源被跳过（例如缺少令牌）时的原因。 */
  skipped?: string;
  error?: Error;
};

function windowHours(raw: string | undefined): number {
  if (raw === undefined || raw.trim() === "") return 48;
  const hours = Number(raw);
  if (!Number.isInteger(hours) || hours < 1 || hours > 168) throw new Error("OPEN_RADAR_PH_WINDOW_HOURS must be an integer between 1 and 168");
  return hours;
}

/**
 * 抓取并过滤候选。一个来源失败不影响另一个；缺少 Product Hunt 令牌时，
 * 「全部」模式下跳过该来源，显式指定 product-hunt 时则视为错误。
 */
export async function collectCandidates(
  choice: SourceChoice,
  env: Record<string, string | undefined>,
  deps: CollectDeps = {},
): Promise<{ options: OpenRadarFilterOptions; outcomes: SourceOutcome[] }> {
  const options = readFilterOptions(env);
  const hours = windowHours(env.OPEN_RADAR_PH_WINDOW_HOURS);
  const fetchGithub = deps.fetchGithub ?? ((language) => fetchGithubTrending({ since: "daily", language }));
  const fetchProductHunt =
    deps.fetchProductHunt ?? ((token, hoursBack) => fetchProductHuntPosts({ token, windowHours: hoursBack, first: 50 }));
  const outcomes: SourceOutcome[] = [];

  const run = async (source: OpenRadarSource, load: () => Promise<OpenRadarCandidate[]>) => {
    try {
      const fetched = await load();
      const kept = filterCandidates(fetched.filter((candidate) => candidate.source === source), options);
      outcomes.push({ source, fetched: fetched.length, kept });
    } catch (error) {
      outcomes.push({ source, fetched: 0, kept: [], error: error instanceof Error ? error : new Error(String(error)) });
    }
  };

  if (choice === "all" || choice === "github") {
    await run("github_trending", () => fetchGithub(env.OPEN_RADAR_GH_LANGUAGE?.trim() || undefined));
  }
  if (choice === "all" || choice === "product-hunt") {
    const token = env.PRODUCT_HUNT_TOKEN?.trim();
    if (token) {
      await run("product_hunt", () => fetchProductHunt(token, hours));
    } else if (choice === "product-hunt") {
      outcomes.push({ source: "product_hunt", fetched: 0, kept: [], error: new Error("缺少环境变量 PRODUCT_HUNT_TOKEN") });
    } else {
      outcomes.push({ source: "product_hunt", fetched: 0, kept: [], skipped: "未设置 PRODUCT_HUNT_TOKEN" });
    }
  }
  return { options, outcomes };
}

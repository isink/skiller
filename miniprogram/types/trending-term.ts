export type TrendingMode = "github" | "huggingface" | "latest";
export type TrendingPopularityStatus = "pending" | "ok" | "error" | "missing";

export type TrendingTerm = {
  term: string;
  summary_zh: string | null;
  score: number | null;
  heat: number | null;
  status: string | null;
  discovered_at: string | null;
  popularity_platform?: "github" | "huggingface" | null;
  popularity_count?: number | null;
  popularity_checked_at?: string | null;
  popularity_status?: TrendingPopularityStatus | null;
};

export type TrendingTermDisplay = TrendingTerm & {
  displaySummary: string;
  displayScore: string;
  displayHeat: string;
  displayDate: string;
  displayDateGroup: string;
  displayStatus: string;
  hasSummary: boolean;
  hasScore: boolean;
  hasHeat: boolean;
  displayPopularity: string;
  displayPopularityLabel: string;
  displayPopularityCheckedAt: string;
  hasPopularity: boolean;
  popularityNeedsRetry: boolean;
  popularityIsStale: boolean;
};

export type TrendingSnapshot = {
  terms: TrendingTermDisplay[];
  mode: TrendingMode;
  boardAvailable: boolean;
  hasMore: boolean;
  nextOffset: number;
  displayCheckedAt: string;
};

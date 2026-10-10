export type TrendingTerm = {
  term: string;
  summary_zh: string | null;
  score: number | null;
  heat: number | null;
  status: string | null;
  discovered_at: string | null;
};

export type TrendingTermDisplay = TrendingTerm & {
  displaySummary: string;
  displayScore: string;
  displayHeat: string;
  displayDate: string;
  displayStatus: string;
  statusColor: string;
};

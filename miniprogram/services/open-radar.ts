/** One open-source radar entry; every field is optional content that later phases fill in. */
export interface OpenRadarItem {
  id: string;
  titleZh: string;
  summary: string;
  pitfalls: string[];
  installCommand: string;
  articleUrl: string;
  packageUrl: string;
}

export type OpenRadarSummary = Pick<OpenRadarItem, "id" | "titleZh" | "summary">;

export const OPEN_RADAR_TITLE = "开源雷达";

/** P0 ships the shell only; the data source arrives with the sample-data phase. */
export async function fetchOpenRadarList(): Promise<OpenRadarSummary[]> {
  return [];
}

export async function fetchOpenRadarItem(_id: string): Promise<OpenRadarItem | null> {
  return null;
}

export function openRadarDetailUrl(id: string): string {
  return `/pages/open-radar-detail/index?id=${encodeURIComponent(id)}`;
}

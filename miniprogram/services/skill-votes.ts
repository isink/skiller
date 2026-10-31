/** Whether a reader found a skill useful, remembered on this device so the question is asked once. */
export type SkillVote = "up" | "down";

const VOTES_KEY = "skiller.miniprogram.skill-votes.v1";
const MAX_VOTES = 500;

function readVotes(): Record<string, SkillVote> {
  try {
    const value = wx.getStorageSync(VOTES_KEY);
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, SkillVote> : {};
  } catch { return {}; }
}

export function skillVote(id: string): SkillVote | "" {
  const vote = readVotes()[id];
  return vote === "up" || vote === "down" ? vote : "";
}

/** Keeps the newest votes when the list is full (object keys keep insertion order). */
export function saveSkillVote(id: string, vote: SkillVote): void {
  const votes = readVotes();
  delete votes[id];
  votes[id] = vote;
  const ids = Object.keys(votes);
  for (const old of ids.slice(0, Math.max(0, ids.length - MAX_VOTES))) delete votes[old];
  try { wx.setStorageSync(VOTES_KEY, votes); }
  catch { /* The vote is still reported; it just may be asked again. */ }
}

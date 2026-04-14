/**
 * Turn an id like "00-andruia-consultant" into a display name
 * "Andruia Consultant".
 */
export function idToDisplayName(id: string): string {
  const cleaned = id
    .replace(/^[\d_]+-?/, "") // strip leading numbers / underscores
    .replace(/[-_]+/g, " ")
    .trim();

  if (!cleaned) return id;

  return cleaned
    .split(/\s+/)
    .map((word) => {
      if (/^[a-z0-9]+$/i.test(word) && word.length <= 4 && word === word.toUpperCase()) {
        return word; // Keep acronyms like MCP, PDF, API
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}

/**
 * Ensure a string is URL-safe slug (used when we derive slugs from names).
 */
export function toSlug(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

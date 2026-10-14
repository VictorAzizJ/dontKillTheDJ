/** URL-safe slug from a display name, with a short uniqueness suffix. */
export function slugifyEventName(name: string, suffixLength = 6): string {
  const base = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

  const suffix = Math.random()
    .toString(36)
    .slice(2, 2 + suffixLength);

  return `${base || "event"}-${suffix}`;
}

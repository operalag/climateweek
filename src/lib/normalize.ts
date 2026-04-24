/**
 * Normalize a name for dedup. Lowercase, strip punctuation and common
 * corporate suffixes, collapse whitespace.
 */
const SUFFIXES = [
  "ag",
  "sa",
  "gmbh",
  "llc",
  "ltd",
  "limited",
  "inc",
  "corp",
  "corporation",
  "co",
  "kg",
  "kgaa",
  "plc",
  "bv",
  "oy",
  "srl",
  "spa",
  "nv",
  "holding",
  "group",
];

export function normalizeName(raw: string): string {
  let s = raw.toLowerCase().trim();
  s = s.normalize("NFKD").replace(/[̀-ͯ]/g, ""); // strip accents
  s = s.replace(/[^a-z0-9\s]/g, " ");
  s = s.replace(/\s+/g, " ").trim();
  const tokens = s.split(" ").filter((t) => !SUFFIXES.includes(t));
  return tokens.join(" ").trim();
}

/** Best-effort domain from a website URL. */
export function deriveDomain(url: string | undefined | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

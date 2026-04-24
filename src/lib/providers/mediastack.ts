/**
 * Mediastack — international news feed.
 * Docs: https://mediastack.com/documentation
 */
const BASE = "http://api.mediastack.com/v1/news";

function key() {
  const k = process.env.MEDIASTACK_API_KEY;
  if (!k) throw new Error("MEDIASTACK_API_KEY missing");
  return k;
}

export interface MediastackHit {
  title: string;
  description?: string;
  url: string;
  source?: string;
  published_at: string;
  country?: string;
  category?: string;
}

export async function mediastackSearch(
  q: string,
  opts: { limit?: number; countries?: string } = {},
): Promise<MediastackHit[]> {
  const params = new URLSearchParams({
    access_key: key(),
    keywords: q,
    limit: String(opts.limit ?? 25),
    sort: "published_desc",
    ...(opts.countries ? { countries: opts.countries } : {}),
  });
  const res = await fetch(`${BASE}?${params}`);
  if (!res.ok) throw new Error(`mediastack ${res.status}: ${await res.text()}`);
  const body = (await res.json()) as { data?: MediastackHit[] };
  return body.data ?? [];
}

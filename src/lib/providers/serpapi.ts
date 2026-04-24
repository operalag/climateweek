/**
 * SerpAPI — Google search / Google News / LinkedIn SERP.
 * Docs: https://serpapi.com/
 */

const BASE = "https://serpapi.com/search.json";

function key() {
  const k = process.env.SERPAPI_API_KEY;
  if (!k) throw new Error("SERPAPI_API_KEY missing");
  return k;
}

export interface SerpResult {
  position?: number;
  title?: string;
  link?: string;
  snippet?: string;
  source?: string;
  date?: string;
}

export async function serpSearch(
  q: string,
  opts: { engine?: string; num?: number; location?: string; tbm?: string } = {},
): Promise<SerpResult[]> {
  const params = new URLSearchParams({
    api_key: key(),
    q,
    engine: opts.engine ?? "google",
    num: String(opts.num ?? 20),
    ...(opts.location ? { location: opts.location } : {}),
    ...(opts.tbm ? { tbm: opts.tbm } : {}),
  });
  const res = await fetch(`${BASE}?${params}`);
  if (!res.ok) throw new Error(`serpapi ${res.status}: ${await res.text()}`);
  const body = (await res.json()) as {
    organic_results?: SerpResult[];
    news_results?: SerpResult[];
  };
  return body.organic_results ?? body.news_results ?? [];
}

export async function serpNews(q: string, num = 20) {
  return serpSearch(q, { tbm: "nws", num });
}

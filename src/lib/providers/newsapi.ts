/**
 * NewsAPI.org — recent news aggregator.
 * Docs: https://newsapi.org/docs
 */
const BASE = "https://newsapi.org/v2";

function key() {
  const k = process.env.NEWSAPI_API_KEY;
  if (!k) throw new Error("NEWSAPI_API_KEY missing");
  return k;
}

export interface NewsApiArticle {
  source: { id: string | null; name: string };
  author?: string | null;
  title: string;
  description?: string | null;
  url: string;
  urlToImage?: string | null;
  publishedAt: string;
  content?: string | null;
}

export async function newsapiEverything(
  q: string,
  opts: { from?: string; pageSize?: number; language?: string } = {},
): Promise<NewsApiArticle[]> {
  const params = new URLSearchParams({
    q,
    pageSize: String(opts.pageSize ?? 25),
    sortBy: "publishedAt",
    language: opts.language ?? "en",
    ...(opts.from ? { from: opts.from } : {}),
    apiKey: key(),
  });
  const res = await fetch(`${BASE}/everything?${params}`);
  if (!res.ok) throw new Error(`newsapi ${res.status}: ${await res.text()}`);
  const body = (await res.json()) as { articles?: NewsApiArticle[] };
  return body.articles ?? [];
}

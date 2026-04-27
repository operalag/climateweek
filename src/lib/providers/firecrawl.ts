/**
 * Firecrawl — JS-rendered HTML → clean markdown + structured extraction.
 * Docs: https://docs.firecrawl.dev/
 * Used by @CRAWLER_AGENT for the Climate Week event pages that are
 * JS-rendered and unreachable with a raw fetch.
 */

const BASE = "https://api.firecrawl.dev/v1";

export interface FirecrawlScrapeResult {
  markdown?: string;
  html?: string;
  metadata?: {
    title?: string;
    description?: string;
    sourceURL?: string;
    statusCode?: number;
  };
  links?: string[];
}

function key() {
  const k = process.env.FIRECRAW_API_KEY ?? process.env.FIRECRAWL_API_KEY;
  if (!k) throw new Error("FIRECRAWL_API_KEY missing");
  return k;
}

export type FirecrawlAction =
  | { type: "wait"; milliseconds: number }
  | { type: "scroll"; direction: "up" | "down" }
  | { type: "click"; selector: string }
  | { type: "screenshot" }
  | { type: "press"; key: string };

export async function firecrawlScrape(
  url: string,
  opts: {
    formats?: ("markdown" | "html" | "links")[];
    onlyMainContent?: boolean;
    waitFor?: number;
    actions?: FirecrawlAction[];
    timeout?: number;
  } = {},
): Promise<FirecrawlScrapeResult> {
  const res = await fetch(`${BASE}/scrape`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key()}` },
    body: JSON.stringify({
      url,
      formats: opts.formats ?? ["markdown", "links"],
      onlyMainContent: opts.onlyMainContent ?? true,
      ...(opts.waitFor !== undefined ? { waitFor: opts.waitFor } : {}),
      ...(opts.actions ? { actions: opts.actions } : {}),
      ...(opts.timeout !== undefined ? { timeout: opts.timeout } : {}),
    }),
  });
  if (!res.ok) {
    throw new Error(`firecrawl scrape ${res.status}: ${await res.text()}`);
  }
  const body = (await res.json()) as { data?: FirecrawlScrapeResult };
  return body.data ?? {};
}

/** Fire an async crawl job and return the job id; poll with `firecrawlCrawlStatus`. */
export async function firecrawlCrawl(
  url: string,
  opts: { limit?: number; includePaths?: string[]; excludePaths?: string[] } = {},
): Promise<{ id: string }> {
  const res = await fetch(`${BASE}/crawl`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key()}` },
    body: JSON.stringify({
      url,
      limit: opts.limit ?? 100,
      includePaths: opts.includePaths,
      excludePaths: opts.excludePaths,
      scrapeOptions: { formats: ["markdown", "links"], onlyMainContent: true },
    }),
  });
  if (!res.ok) throw new Error(`firecrawl crawl ${res.status}: ${await res.text()}`);
  return (await res.json()) as { id: string };
}

export async function firecrawlCrawlStatus(id: string) {
  const res = await fetch(`${BASE}/crawl/${id}`, {
    headers: { authorization: `Bearer ${key()}` },
  });
  if (!res.ok) throw new Error(`firecrawl status ${res.status}: ${await res.text()}`);
  return (await res.json()) as {
    status: "scraping" | "completed" | "failed";
    total: number;
    completed: number;
    data?: FirecrawlScrapeResult[];
  };
}

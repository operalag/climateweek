/**
 * @EVENT_HARVESTER_AGENT — Discovers every event URL associated with
 * Climate Week Zurich. Combines three strategies:
 *
 *   1. Glueup org listing — `climateweekzurich.glueup.com/organization/7972/events/`
 *      Direct HTML scrape; gives `/event/{slug}-{id}/` URLs.
 *   2. Climate Week site `/all-events` page (Webflow, JS-rendered) —
 *      Firecrawl with scroll-actions to load lazy items, plus link extraction
 *      for `app.glueup.com/event/{id}` and external registration links.
 *   3. The 12 theme pages — each links to its themed events.
 *
 * Output: deduplicated list of event URLs, normalized.
 */
import { firecrawlScrape } from "@/lib/providers/firecrawl";
import { CWZ } from "@/lib/constants";
import type { AgentResult } from "@/lib/types";

const GLUEUP_ORG = "https://climateweekzurich.glueup.com/organization/7972/events/";

export interface DiscoveredEvent {
  url: string;
  /** canonical glueup id when available — used for dedup with /event/{id} short form */
  glueup_id?: string;
  /** slug from path — used as a stable key */
  slug: string;
  /** where we found it */
  source: string;
}

const eventIdFrom = (u: string): string | null => {
  const m = /\/event\/([0-9]+)(?:[/?]|$)/.exec(u) || /\/event\/.*?-([0-9]+)\/?(?:$|[?#])/.exec(u);
  return m?.[1] ?? null;
};

const slugFrom = (u: string): string => {
  try {
    const url = new URL(u);
    const path = url.pathname.replace(/\/$/, "");
    const tail = path.split("/event/")[1] ?? path.split("/").pop() ?? "";
    return tail.replace(/^\/|\/$/g, "").slice(0, 80);
  } catch {
    return u.slice(0, 80);
  }
};

const normalize = (raw: string): DiscoveredEvent | null => {
  if (!raw) return null;
  let u = raw.trim();
  if (u.startsWith("/")) u = `https://climateweekzurich.glueup.com${u}`;
  if (!/^https?:/.test(u)) return null;
  if (!/glueup\.com\/event\/|app\.glueup\.com\/event\/|climateweekzurich\.org\/event/.test(u)) {
    return null;
  }
  // canonicalise: prefer climateweekzurich.glueup.com/event/{slug}-{id}/
  const id = eventIdFrom(u);
  return { url: u, glueup_id: id ?? undefined, slug: slugFrom(u), source: "harvester" };
};

async function harvestGlueupOrg(): Promise<DiscoveredEvent[]> {
  // Glueup loads upcoming events server-side; the listing is paginated,
  // but in practice all current events render in one document.
  const out: DiscoveredEvent[] = [];
  for (const tf of ["upcoming", "past", "all"]) {
    try {
      const url = `${GLUEUP_ORG}?timeframe=${tf}`;
      const html = await fetch(url, {
        headers: { "user-agent": "Mozilla/5.0 (climateweek-harvester/0.1)" },
      }).then((r) => (r.ok ? r.text() : ""));
      const matches = html.match(/href="[^"]*\/event\/[a-z0-9äöüß-]+-[0-9]+\/[^"]*"/gi) ?? [];
      for (const m of matches) {
        const u = m.match(/href="([^"]+)"/)?.[1];
        const ev = u ? normalize(u) : null;
        if (ev) out.push({ ...ev, source: `glueup:${tf}` });
      }
    } catch {
      // soft-fail
    }
  }
  return out;
}

async function harvestAllEventsPage(): Promise<DiscoveredEvent[]> {
  // Webflow page — needs Firecrawl with scroll actions to load lazy items.
  const fc = await firecrawlScrape(`${CWZ.homepage}/all-events`, {
    formats: ["markdown", "links"],
    onlyMainContent: false,
    waitFor: 4000,
    actions: [
      { type: "wait", milliseconds: 2000 },
      { type: "scroll", direction: "down" },
      { type: "wait", milliseconds: 1500 },
      { type: "scroll", direction: "down" },
      { type: "wait", milliseconds: 1500 },
      { type: "scroll", direction: "down" },
      { type: "wait", milliseconds: 1500 },
      { type: "scroll", direction: "down" },
      { type: "wait", milliseconds: 1500 },
    ],
    timeout: 90_000,
  }).catch(() => null);

  const out: DiscoveredEvent[] = [];
  for (const link of fc?.links ?? []) {
    const ev = normalize(link);
    if (ev) out.push({ ...ev, source: "all-events" });
  }
  return out;
}

async function harvestThemes(): Promise<DiscoveredEvent[]> {
  const out: DiscoveredEvent[] = [];
  // The 12-themes hub doesn't expose per-theme URLs we can iterate. Try
  // scraping the hub itself — themes that show inline event lists.
  try {
    const fc = await firecrawlScrape(`${CWZ.homepage}/12-themes-of-cwz2026`, {
      formats: ["links"],
      onlyMainContent: false,
      waitFor: 3000,
    });
    for (const l of fc.links ?? []) {
      const ev = normalize(l);
      if (ev) out.push({ ...ev, source: "themes" });
    }
  } catch {
    /* soft-fail */
  }
  return out;
}

export async function runEventHarvester(): Promise<AgentResult<DiscoveredEvent>> {
  const started = new Date().toISOString();
  const errors: { source: string; message: string }[] = [];
  const all: DiscoveredEvent[] = [];

  for (const [name, fn] of [
    ["glueup", harvestGlueupOrg],
    ["all-events", harvestAllEventsPage],
    ["themes", harvestThemes],
  ] as const) {
    try {
      all.push(...(await fn()));
    } catch (err) {
      errors.push({ source: name, message: (err as Error).message });
    }
  }

  // Dedup by glueup_id (preferred) or url
  const byKey = new Map<string, DiscoveredEvent>();
  for (const e of all) {
    const key = e.glueup_id ?? e.url;
    const prev = byKey.get(key);
    if (!prev) byKey.set(key, e);
    else if (prev.url.includes("app.glueup") && !e.url.includes("app.glueup")) {
      // prefer the climateweekzurich.glueup.com URL (richer page)
      byKey.set(key, e);
    }
  }

  return {
    ok: errors.length === 0 || byKey.size > 0,
    items: [...byKey.values()],
    errors,
    run: { started_at: started, finished_at: new Date().toISOString(), provider: "event-harvester" },
  };
}

/**
 * @CRAWLER_AGENT — Scrapes climateweekzurich.org pages and extracts
 * attendees (orgs + individuals) + events.
 *
 * Static pages are fetched directly; JS-rendered pages fall back to
 * Firecrawl. LLM extraction normalizes the messy HTML into rows.
 */
import { z } from "zod";
import { firecrawlScrape } from "@/lib/providers/firecrawl";
import { claudeStructured } from "@/lib/providers/anthropic";
import { SEED_PAGES, CWZ } from "@/lib/constants";
import { normalizeName } from "@/lib/normalize";
import type { AgentResult, Attendee, PartnershipTier } from "@/lib/types";

const PartnerListSchema = z.object({
  organizations: z.array(
    z.object({
      name: z.string(),
      tier: z
        .enum([
          "platinum",
          "gold",
          "silver",
          "bronze",
          "contributor",
          "community",
          "academic",
          "media",
        ])
        .nullable(),
    }),
  ),
});

const SpeakerListSchema = z.object({
  speakers: z.array(
    z.object({
      name: z.string(),
      role: z.string().nullable().default(null),
      organization: z.string().nullable().default(null),
      event: z.string().nullable().default(null),
    }),
  ),
});

const EventListSchema = z.object({
  events: z.array(
    z.object({
      title: z.string(),
      host: z.string().nullable().default(null),
      date: z.string().nullable().default(null),
      location: z.string().nullable().default(null),
      track: z.string().nullable().default(null),
    }),
  ),
});

export type CrawlerItem =
  | {
      kind: "organization";
      name: string;
      partnership_tier?: PartnershipTier;
      source_url: string;
      source: string;
    }
  | {
      kind: "individual";
      name: string;
      role?: string | null;
      organization?: string | null;
      event?: string | null;
      source_url: string;
      source: string;
    }
  | {
      kind: "event";
      title: string;
      host?: string | null;
      date?: string | null;
      location?: string | null;
      track?: string | null;
      source_url: string;
      source: string;
    };

async function fetchPage(url: string): Promise<string> {
  // Try a raw fetch first (cheaper); fall back to Firecrawl on 5xx / empty body.
  try {
    const r = await fetch(url, {
      headers: { "user-agent": "Mozilla/5.0 (climateweek-agent/0.1)" },
    });
    if (r.ok) {
      const txt = await r.text();
      if (txt.length > 500) return txt;
    }
  } catch {
    // fall through
  }
  const fc = await firecrawlScrape(url, { formats: ["markdown"] });
  return fc.markdown ?? "";
}

async function extractPartners(pageText: string, url: string): Promise<CrawlerItem[]> {
  const parsed = await claudeStructured({
    schema: PartnerListSchema,
    system:
      "You extract sponsor and partner organizations from Climate Week Zurich website HTML/markdown. Return every organization mentioned with its partnership tier (platinum, gold, silver, bronze, contributor, community, academic, media, or null if unknown). Be exhaustive.",
    user: `Extract organizations from this page:\n\n${pageText.slice(0, 80000)}`,
    maxTokens: 4000,
  });
  return parsed.organizations.map((o) => ({
    kind: "organization",
    name: o.name.trim(),
    partnership_tier: o.tier,
    source_url: url,
    source: "crawler:partners",
  }));
}

async function extractSpeakers(pageText: string, url: string): Promise<CrawlerItem[]> {
  const parsed = await claudeStructured({
    schema: SpeakerListSchema,
    system:
      "You extract featured speakers from Climate Week Zurich website HTML/markdown. For each speaker, return name, role/title, organization, and the linked event if mentioned. Be exhaustive.",
    user: `Extract speakers from this page:\n\n${pageText.slice(0, 80000)}`,
    maxTokens: 4000,
  });
  return parsed.speakers.map((s) => ({
    kind: "individual" as const,
    name: s.name.trim(),
    role: s.role,
    organization: s.organization,
    event: s.event,
    source_url: url,
    source: "crawler:speakers",
  }));
}

async function extractEvents(pageText: string, url: string): Promise<CrawlerItem[]> {
  const parsed = await claudeStructured({
    schema: EventListSchema,
    system:
      "You extract events from Climate Week Zurich website markdown. For each event, return title, host organization, date, location, and track/theme if available. Be exhaustive.",
    user: `Extract events from this page:\n\n${pageText.slice(0, 100000)}`,
    maxTokens: 6000,
  });
  return parsed.events.map((e) => ({
    kind: "event" as const,
    title: e.title.trim(),
    host: e.host,
    date: e.date,
    location: e.location,
    track: e.track,
    source_url: url,
    source: "crawler:events",
  }));
}

/**
 * Crawl all seed pages and return structured items.
 * Caller is responsible for upserting into Supabase.
 */
export async function runCrawler(
  opts: { only?: ("partners" | "speakers" | "events" | "exhibitors" | "themes")[] } = {},
): Promise<AgentResult<CrawlerItem>> {
  const started = new Date().toISOString();
  const items: CrawlerItem[] = [];
  const errors: { source: string; message: string }[] = [];

  for (const page of SEED_PAGES) {
    if (opts.only && !opts.only.includes(page.kind)) continue;
    try {
      const text = await fetchPage(page.url);
      if (!text) {
        errors.push({ source: page.url, message: "empty fetch" });
        continue;
      }
      if (page.kind === "partners") items.push(...(await extractPartners(text, page.url)));
      else if (page.kind === "speakers") items.push(...(await extractSpeakers(text, page.url)));
      else if (page.kind === "events") items.push(...(await extractEvents(text, page.url)));
      else if (page.kind === "exhibitors" || page.kind === "themes")
        items.push(...(await extractPartners(text, page.url))); // orgs are orgs
    } catch (err) {
      errors.push({ source: page.url, message: (err as Error).message });
    }
  }

  return {
    ok: errors.length < SEED_PAGES.length,
    items,
    errors,
    run: {
      started_at: started,
      finished_at: new Date().toISOString(),
      provider: "crawler",
    },
  };
}

/** Convenience: pre-normalize a crawler item into an Attendee-shaped row. */
export function crawlerItemToAttendee(
  i: CrawlerItem,
): Partial<Attendee> & { name: string; kind: "organization" | "individual"; normalized_name: string; source: string } | null {
  if (i.kind === "event") return null;
  if (i.kind === "organization") {
    return {
      kind: "organization",
      name: i.name,
      normalized_name: normalizeName(i.name),
      partnership_tier: i.partnership_tier ?? null,
      source: i.source,
      source_url: i.source_url,
      enrichment_state: "pending",
      tags: i.partnership_tier ? [`tier:${i.partnership_tier}`, `cwz:${CWZ.year}`] : [`cwz:${CWZ.year}`],
    };
  }
  return {
    kind: "individual",
    name: i.name,
    normalized_name: normalizeName(i.name),
    role: i.role ?? null,
    source: i.source,
    source_url: i.source_url,
    enrichment_state: "pending",
    tags: [`cwz:${CWZ.year}`, ...(i.event ? [`event:${i.event.slice(0, 40)}`] : [])],
  };
}

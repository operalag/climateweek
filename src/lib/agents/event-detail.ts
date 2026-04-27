/**
 * @EVENT_DETAIL_AGENT — Per-event detail extraction.
 *
 * For each event URL (typically a Glueup event detail page), Firecrawl
 * fetches the markdown, then Claude extracts a structured payload:
 *   - title, date, start_time, end_time, location, description, theme
 *   - host organization
 *   - speakers (name + role + org)
 *
 * The "speakers" section on Glueup pages is consistent enough that
 * regex-only parsing also works as a fallback.
 */
import { z } from "zod";
import { firecrawlScrape } from "@/lib/providers/firecrawl";
import { claudeStructured } from "@/lib/providers/anthropic";
import type { AgentResult } from "@/lib/types";

const DetailSchema = z.object({
  title: z.string(),
  date: z.string().nullable().default(null),
  start_time: z.string().nullable().default(null),
  end_time: z.string().nullable().default(null),
  location: z.string().nullable().default(null),
  description: z.string().nullable().default(null),
  theme: z.string().nullable().default(null),
  language: z.string().nullable().default(null),
  host_org: z.string().nullable().default(null),
  speakers: z
    .array(
      z.object({
        name: z.string(),
        role: z.string().nullable().default(null),
        organization: z.string().nullable().default(null),
      }),
    )
    .default([]),
});

export type EventDetail = z.infer<typeof DetailSchema>;

export interface EventDetailResult extends EventDetail {
  url: string;
  glueup_id: string | null;
  slug: string;
}

const eventIdFrom = (u: string): string | null => {
  const m = /\/event\/([0-9]+)(?:[/?]|$)/.exec(u) || /\/event\/.*?-([0-9]+)\/?(?:$|[?#])/.exec(u);
  return m?.[1] ?? null;
};

const slugFrom = (u: string): string => {
  try {
    const path = new URL(u).pathname.replace(/\/$/, "");
    const tail = path.split("/event/")[1] ?? path.split("/").pop() ?? "";
    return tail.replace(/^\/|\/$/g, "").slice(0, 80);
  } catch {
    return u.slice(0, 80);
  }
};

export async function scrapeEventDetail(url: string): Promise<EventDetailResult | null> {
  const fc = await firecrawlScrape(url, {
    formats: ["markdown"],
    onlyMainContent: true,
    waitFor: 3000,
    timeout: 60_000,
  }).catch(() => null);
  const md = fc?.markdown;
  if (!md || md.length < 200) return null;

  // Also try fetching the speakers.html page when on Glueup (more complete roster)
  let speakersText = "";
  if (/glueup\.com\/event\/.+-\d+/.test(url)) {
    const spkUrl = url.replace(/\/?$/, "/speakers.html");
    try {
      const spk = await firecrawlScrape(spkUrl, {
        formats: ["markdown"],
        onlyMainContent: true,
        waitFor: 2500,
      });
      speakersText = spk.markdown ?? "";
    } catch {
      /* soft-fail */
    }
  }

  const detail = await claudeStructured({
    schema: DetailSchema,
    system: `You extract structured event data from a Climate Week Zurich event page.
Return STRICT JSON matching this shape:
{
  "title": "string",
  "date": "YYYY-MM-DD or null",
  "start_time": "HH:MM (24h, local) or null",
  "end_time": "HH:MM (24h, local) or null",
  "location": "venue + city or null",
  "description": "1-3 sentence summary or null",
  "theme": "theme/track or null",
  "language": "EN/DE or null",
  "host_org": "hosting organization or null",
  "speakers": [{"name":"...","role":"...","organization":"..."}]
}
Speakers may appear under "Speakers" or "Featured Speakers" headings, often with name + role + org. Be exhaustive.
If a field is unknown, use null. Never prose.`,
    user: `EVENT URL: ${url}\n\n=== MAIN PAGE ===\n${md.slice(0, 60000)}\n\n=== SPEAKERS PAGE ===\n${speakersText.slice(0, 40000)}`,
    maxTokens: 4000,
  });

  return {
    ...detail,
    url,
    glueup_id: eventIdFrom(url),
    slug: slugFrom(url),
  };
}

export async function runEventDetail(args: {
  urls: string[];
  limit?: number;
  /** Concurrency cap — Firecrawl + Claude in parallel. */
  concurrency?: number;
}): Promise<AgentResult<EventDetailResult>> {
  const started = new Date().toISOString();
  const items: EventDetailResult[] = [];
  const errors: { source: string; message: string }[] = [];
  const conc = args.concurrency ?? 4;
  const queue = args.urls.slice(0, args.limit ?? args.urls.length);

  for (let i = 0; i < queue.length; i += conc) {
    const batch = queue.slice(i, i + conc);
    const results = await Promise.allSettled(batch.map((u) => scrapeEventDetail(u)));
    results.forEach((r, idx) => {
      if (r.status === "rejected") {
        errors.push({ source: batch[idx], message: (r.reason as Error).message });
      } else if (r.value) {
        items.push(r.value);
      }
    });
  }

  return {
    ok: items.length > 0,
    items,
    errors,
    run: { started_at: started, finished_at: new Date().toISOString(), provider: "event-detail" },
  };
}

/**
 * @MONITOR_AGENT — Daily news scan for every attendee.
 * Fans out across Guardian / NewsAPI / Mediastack / SerpAPI News and
 * returns structured signals with trigger_score.
 */
import { z } from "zod";
import { guardianSearch } from "@/lib/providers/guardian";
import { newsapiEverything } from "@/lib/providers/newsapi";
import { mediastackSearch } from "@/lib/providers/mediastack";
import { serpNews } from "@/lib/providers/serpapi";
import { claudeStructured } from "@/lib/providers/anthropic";
import type { AgentResult, Signal } from "@/lib/types";

export interface RawNewsHit {
  attendee_id: string;
  attendee_name: string;
  title: string;
  url: string;
  source: "guardian" | "newsapi" | "mediastack" | "serpapi";
  excerpt?: string;
  published_at?: string;
}

const TriggerSchema = z.object({
  trigger_score: z.number().int().min(0).max(100),
  reason: z.string(),
});

async function fanOut(name: string, fromDate: string): Promise<Omit<RawNewsHit, "attendee_id" | "attendee_name">[]> {
  const hits: Omit<RawNewsHit, "attendee_id" | "attendee_name">[] = [];
  const push = (h: typeof hits[number]) => hits.push(h);

  await Promise.allSettled([
    (async () => {
      const r = await guardianSearch(name, { pageSize: 10, fromDate });
      r.forEach((x) =>
        push({
          title: x.webTitle,
          url: x.webUrl,
          source: "guardian",
          published_at: x.webPublicationDate,
        }),
      );
    })(),
    (async () => {
      const r = await newsapiEverything(name, { pageSize: 15, from: fromDate });
      r.forEach((x) =>
        push({
          title: x.title,
          url: x.url,
          source: "newsapi",
          excerpt: x.description ?? undefined,
          published_at: x.publishedAt,
        }),
      );
    })(),
    (async () => {
      const r = await mediastackSearch(name, { limit: 15 });
      r.forEach((x) =>
        push({
          title: x.title,
          url: x.url,
          source: "mediastack",
          excerpt: x.description,
          published_at: x.published_at,
        }),
      );
    })(),
    (async () => {
      const r = await serpNews(name, 10);
      r.forEach((x) =>
        push({
          title: x.title ?? "",
          url: x.link ?? "",
          source: "serpapi",
          excerpt: x.snippet,
          published_at: x.date,
        }),
      );
    })(),
  ]);

  return hits;
}

async function scoreTrigger(name: string, hit: Omit<RawNewsHit, "attendee_id" | "attendee_name">): Promise<number> {
  try {
    const parsed = await claudeStructured({
      schema: TriggerSchema,
      system:
        "You score a news hit about a Climate Week Zurich attendee (0-100). 100 = headline funding round, major climate commitment, new CSO hire, or regulatory milestone. 0 = generic mention. Return strict JSON.",
      user: `Attendee: ${name}\nTitle: ${hit.title}\nExcerpt: ${hit.excerpt ?? ""}`,
      maxTokens: 200,
    });
    return parsed.trigger_score;
  } catch {
    return 20;
  }
}

export async function runNewsMonitor(args: {
  attendees: { id: string; name: string }[];
  since?: string; // ISO date
  limit?: number;
}): Promise<AgentResult<Partial<Signal>>> {
  const started = new Date().toISOString();
  const items: Partial<Signal>[] = [];
  const errors: { source: string; message: string }[] = [];
  const fromDate = args.since ?? new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);

  const slice = args.attendees.slice(0, args.limit ?? args.attendees.length);

  for (const a of slice) {
    try {
      const raw = await fanOut(a.name, fromDate);
      for (const r of raw) {
        const trigger_score = await scoreTrigger(a.name, r);
        items.push({
          attendee_id: a.id,
          kind: "news",
          title: r.title,
          url: r.url,
          source: r.source,
          excerpt: r.excerpt,
          published_at: r.published_at,
          trigger_score,
        });
      }
    } catch (err) {
      errors.push({ source: a.name, message: (err as Error).message });
    }
  }

  return {
    ok: errors.length === 0,
    items,
    errors,
    run: { started_at: started, finished_at: new Date().toISOString(), provider: "news-monitor" },
  };
}

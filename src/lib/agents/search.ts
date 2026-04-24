/**
 * @SEARCH_AGENT — Google + Perplexity sweeps for attendees that never
 * made it onto the CWZ website (e.g. mentioned in press, LinkedIn posts,
 * partner announcements).
 */
import { z } from "zod";
import { serpSearch } from "@/lib/providers/serpapi";
import { perplexityAsk } from "@/lib/providers/perplexity";
import { claudeStructured } from "@/lib/providers/anthropic";
import { CWZ } from "@/lib/constants";
import type { AgentResult } from "@/lib/types";

export interface SearchHit {
  kind: "organization" | "individual";
  name: string;
  organization?: string | null;
  role?: string | null;
  reason: string;
  source_url?: string | null;
  source: "search:serpapi" | "search:perplexity";
}

const HitsSchema = z.object({
  hits: z.array(
    z.object({
      kind: z.enum(["organization", "individual"]),
      name: z.string(),
      organization: z.string().nullable().default(null),
      role: z.string().nullable().default(null),
      reason: z.string(),
      source_url: z.string().nullable().default(null),
    }),
  ),
});

const DEFAULT_QUERIES = [
  `"Climate Week Zurich" ${CWZ.year} speaker`,
  `"Climate Week Zurich" ${CWZ.year} partner`,
  `"Climate Week Zurich" ${CWZ.year} attending`,
  `"${CWZ.hashtag}" site:linkedin.com`,
  `"Climate Week Zurich" ${CWZ.year} site:linkedin.com/company`,
  `"climateweekzurich" announce ${CWZ.year}`,
  `Klimawoche Zürich ${CWZ.year} Sponsor`,
  `Climate Week Zurich ${CWZ.year} keynote OR panel`,
];

async function perplexityDiscover(): Promise<SearchHit[]> {
  const prompt = `List every company, investor fund, NGO, government body or named individual that has been publicly announced (press release, LinkedIn post, news article, or their own website) as attending, sponsoring, speaking at, partnering with or exhibiting at Climate Week Zurich ${CWZ.year} (${CWZ.startDate} to ${CWZ.endDate}, Zurich). For each return: kind (organization|individual), name, their organization (for people), role (for people), a one-line reason, and a source URL.\n\nReturn ONLY a JSON object shaped like {"hits":[...]}. No prose.`;
  const ans = await perplexityAsk(prompt, {
    system: "You research attendees of Climate Week Zurich and return structured JSON.",
    model: "sonar-pro",
  });
  try {
    const cleaned = ans.content.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
    const parsed = HitsSchema.parse(JSON.parse(cleaned));
    return parsed.hits.map((h) => ({ ...h, source: "search:perplexity" as const }));
  } catch {
    return [];
  }
}

async function serpDiscover(queries: string[], limit: number): Promise<SearchHit[]> {
  const out: SearchHit[] = [];
  for (const q of queries) {
    try {
      const results = await serpSearch(q, { num: 10 });
      if (!results.length) continue;
      // Stuff the snippets into Claude to extract any org/person mentioned.
      const parsed = await claudeStructured({
        schema: HitsSchema,
        system:
          "Extract any organization or named individual that is plausibly attending, speaking at, or partnering with Climate Week Zurich from these Google snippets. Skip generic climate-news mentions.",
        user: `Query: ${q}\n\nResults:\n${results
          .map((r, i) => `${i + 1}. ${r.title} — ${r.snippet} (${r.link})`)
          .join("\n")}`,
      });
      for (const h of parsed.hits) {
        out.push({ ...h, source: "search:serpapi" });
        if (out.length >= limit) return out;
      }
    } catch {
      // continue
    }
  }
  return out;
}

export async function runSearch(
  opts: { queries?: string[]; limit?: number; skipPerplexity?: boolean } = {},
): Promise<AgentResult<SearchHit>> {
  const started = new Date().toISOString();
  const hits: SearchHit[] = [];
  const errors: { source: string; message: string }[] = [];

  try {
    hits.push(...(await serpDiscover(opts.queries ?? DEFAULT_QUERIES, opts.limit ?? 100)));
  } catch (e) {
    errors.push({ source: "serpapi", message: (e as Error).message });
  }

  if (!opts.skipPerplexity) {
    try {
      hits.push(...(await perplexityDiscover()));
    } catch (e) {
      errors.push({ source: "perplexity", message: (e as Error).message });
    }
  }

  return {
    ok: true,
    items: hits,
    errors,
    run: {
      started_at: started,
      finished_at: new Date().toISOString(),
      provider: "search",
    },
  };
}

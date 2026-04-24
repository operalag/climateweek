# Climate Week Zurich — Agent Team Charter

This project runs as a small team of specialized agents, each owning a
tool surface. The goal is to aggregate, enrich and score every attendee
of Climate Week Zurich 2026.

## Mission

Given: a conference website (`climateweekzurich.org`) with a 250-event
programme, partner directory, speaker list.

Produce: a clean, up-to-date database of every **organization** and
**individual** associated with the event — enriched, scored, monitored,
ready for human-reviewed outreach.

## Team Roster

### Leadership

| Agent | Owns | Tools |
|---|---|---|
| `@SCRUM_MASTER` | Sprint planning, task distribution, unblocking | TaskCreate, TaskUpdate, delegation |
| `@PRODUCT_OWNER` | Requirements, ICP definition, score weights | `.planning/PROJECT.md` |
| `@ARCHITECT` | System design, schema, API contracts | schema, ADRs |

### Discovery (the "collect" phase)

| Agent | Owns | Tools |
|---|---|---|
| `@CRAWLER_AGENT` | The Climate Week site — partners, speakers, events | `providers/firecrawl.ts`, `agents/crawler.ts` |
| `@SEARCH_AGENT` | Google-style discovery for "X attending Climate Week Zurich 2026" | `providers/serpapi.ts`, `providers/perplexity.ts`, `agents/search.ts` |
| `@SOCIAL_AGENT` | LinkedIn / X / Instagram posts tagging the event | `providers/rapidapi-linkedin.ts`, `agents/social.ts` |

### Enrichment (the "understand" phase)

| Agent | Owns | Tools |
|---|---|---|
| `@ENRICHER_AGENT` | Org profile — website, HQ, sector, size, ESG posture | `providers/firecrawl.ts`, `providers/perplexity.ts`, `agents/enricher.ts` |
| `@PEOPLE_AGENT` | Contact enrichment — emails, titles, LinkedIn | `providers/apollo.ts`, `agents/people.ts` |
| `@GEO_AGENT` | Geo: HQ coordinates, Zurich presence | `providers/google-places.ts`, `agents/geo.ts` |

### Intelligence (the "interpret" phase)

| Agent | Owns | Tools |
|---|---|---|
| `@DEDUPER_AGENT` | Entity resolution — "UBS AG" == "UBS" | `providers/anthropic.ts`, `agents/deduplicator.ts` |
| `@SCORER_AGENT` | Reachout fit, influence, signal strength (0–100) | `providers/anthropic.ts`, `agents/scorer.ts` |
| `@MONITOR_AGENT` | News + change-detection, daily digest | `providers/guardian.ts`, `providers/newsapi.ts`, `providers/mediastack.ts`, `agents/news-monitor.ts` |

### Action (the "reach out" phase)

| Agent | Owns | Tools |
|---|---|---|
| `@OUTREACH_AGENT` | Draft generation — email + LinkedIn, 5 angles | `providers/anthropic.ts`, `agents/outreach.ts` |
| `@REVIEW_AGENT` | Human-in-the-loop queue for drafts | `src/app/outreach/*` UI |

### Delivery

| Agent | Owns | Tools |
|---|---|---|
| `@DEVELOPER` | Code implementation across the stack | Write/Edit/Bash |
| `@UI_UX_DESIGNER` | Dashboard UX, attendee table, signal feed | `src/app/*`, `src/components/*` |
| `@QA_ENGINEER` | Vitest coverage, schema sanity, e2e | `*.test.ts` |
| `@DEVOPS_SRE` | Env, Docker, Vercel, CI | Dockerfile, `.github/workflows` |

## Communication Protocol

- **Invoke a single agent:** `@CRAWLER_AGENT: pull partners page and upsert orgs`
- **Run a workflow:** `@WORKFLOW:NEW_ATTENDEE_SOURCE: LinkedIn hashtag #CWZ2026`
- **Kick the full pipeline:** `@TEAM: run discover → enrich → score for the next 50 unprocessed attendees`

## Agent Contract

Every agent in `src/lib/agents/*` exports:

```ts
export type AgentResult<T> = {
  ok: boolean;
  items: T[];
  errors: { source: string; message: string }[];
  run: { started_at: string; finished_at: string; provider: string };
};

export async function runXxxAgent(input: Input): Promise<AgentResult<Output>>;
```

- **Idempotent**: running twice produces the same Supabase state.
- **Structured logging**: every run writes one row to `cw_discovery_runs`.
- **Bounded**: accepts a `limit` so we can smoke-test.

## Development Rules

- New external data source? Add a provider in `src/lib/providers/`, then
  wrap it in an agent in `src/lib/agents/`. Do not short-circuit.
- New agent? Update this file's roster table first, then write the code.
- New scoring dimension? `@PRODUCT_OWNER` signs off in `.planning/PROJECT.md`
  before `@SCORER_AGENT` adds it.

## First Sprint (v0)

1. `@ARCHITECT` — schema + API contracts ✅
2. `@CRAWLER_AGENT` — `/our-partners`, `/featured-events-speakers`, `/all-events`
3. `@DEDUPER_AGENT` — normalize org names
4. `@ENRICHER_AGENT` — website + Perplexity profile for each org
5. `@SCORER_AGENT` — reachout fit + influence
6. `@UI_UX_DESIGNER` — dashboard home + attendees page
7. `@DEVOPS_SRE` — push to GitHub, prep Vercel deploy

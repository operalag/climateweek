# Climate Week Zurich — Claude Code Project Instructions

## Mission

Build and evolve an intelligence platform that tracks every organization
and individual attending **Climate Week Zurich 2026** (4–9 May, Zurich).
Three hard goals:

1. Identify as many attendees as possible (organizations + individuals).
2. Enrich their data for monitoring, scoring and reachout.
3. Present everything in a clean dashboard.

## Tech Stack (authoritative — do not substitute without discussion)

- **Next.js 16** (app router) + TypeScript
- **Tailwind CSS v4** (no shadcn dependency, plain Tailwind + lucide-react)
- **Supabase** (Postgres) — persistence, tables are `cw_*` prefixed
- **Anthropic Claude** — scoring + drafts (structured output)
- **Perplexity / Firecrawl / SerpAPI / Apollo / Guardian / NewsAPI** — data

## Architecture Rules

- Provider wrappers live in `src/lib/providers/*.ts` — one file per API,
  each exposes a small typed surface. Never call `fetch()` to an external
  API outside a provider file.
- Agent tools live in `src/lib/agents/*.ts` — each is a pure function that
  consumes providers and returns structured rows. Agents do **not** call
  `fetch` directly; they compose providers.
- The orchestrator in `src/lib/agents/orchestrator.ts` is the only code
  that chains agents together.
- API routes in `src/app/api/*` are thin — they parse input, invoke an
  agent or orchestrator, persist, and return JSON.
- UI in `src/app/` renders from Supabase; it does **not** invoke agents
  directly (use `/api/*` routes or scripts).

## Data Rules

- All tables prefixed `cw_` (shared-instance safe).
- Identity on `cw_attendees` is `(kind, normalized_name)` — kind ∈
  `{organization, individual}`. Dedup via Claude + rule-based normalizer.
- Every enrichment row links to its source (URL, provider, timestamp).
- Scoring is versioned — rerun does not overwrite, it appends.

## Multi-Agent Development Team

See `AGENTS.md` for the full charter. Quick reference:

- `@SCRUM_MASTER` — coordination & sprint planning
- `@ARCHITECT` — system design & technical decisions
- `@DEVELOPER` — code implementation
- `@CRAWLER_AGENT` — owns the discovery tools (Firecrawl, scraping)
- `@SEARCH_AGENT` — owns SerpAPI / Perplexity / LinkedIn discovery
- `@ENRICHER_AGENT` — owns Apollo + Perplexity + website scrape
- `@SCORER_AGENT` — owns Claude scoring + outreach drafts
- `@MONITOR_AGENT` — owns news + change-detection
- `@UI_UX_DESIGNER` — dashboard + review UX
- `@QA_ENGINEER` — testing
- `@DEVOPS_SRE` — deploy + env

### Usage

- `@AGENT_NAME: [task]` invokes a specific agent.
- `@TEAM: [task]` runs a multi-agent workflow.
- `@WORKFLOW:NEW_ATTENDEE_SOURCE: [source description]` kicks off the
  full add-a-source flow (crawler → enricher → scorer → dashboard).

### Project-Specific Rules

#### @ARCHITECT
- Prefer composition over inheritance. Small modules.
- Every agent writes a `cw_run` row so we can audit what happened.
- New providers get a typed wrapper and a 20-line README at the top.

#### @DEVELOPER
- No `any` in domain types. `zod` schemas for LLM outputs.
- Agents must be idempotent — running twice produces the same result.
- Secrets come from `process.env` only. Never commit keys.

#### @DEVOPS_SRE
- Deployable as Next.js standalone + Docker, same pattern as fibrolux.
- Supabase migrations are forward-only; never drop `cw_*` tables.

## Key Decisions (living)

| Decision | Rationale |
|---|---|
| Reuse fibrolux patterns | Proven and fast; same developer |
| Supabase over bespoke DB | Fast RLS, shared instance OK with `cw_` prefix |
| Claude for scoring | Structured output, consistent, matches fibrolux |
| Draft-only outreach in v0 | Avoid spam before messaging is validated |
| German + English content | Zurich is bilingual; site has /de and /en |

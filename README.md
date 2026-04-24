# Climate Week Zurich — Attendee Intelligence

A B2B intelligence platform that discovers, enriches, scores and monitors
every organization and individual attending **Climate Week Zurich 2026**
(4–9 May, Zurich).

Inspired by the Fibrolux Sales Intelligence OS — same Next.js + Supabase +
multi-agent architecture, retargeted at climate-event attendee graphs.

## What It Does

1. **Discovery** — Crawls `climateweekzurich.org` (partners, speakers, all
   events), plus SerpAPI / Perplexity / LinkedIn / news sources to find every
   company and individual announced as attending, speaking, sponsoring or
   hosting.
2. **Enrichment** — Looks up each attendee's website, LinkedIn, domain, HQ,
   sector, ESG posture, recent news, contact people (Apollo.io), and links
   them back to the events they're tied to.
3. **Scoring** — Claude-based structured scoring for:
   - **Reachout fit** — how likely this attendee is a good conversation for
     our stakeholders (configurable ICP).
   - **Signal strength** — recent news/blog/social activity that makes this
     a warm introduction *right now*.
   - **Influence** — role seniority × organization weight.
4. **Monitoring** — Daily news scan (Guardian, NewsAPI, Mediastack, SerpAPI)
   + change-detection against the Climate Week website; triggers a digest
   when something actionable fires.
5. **Dashboard** — Clean Tailwind UI: KPI cards, attendee table with
   filters, signals feed, scoring view, draft outreach review.

## Tech Stack

- **Next.js 16** + TypeScript + Tailwind 4
- **Supabase** (Postgres) — persistence, RLS-ready
- **Anthropic Claude** — scoring, structured extraction, outreach drafts
- **Gemini / OpenAI** — fallback + fast extraction
- **Perplexity Sonar** — agentic research
- **Firecrawl** — JS-rendered crawl of event pages
- **SerpAPI** — Google search + news
- **Apollo.io** — people/contact enrichment
- **Guardian / NewsAPI / Mediastack** — news feeds

## Multi-Agent Architecture

See [`AGENTS.md`](./AGENTS.md). The system runs as a small team of
specialized agents — each owns a tool surface and writes to Supabase.

```
 ┌─────────────┐   ┌──────────────┐   ┌─────────────┐
 │ @CRAWLER    │──▶│ cw_attendees │◀──│ @SEARCH     │
 │ (Firecrawl) │   │   (raw)      │   │ (SerpAPI,   │
 └─────────────┘   └──────────────┘   │ Perplexity) │
                          │           └─────────────┘
                          ▼
                   ┌──────────────┐
                   │ @DEDUPER     │  (Claude structured)
                   └──────────────┘
                          │
                          ▼
                   ┌──────────────┐
                   │ @ENRICHER    │──▶ website, LinkedIn,
                   │ (Perplexity, │    sector, HQ, people
                   │ Apollo,      │
                   │ Firecrawl)   │
                   └──────────────┘
                          │
        ┌─────────────────┼──────────────────┐
        ▼                 ▼                  ▼
 ┌────────────┐   ┌──────────────┐   ┌─────────────────┐
 │ @SCORER    │   │ @NEWS-MONITOR│   │ @OUTREACH       │
 │ (Claude)   │   │ (Guardian,   │   │ (Claude drafts) │
 └────────────┘   │ NewsAPI)     │   └─────────────────┘
                  └──────────────┘
```

## Quick Start

```bash
# 1. Install
npm install

# 2. Configure env — secrets are inherited from your shell by default.
cp .env.local.example .env.local
# Fill in Supabase URL + keys at minimum.

# 3. Apply the schema
psql $SUPABASE_DB_URL -f supabase/migrations/001_climateweek_init.sql
# or apply via the Supabase dashboard

# 4. Run
npm run dev             # dashboard at http://localhost:3000

# 5. Kick off the pipeline (requires Supabase)
npm run agents:discover   # seeds cw_attendees from the Climate Week site
npm run agents:enrich     # enriches every row
npm run agents:score      # scores for reachout fit & signal strength
```

## Project Structure

```
.
├── src/
│   ├── app/                   Next app router (dashboard + API routes)
│   ├── components/            UI — nav, attendee table, signals feed, etc.
│   ├── lib/
│   │   ├── providers/         Thin typed wrappers for every external API
│   │   ├── agents/            Agent tools (crawler, enricher, scorer…)
│   │   ├── supabase/          Client + server Supabase helpers
│   │   ├── constants.ts       CWZ dates, role priority, ICP defaults
│   │   └── types.ts           Shared domain types
│   └── types/
├── supabase/migrations/       SQL schema
├── scripts/                   CLI runners (discovery, enrich, score, full)
├── AGENTS.md                  Agent team charter
├── CLAUDE.md                  Claude Code project instructions
└── .planning/PROJECT.md       Mission + scope
```

## Roadmap

- **v0 (now)**: Scaffold + discovery of the top-of-funnel attendees from
  the Climate Week Zurich site + dashboard shell.
- **v0.1**: Enrichment pipeline (Apollo + Perplexity + Firecrawl), dedup,
  scoring, news monitor.
- **v0.2**: Outreach drafting (Claude), human review queue, CSV export.
- **v0.3**: Event-level graph (who is at which event), scheduling helper,
  weekly digest email.

## Ethics

This is an **attendee-intelligence** tool for legitimate outreach and
research. Do not use it for mass cold-email spam. The system is
draft-only — every outreach message is reviewed by a human before it
leaves the platform.

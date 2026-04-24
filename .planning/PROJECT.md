# Climate Week Zurich — Attendee Intelligence

## What This Is

A Next.js + Supabase intelligence platform that discovers, enriches,
scores and monitors every organization and individual attending
**Climate Week Zurich 2026** (4–9 May 2026, Zurich). Inspired by the
Fibrolux Sales Intelligence OS — same architecture, retargeted from a
B2B water/wastewater niche to a climate-event attendee graph.

## Core Value

A single pane of glass for anyone who wants to engage with the
attendees of Climate Week Zurich — investors scouting climate-tech,
journalists prepping interviews, consultancies doing biz dev, NGO
partnership teams, or sustainability leaders mapping the ecosystem.
Find → enrich → score → reach out, with human review.

## Event Facts

- **Event:** Climate Week Zurich 2026 (CWZ 2026)
- **Dates:** 4–9 May 2026
- **Location:** Zurich, Switzerland
- **Scale:** 250+ events across the week
- **Homepage:** https://www.climateweekzurich.org/
- **Key source pages:**
  - `/our-partners` — sponsors by tier (Platinum / Gold / Silver / Bronze / Contributors / Community / Academic / Media)
  - `/featured-events-speakers` — 50+ featured speakers with org + event
  - `/all-events` — full 250-event programme (JS-rendered, needs Firecrawl)
  - `/main-programme` — curated main-stage events
  - `/exhibition-centre` — exhibiting orgs
  - `/join-as-a-partner`, `/join-as-a-speaker` — signal of open recruitment

## Requirements

### Active (v0)

- [ ] Crawl `/our-partners` and extract every org with its partnership tier
- [ ] Crawl `/featured-events-speakers` and extract every speaker with their org + linked event
- [ ] Crawl `/all-events` and extract event → host org mapping
- [ ] Store everything in Supabase `cw_*` tables
- [ ] Dedup with Claude + a normalized-name rule
- [ ] Minimal dashboard (home + attendees + signals)

### Active (v0.1)

- [ ] Enrich each organization: website, HQ, sector, size (Perplexity + Firecrawl)
- [ ] Enrich each individual: LinkedIn URL, email (Apollo), role seniority
- [ ] News monitor: Guardian / NewsAPI / Mediastack hits for each org
- [ ] Claude scoring: reachout fit (0–100) + signal strength + influence

### Active (v0.2)

- [ ] Outreach drafts: 5 angles per attendee (Claude, JSON-mode)
- [ ] Human review queue in `/outreach` with approve/reject
- [ ] CSV export of filtered attendee list
- [ ] Daily digest email (Resend) of high-signal movers

### Out of Scope (for now)

- Automated email sending — draft-only until outreach is validated
- Payment / ticketing integration
- Live-event-day features (schedule builder, QR badges)

## Constraints

- **Tech Stack**: Next.js 16 + Supabase + Tailwind 4 + Claude (mirrors fibrolux).
- **APIs**: Keys inherited from shell env (`~/.bashrc`). No new paid accounts in v0.
- **Geography**: Zurich-centric, but orgs can be global.
- **Language**: Site content is EN + DE. Pipeline handles both.
- **Privacy**: Public attendee data only. Contact enrichment via Apollo is
  for research + outreach, not mass scraping. Human review gates every
  outgoing message.

## Key Decisions

| Decision | Rationale |
|---|---|
| Reuse fibrolux architecture | Proven. Same developer. ~3× faster to ship. |
| Supabase over bespoke DB | Cheap, RLS-ready, shared instance safe with `cw_` prefix |
| Claude for scoring + drafts | Structured output, consistent, matches fibrolux |
| Draft-only outreach in v0 | No spam risk until messaging is validated |
| Multi-agent team in `src/lib/agents/` | Matches CLAUDE.md conventions; every capability is one agent owned by one file |
| Firecrawl for `/all-events` | The events page is JS-rendered; raw curl doesn't work |

---
*Last updated: 2026-04-24 — scaffold day.*

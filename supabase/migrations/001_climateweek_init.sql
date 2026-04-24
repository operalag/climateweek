-- ============================================================================
-- Climate Week Zurich — initial schema
-- All tables prefixed cw_ for shared-instance safety.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- cw_attendees — organizations + individuals
-- ---------------------------------------------------------------------------
create table if not exists cw_attendees (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('organization', 'individual')),
  name text not null,
  normalized_name text not null,
  -- individual-only
  role text,
  org_id uuid references cw_attendees(id) on delete set null,
  -- organization-only
  website text,
  domain text,
  hq_city text,
  hq_country text,
  sector text,
  partnership_tier text,          -- platinum | gold | silver | bronze | contributor | community | academic | media | null
  -- common
  linkedin_url text,
  twitter_url text,
  bio text,
  tags text[] default '{}',
  source text not null,           -- e.g. 'crawler:our-partners', 'search:serpapi'
  source_url text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  enrichment_state text not null default 'pending' check (enrichment_state in ('pending','enriching','enriched','failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (kind, normalized_name)
);

create index if not exists cw_attendees_kind_idx on cw_attendees (kind);
create index if not exists cw_attendees_tier_idx on cw_attendees (partnership_tier);
create index if not exists cw_attendees_sector_idx on cw_attendees (sector);
create index if not exists cw_attendees_org_idx on cw_attendees (org_id);

-- ---------------------------------------------------------------------------
-- cw_events — the 250+ event programme
-- ---------------------------------------------------------------------------
create table if not exists cw_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text unique,
  date date,
  start_time text,
  end_time text,
  location text,
  track text,                    -- main programme / afterwork / #MoveTheDate / etc.
  theme text,
  host_org_id uuid references cw_attendees(id) on delete set null,
  url text,
  description text,
  source text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists cw_events_date_idx on cw_events (date);
create index if not exists cw_events_track_idx on cw_events (track);

-- ---------------------------------------------------------------------------
-- cw_event_attendees — many-to-many: who's speaking/attending what
-- ---------------------------------------------------------------------------
create table if not exists cw_event_attendees (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references cw_events(id) on delete cascade,
  attendee_id uuid not null references cw_attendees(id) on delete cascade,
  relation text not null check (relation in ('speaker','host','sponsor','panelist','attendee','moderator','exhibitor')),
  created_at timestamptz not null default now(),
  unique (event_id, attendee_id, relation)
);

create index if not exists cw_event_attendees_event_idx on cw_event_attendees (event_id);
create index if not exists cw_event_attendees_attendee_idx on cw_event_attendees (attendee_id);

-- ---------------------------------------------------------------------------
-- cw_enrichments — one row per enrichment lookup, append-only
-- ---------------------------------------------------------------------------
create table if not exists cw_enrichments (
  id uuid primary key default gen_random_uuid(),
  attendee_id uuid not null references cw_attendees(id) on delete cascade,
  provider text not null,        -- perplexity | firecrawl | apollo | gemini | anthropic | google-places
  kind text not null,            -- profile | contact | geo | news | social
  payload jsonb not null,
  cost_usd numeric(10,4),
  created_at timestamptz not null default now()
);

create index if not exists cw_enrichments_attendee_idx on cw_enrichments (attendee_id);
create index if not exists cw_enrichments_kind_idx on cw_enrichments (kind);

-- ---------------------------------------------------------------------------
-- cw_scores — versioned scoring, append-only
-- ---------------------------------------------------------------------------
create table if not exists cw_scores (
  id uuid primary key default gen_random_uuid(),
  attendee_id uuid not null references cw_attendees(id) on delete cascade,
  version text not null,         -- e.g. 'v1.0'
  reachout_fit smallint check (reachout_fit between 0 and 100),
  influence smallint check (influence between 0 and 100),
  signal_strength smallint check (signal_strength between 0 and 100),
  composite smallint check (composite between 0 and 100),
  rationale text,
  inputs_hash text,              -- so we skip rescoring unchanged inputs
  created_at timestamptz not null default now()
);

create index if not exists cw_scores_attendee_idx on cw_scores (attendee_id);
create index if not exists cw_scores_composite_idx on cw_scores (composite desc);

-- ---------------------------------------------------------------------------
-- cw_signals — news hits, blog posts, social, change-detection
-- ---------------------------------------------------------------------------
create table if not exists cw_signals (
  id uuid primary key default gen_random_uuid(),
  attendee_id uuid references cw_attendees(id) on delete cascade,
  kind text not null check (kind in ('news','blog','social','website_change','regulatory','funding')),
  title text,
  url text,
  source text,                   -- guardian | newsapi | mediastack | serpapi | firecrawl
  excerpt text,
  published_at timestamptz,
  trigger_score smallint check (trigger_score between 0 and 100),
  seen_at timestamptz not null default now()
);

create index if not exists cw_signals_attendee_idx on cw_signals (attendee_id);
create index if not exists cw_signals_kind_idx on cw_signals (kind);
create index if not exists cw_signals_seen_idx on cw_signals (seen_at desc);

-- ---------------------------------------------------------------------------
-- cw_outreach_drafts — Claude-generated outreach, human-reviewed
-- ---------------------------------------------------------------------------
create table if not exists cw_outreach_drafts (
  id uuid primary key default gen_random_uuid(),
  attendee_id uuid not null references cw_attendees(id) on delete cascade,
  angle text not null,           -- intro | investor | journalist | partnership | speaker_followup | event_invite
  channel text not null check (channel in ('email','linkedin','both')),
  subject text,
  body text not null,
  language text default 'en',
  state text not null default 'pending' check (state in ('pending','approved','rejected','sent')),
  reviewer text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists cw_outreach_state_idx on cw_outreach_drafts (state);
create index if not exists cw_outreach_attendee_idx on cw_outreach_drafts (attendee_id);

-- ---------------------------------------------------------------------------
-- cw_discovery_runs — audit log for every agent run
-- ---------------------------------------------------------------------------
create table if not exists cw_discovery_runs (
  id uuid primary key default gen_random_uuid(),
  agent text not null,           -- crawler | search | enricher | scorer | deduper | news-monitor
  provider text,
  input jsonb,
  stats jsonb,                   -- { discovered: 12, created: 5, updated: 7, skipped: 0 }
  errors jsonb,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  ok boolean default true
);

create index if not exists cw_runs_agent_idx on cw_discovery_runs (agent);
create index if not exists cw_runs_started_idx on cw_discovery_runs (started_at desc);

-- ---------------------------------------------------------------------------
-- helpers
-- ---------------------------------------------------------------------------
create or replace function cw_touch_updated_at() returns trigger as $$
begin new.updated_at := now(); return new; end $$ language plpgsql;

drop trigger if exists cw_attendees_touch on cw_attendees;
create trigger cw_attendees_touch
  before update on cw_attendees
  for each row execute function cw_touch_updated_at();

drop trigger if exists cw_events_touch on cw_events;
create trigger cw_events_touch
  before update on cw_events
  for each row execute function cw_touch_updated_at();

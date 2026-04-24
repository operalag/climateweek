export type AttendeeKind = "organization" | "individual";

export type PartnershipTier =
  | "platinum"
  | "gold"
  | "silver"
  | "bronze"
  | "contributor"
  | "community"
  | "academic"
  | "media"
  | null;

export type EnrichmentState = "pending" | "enriching" | "enriched" | "failed";

export interface Attendee {
  id: string;
  kind: AttendeeKind;
  name: string;
  normalized_name: string;
  role?: string | null;
  org_id?: string | null;
  website?: string | null;
  domain?: string | null;
  hq_city?: string | null;
  hq_country?: string | null;
  sector?: string | null;
  partnership_tier?: PartnershipTier;
  linkedin_url?: string | null;
  twitter_url?: string | null;
  bio?: string | null;
  tags?: string[];
  source: string;
  source_url?: string | null;
  first_seen_at: string;
  last_seen_at: string;
  enrichment_state: EnrichmentState;
  created_at: string;
  updated_at: string;
}

export interface CwEvent {
  id: string;
  title: string;
  slug?: string | null;
  date?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  location?: string | null;
  track?: string | null;
  theme?: string | null;
  host_org_id?: string | null;
  url?: string | null;
  description?: string | null;
  source: string;
}

export interface Score {
  id: string;
  attendee_id: string;
  version: string;
  reachout_fit: number;
  influence: number;
  signal_strength: number;
  composite: number;
  rationale?: string;
  inputs_hash?: string;
  created_at: string;
}

export interface Signal {
  id: string;
  attendee_id?: string | null;
  kind: "news" | "blog" | "social" | "website_change" | "regulatory" | "funding";
  title?: string | null;
  url?: string | null;
  source?: string | null;
  excerpt?: string | null;
  published_at?: string | null;
  trigger_score?: number | null;
  seen_at: string;
}

export interface AgentRun<Stats = Record<string, unknown>> {
  started_at: string;
  finished_at: string;
  provider: string;
  stats?: Stats;
}

export interface AgentResult<T, Stats = Record<string, unknown>> {
  ok: boolean;
  items: T[];
  errors: { source: string; message: string }[];
  run: AgentRun<Stats>;
}

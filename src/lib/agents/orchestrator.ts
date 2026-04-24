/**
 * Orchestrator — the only place agents are chained.
 * Writes to Supabase via the service client and logs every run
 * into cw_discovery_runs.
 */
import { getServiceSupabase } from "@/lib/supabase/server";
import { runCrawler, crawlerItemToAttendee } from "./crawler";
import { runSearch } from "./search";
import { runEnricher } from "./enricher";
import { runScorer } from "./scorer";
import { runNewsMonitor } from "./news-monitor";
import { normalizeName } from "@/lib/normalize";
import type { CrawlerItem } from "./crawler";

async function logRun(agent: string, started_at: string, stats: Record<string, unknown>, ok = true, errors: unknown[] = []) {
  try {
    const sb = getServiceSupabase();
    await sb.from("cw_discovery_runs").insert({
      agent,
      started_at,
      finished_at: new Date().toISOString(),
      stats,
      errors: errors.length ? errors : null,
      ok,
    });
  } catch {
    // soft-fail — don't kill the run just because we can't log it
  }
}

/** Discover: crawl + search, upsert cw_attendees + cw_events. */
export async function orchestrateDiscovery(opts: { skipSearch?: boolean } = {}) {
  const started = new Date().toISOString();
  const sb = getServiceSupabase();

  const crawl = await runCrawler();
  let searchHits: Awaited<ReturnType<typeof runSearch>>["items"] = [];
  if (!opts.skipSearch) {
    const search = await runSearch({ limit: 80 });
    searchHits = search.items;
  }

  // Partition crawler items
  const attendees = crawl.items
    .filter((i) => i.kind !== "event")
    .map((i) => crawlerItemToAttendee(i as Exclude<CrawlerItem, { kind: "event" }>))
    .filter((x): x is NonNullable<typeof x> => !!x);
  const events = crawl.items.filter((i): i is Extract<CrawlerItem, { kind: "event" }> => i.kind === "event");

  // Add search hits as attendees
  for (const h of searchHits) {
    attendees.push({
      kind: h.kind,
      name: h.name,
      normalized_name: normalizeName(h.name),
      role: h.role ?? null,
      source: h.source,
      source_url: h.source_url ?? null,
      enrichment_state: "pending",
      tags: ["cwz:2026", `source:${h.source}`],
    });
  }

  // Dedupe the in-memory batch before upsert — multiple seed pages can
  // surface the same entity (e.g. UBS as a sponsor AND as a speaker's org).
  // Postgres rejects "ON CONFLICT DO UPDATE" hitting the same row twice.
  const deduped = new Map<string, (typeof attendees)[number]>();
  for (const a of attendees) {
    const key = `${a.kind}|${a.normalized_name}`;
    const prev = deduped.get(key);
    if (!prev) {
      deduped.set(key, a);
      continue;
    }
    // merge: prefer non-null / richer values
    deduped.set(key, {
      ...prev,
      ...a,
      partnership_tier: prev.partnership_tier ?? a.partnership_tier ?? null,
      role: prev.role ?? a.role ?? null,
      tags: Array.from(new Set([...(prev.tags ?? []), ...(a.tags ?? [])])),
    });
  }
  const attendeesUnique = [...deduped.values()];

  // Upsert attendees
  const { error: aErr, data: aData } = await sb
    .from("cw_attendees")
    .upsert(attendeesUnique, { onConflict: "kind,normalized_name", ignoreDuplicates: false })
    .select("id,name,normalized_name");

  // PostgreSQL `date` is strict — coerce unparseable values to null.
  const coerceDate = (d?: string | null): string | null => {
    if (!d) return null;
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d);
    return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
  };

  const { error: eErr } = await sb.from("cw_events").upsert(
    events.map((e) => ({
      title: e.title,
      slug: e.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 80),
      date: coerceDate(e.date),
      location: e.location ?? null,
      track: e.track ?? null,
      url: e.source_url,
      source: e.source,
    })),
    { onConflict: "slug" },
  );

  const stats = {
    crawler_items: crawl.items.length,
    search_hits: searchHits.length,
    attendees_upserted: aData?.length ?? 0,
    events_upserted: events.length,
  };
  await logRun("orchestrator:discovery", started, stats, !aErr && !eErr, [...crawl.errors]);
  return { stats, errors: [...crawl.errors, ...(aErr ? [aErr] : []), ...(eErr ? [eErr] : [])] };
}

/** Enrich: pick N pending orgs, enrich via Perplexity/Apollo/Firecrawl. */
export async function orchestrateEnrich(limit = 20) {
  const started = new Date().toISOString();
  const sb = getServiceSupabase();

  const { data: pending } = await sb
    .from("cw_attendees")
    .select("id,name,kind")
    .eq("kind", "organization")
    .eq("enrichment_state", "pending")
    .limit(limit);

  if (!pending?.length) {
    await logRun("orchestrator:enrich", started, { pending: 0 });
    return { stats: { pending: 0, enriched: 0 }, errors: [] };
  }

  // mark as enriching
  await sb.from("cw_attendees").update({ enrichment_state: "enriching" }).in("id", pending.map((p) => p.id));

  const result = await runEnricher({ attendees: pending, limit });

  for (const r of result.items) {
    if (!r.enriched) {
      await sb.from("cw_attendees").update({ enrichment_state: "failed" }).eq("id", r.id);
      continue;
    }
    await sb
      .from("cw_attendees")
      .update({
        website: r.enriched.website,
        domain: r.enriched.domain,
        linkedin_url: r.enriched.linkedin_url,
        hq_city: r.enriched.hq_city,
        hq_country: r.enriched.hq_country,
        sector: r.enriched.sector,
        bio: r.enriched.short_description,
        enrichment_state: "enriched",
      })
      .eq("id", r.id);

    await sb.from("cw_enrichments").insert({
      attendee_id: r.id,
      provider: "perplexity+apollo",
      kind: "profile",
      payload: r.enriched,
    });

    // add contacts as individuals
    if (r.people?.length) {
      for (const p of r.people) {
        if (!p.name) continue;
        await sb.from("cw_attendees").upsert(
          {
            kind: "individual",
            name: p.name,
            normalized_name: normalizeName(p.name),
            role: p.title,
            org_id: r.id,
            linkedin_url: p.linkedin_url,
            source: "enricher:apollo",
            source_url: p.linkedin_url,
            enrichment_state: "enriched",
            tags: ["cwz:2026", "source:apollo"],
          },
          { onConflict: "kind,normalized_name", ignoreDuplicates: true },
        );
      }
    }
  }

  const stats = { pending: pending.length, enriched: result.items.filter((r) => r.enriched).length };
  await logRun("orchestrator:enrich", started, stats, result.ok, result.errors);
  return { stats, errors: result.errors };
}

/** Score: pick the N most-recently enriched attendees and score them. */
export async function orchestrateScore(limit = 50) {
  const started = new Date().toISOString();
  const sb = getServiceSupabase();

  const { data } = await sb
    .from("cw_attendees")
    .select("id,name,kind,role,partnership_tier,sector,bio")
    .eq("enrichment_state", "enriched")
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (!data?.length) {
    await logRun("orchestrator:score", started, { scored: 0 });
    return { stats: { scored: 0 }, errors: [] };
  }

  const result = await runScorer({
    attendees: data.map((a) => ({
      id: a.id,
      kind: a.kind,
      name: a.name,
      role: a.role,
      partnership_tier: a.partnership_tier,
      sector: a.sector,
      short_description: a.bio,
    })),
  });

  for (const r of result.items) {
    await sb.from("cw_scores").insert({
      attendee_id: r.id,
      version: r.score.version,
      reachout_fit: r.score.reachout_fit,
      influence: r.score.influence,
      signal_strength: r.score.signal_strength,
      composite: r.score.composite,
      rationale: r.score.rationale,
    });
  }

  const stats = { scored: result.items.length };
  await logRun("orchestrator:score", started, stats, result.ok, result.errors);
  return { stats, errors: result.errors };
}

/** News monitor: fan out across news providers for every attendee. */
export async function orchestrateNews(limit = 25) {
  const started = new Date().toISOString();
  const sb = getServiceSupabase();
  const { data } = await sb
    .from("cw_attendees")
    .select("id,name")
    .eq("kind", "organization")
    .eq("enrichment_state", "enriched")
    .limit(limit);

  if (!data?.length) {
    await logRun("orchestrator:news", started, { signals: 0 });
    return { stats: { signals: 0 }, errors: [] };
  }

  const result = await runNewsMonitor({ attendees: data });
  // Coerce published_at — SerpAPI returns "3 days ago" strings that break timestamptz.
  const toIso = (v: unknown): string | null => {
    if (!v || typeof v !== "string") return null;
    const d = new Date(v);
    return Number.isFinite(d.getTime()) ? d.toISOString() : null;
  };
  const rows = result.items.map((s) => ({ ...s, published_at: toIso(s.published_at) }));
  let inserted = 0;
  if (rows.length) {
    for (let i = 0; i < rows.length; i += 100) {
      const chunk = rows.slice(i, i + 100);
      const { error, data: inData } = await sb
        .from("cw_signals")
        .insert(chunk)
        .select("id");
      if (error) {
        result.errors.push({ source: "cw_signals.insert", message: error.message });
      } else {
        inserted += inData?.length ?? 0;
      }
    }
  }
  const stats = { gathered: result.items.length, inserted };
  await logRun("orchestrator:news", started, stats, result.ok, result.errors);
  return { stats, errors: result.errors };
}

/** Full pipeline: discovery → enrich → news → score. */
export async function orchestrateFull(opts: { enrichLimit?: number; newsLimit?: number; scoreLimit?: number } = {}) {
  const a = await orchestrateDiscovery();
  const b = await orchestrateEnrich(opts.enrichLimit ?? 20);
  const c = await orchestrateNews(opts.newsLimit ?? 25);
  const d = await orchestrateScore(opts.scoreLimit ?? 50);
  return { discovery: a, enrich: b, news: c, score: d };
}

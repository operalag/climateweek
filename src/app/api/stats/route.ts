import { NextResponse } from "next/server";
import { tryGetServiceSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET() {
  const sb = tryGetServiceSupabase();
  if (!sb) return NextResponse.json({ configured: false });

  const [orgs, people, enriched, scored, signals, events] = await Promise.all([
    sb.from("cw_attendees").select("id", { count: "exact", head: true }).eq("kind", "organization"),
    sb.from("cw_attendees").select("id", { count: "exact", head: true }).eq("kind", "individual"),
    sb.from("cw_attendees").select("id", { count: "exact", head: true }).eq("enrichment_state", "enriched"),
    sb.from("cw_scores").select("id", { count: "exact", head: true }),
    sb.from("cw_signals").select("id", { count: "exact", head: true }),
    sb.from("cw_events").select("id", { count: "exact", head: true }),
  ]);

  return NextResponse.json({
    configured: true,
    organizations: orgs.count ?? 0,
    individuals: people.count ?? 0,
    enriched: enriched.count ?? 0,
    scored: scored.count ?? 0,
    signals: signals.count ?? 0,
    events: events.count ?? 0,
  });
}

import { KpiCard } from "@/components/shared/KpiCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { tryGetServiceSupabase } from "@/lib/supabase/server";
import { CWZ } from "@/lib/constants";
import Link from "next/link";

export const dynamic = "force-dynamic";

async function getStats() {
  const sb = tryGetServiceSupabase();
  if (!sb) return null;
  const [orgs, people, enriched, scored, signals, events] = await Promise.all([
    sb.from("cw_attendees").select("id", { count: "exact", head: true }).eq("kind", "organization"),
    sb.from("cw_attendees").select("id", { count: "exact", head: true }).eq("kind", "individual"),
    sb.from("cw_attendees").select("id", { count: "exact", head: true }).eq("enrichment_state", "enriched"),
    sb.from("cw_scores").select("id", { count: "exact", head: true }),
    sb.from("cw_signals").select("id", { count: "exact", head: true }),
    sb.from("cw_events").select("id", { count: "exact", head: true }),
  ]);
  return {
    organizations: orgs.count ?? 0,
    individuals: people.count ?? 0,
    enriched: enriched.count ?? 0,
    scored: scored.count ?? 0,
    signals: signals.count ?? 0,
    events: events.count ?? 0,
  };
}

async function getTopScored() {
  const sb = tryGetServiceSupabase();
  if (!sb) return [];
  const { data } = await sb
    .from("cw_scores")
    .select("attendee_id, composite, rationale, cw_attendees!inner(id,name,kind,partnership_tier,sector)")
    .order("composite", { ascending: false })
    .limit(10);
  return data ?? [];
}

export default async function Home() {
  const stats = await getStats();
  const top = await getTopScored();

  if (!stats) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Climate Week Zurich {CWZ.year}</h1>
        <EmptyState title="Supabase not configured">
          Add <code>NEXT_PUBLIC_SUPABASE_URL</code>, <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>,
          and <code>SUPABASE_SERVICE_KEY</code> to <code>.env.local</code>, then apply{" "}
          <code>supabase/migrations/001_climateweek_init.sql</code>.
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <div className="text-sm" style={{ color: "var(--text-dim)" }}>
            {CWZ.startDate} → {CWZ.endDate} · Zurich
          </div>
        </div>
        <div className="flex gap-2">
          <RunButton path="/api/discover" label="Run discovery" />
          <RunButton path="/api/enrich" label="Enrich 20" />
          <RunButton path="/api/score" label="Score 50" />
        </div>
      </div>

      <section className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <KpiCard label="Organizations" value={stats.organizations} />
        <KpiCard label="Individuals" value={stats.individuals} />
        <KpiCard label="Events" value={stats.events} />
        <KpiCard label="Enriched" value={stats.enriched} />
        <KpiCard label="Scored" value={stats.scored} />
        <KpiCard label="Signals" value={stats.signals} />
      </section>

      <section>
        <h2 className="text-lg font-medium mb-3">Top scored attendees</h2>
        {top.length === 0 ? (
          <EmptyState title="No scores yet">
            Kick off the pipeline — <Link href="/runs" className="underline">Runs</Link>.
          </EmptyState>
        ) : (
          <div className="panel overflow-hidden">
            <table className="w-full text-sm">
              <thead style={{ color: "var(--text-dim)" }}>
                <tr className="text-left">
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Kind</th>
                  <th className="px-3 py-2">Tier / Sector</th>
                  <th className="px-3 py-2 w-40">Score</th>
                </tr>
              </thead>
              <tbody>
                {top.map((row: any) => (
                  <tr key={row.attendee_id} className="border-t" style={{ borderColor: "var(--border)" }}>
                    <td className="px-3 py-2">
                      <Link href={`/attendees/${row.cw_attendees.id}`} className="hover:underline">
                        {row.cw_attendees.name}
                      </Link>
                    </td>
                    <td className="px-3 py-2" style={{ color: "var(--text-dim)" }}>
                      {row.cw_attendees.kind}
                    </td>
                    <td className="px-3 py-2">
                      {row.cw_attendees.partnership_tier ? (
                        <span className={`chip tier-${row.cw_attendees.partnership_tier}`}>
                          {row.cw_attendees.partnership_tier}
                        </span>
                      ) : (
                        <span className="chip">{row.cw_attendees.sector ?? "—"}</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <div className="score-bar flex-1">
                          <span style={{ width: `${row.composite}%` }} />
                        </div>
                        <span className="tabular-nums text-xs" style={{ color: "var(--text-dim)" }}>
                          {row.composite}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function RunButton({ path, label }: { path: string; label: string }) {
  return (
    <form action={path} method="post">
      <button
        type="submit"
        className="text-xs px-3 py-1.5 rounded-md border hover:opacity-100 opacity-90"
        style={{ borderColor: "var(--border)", background: "var(--panel)" }}
      >
        {label}
      </button>
    </form>
  );
}

import { tryGetServiceSupabase } from "@/lib/supabase/server";
import { EmptyState } from "@/components/shared/EmptyState";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function ScoringPage() {
  const sb = tryGetServiceSupabase();
  if (!sb) return <EmptyState title="Supabase not configured" />;
  const { data } = await sb
    .from("cw_scores")
    .select("*, cw_attendees!inner(id,name,kind,partnership_tier,sector)")
    .order("composite", { ascending: false })
    .limit(200);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Scoring</h1>
      {!data?.length ? (
        <EmptyState title="No scores yet">
          Run <code>POST /api/score</code>.
        </EmptyState>
      ) : (
        <div className="panel overflow-x-auto">
          <table className="w-full text-sm">
            <thead style={{ color: "var(--text-dim)" }}>
              <tr className="text-left">
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Fit</th>
                <th className="px-3 py-2">Influence</th>
                <th className="px-3 py-2">Signal</th>
                <th className="px-3 py-2">Composite</th>
                <th className="px-3 py-2">Rationale</th>
              </tr>
            </thead>
            <tbody>
              {data.map((s: any) => (
                <tr key={s.id} className="border-t" style={{ borderColor: "var(--border)" }}>
                  <td className="px-3 py-2">
                    <Link href={`/attendees/${s.cw_attendees.id}`} className="hover:underline">
                      {s.cw_attendees.name}
                    </Link>
                  </td>
                  <td className="px-3 py-2 tabular-nums">{s.reachout_fit}</td>
                  <td className="px-3 py-2 tabular-nums">{s.influence}</td>
                  <td className="px-3 py-2 tabular-nums">{s.signal_strength}</td>
                  <td className="px-3 py-2 tabular-nums font-medium">{s.composite}</td>
                  <td className="px-3 py-2 text-xs" style={{ color: "var(--text-dim)" }}>
                    {s.rationale}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

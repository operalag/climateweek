import { tryGetServiceSupabase } from "@/lib/supabase/server";
import { EmptyState } from "@/components/shared/EmptyState";

export const dynamic = "force-dynamic";

export default async function RunsPage() {
  const sb = tryGetServiceSupabase();
  if (!sb) return <EmptyState title="Supabase not configured" />;
  const { data } = await sb
    .from("cw_discovery_runs")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(100);

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between">
        <h1 className="text-2xl font-semibold">Agent runs</h1>
        <div className="flex gap-2">
          <RunButton path="/api/discover" label="Discover" />
          <RunButton path="/api/enrich" label="Enrich 20" />
          <RunButton path="/api/signals" label="News 25" />
          <RunButton path="/api/score" label="Score 50" />
          <RunButton path="/api/run" label="Run full" />
        </div>
      </div>
      {!data?.length ? (
        <EmptyState title="No runs yet">Trigger one above.</EmptyState>
      ) : (
        <div className="panel overflow-x-auto">
          <table className="w-full text-sm">
            <thead style={{ color: "var(--text-dim)" }}>
              <tr className="text-left">
                <th className="px-3 py-2">Started</th>
                <th className="px-3 py-2">Agent</th>
                <th className="px-3 py-2">OK</th>
                <th className="px-3 py-2">Stats</th>
              </tr>
            </thead>
            <tbody>
              {data.map((r) => (
                <tr key={r.id} className="border-t" style={{ borderColor: "var(--border)" }}>
                  <td className="px-3 py-2 text-xs whitespace-nowrap" style={{ color: "var(--text-dim)" }}>
                    {new Date(r.started_at).toLocaleString()}
                  </td>
                  <td className="px-3 py-2">{r.agent}</td>
                  <td className="px-3 py-2">{r.ok ? "✓" : "✗"}</td>
                  <td className="px-3 py-2 text-xs font-mono" style={{ color: "var(--text-dim)" }}>
                    {JSON.stringify(r.stats)}
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

function RunButton({ path, label }: { path: string; label: string }) {
  return (
    <form action={path} method="post">
      <button
        type="submit"
        className="text-xs px-3 py-1.5 rounded-md border"
        style={{ borderColor: "var(--border)", background: "var(--panel)" }}
      >
        {label}
      </button>
    </form>
  );
}

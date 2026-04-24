import { tryGetServiceSupabase } from "@/lib/supabase/server";
import { EmptyState } from "@/components/shared/EmptyState";

export const dynamic = "force-dynamic";

export default async function EventsPage() {
  const sb = tryGetServiceSupabase();
  if (!sb) return <EmptyState title="Supabase not configured" />;
  const { data } = await sb.from("cw_events").select("*").order("date").limit(300);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Events</h1>
      {!data?.length ? (
        <EmptyState title="No events yet">
          Run <code>POST /api/discover</code>.
        </EmptyState>
      ) : (
        <div className="panel overflow-x-auto">
          <table className="w-full text-sm">
            <thead style={{ color: "var(--text-dim)" }}>
              <tr className="text-left">
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Title</th>
                <th className="px-3 py-2">Track</th>
                <th className="px-3 py-2">Location</th>
              </tr>
            </thead>
            <tbody>
              {data.map((e) => (
                <tr key={e.id} className="border-t" style={{ borderColor: "var(--border)" }}>
                  <td className="px-3 py-2 whitespace-nowrap" style={{ color: "var(--text-dim)" }}>
                    {e.date ?? "—"}
                  </td>
                  <td className="px-3 py-2">
                    {e.url ? (
                      <a href={e.url} target="_blank" rel="noreferrer" className="hover:underline">
                        {e.title}
                      </a>
                    ) : (
                      e.title
                    )}
                  </td>
                  <td className="px-3 py-2" style={{ color: "var(--text-dim)" }}>
                    {e.track ?? "—"}
                  </td>
                  <td className="px-3 py-2" style={{ color: "var(--text-dim)" }}>
                    {e.location ?? "—"}
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

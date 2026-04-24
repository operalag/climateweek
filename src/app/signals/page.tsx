import { tryGetServiceSupabase } from "@/lib/supabase/server";
import { EmptyState } from "@/components/shared/EmptyState";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function SignalsPage() {
  const sb = tryGetServiceSupabase();
  if (!sb) return <EmptyState title="Supabase not configured" />;
  const { data } = await sb
    .from("cw_signals")
    .select("*, cw_attendees(id,name)")
    .order("seen_at", { ascending: false })
    .limit(200);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Signals</h1>
      {!data?.length ? (
        <EmptyState title="No signals yet">
          Run <code>POST /api/signals</code>.
        </EmptyState>
      ) : (
        <ul className="space-y-2">
          {data.map((s: any) => (
            <li key={s.id} className="panel p-3 text-sm">
              <div className="flex items-center justify-between gap-4">
                <a href={s.url ?? "#"} target="_blank" rel="noreferrer" className="hover:underline">
                  {s.title}
                </a>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="chip">{s.source}</span>
                  <span className="chip">trigger {s.trigger_score ?? "—"}</span>
                </div>
              </div>
              <div className="mt-1 text-xs flex items-center gap-3" style={{ color: "var(--text-dim)" }}>
                {s.cw_attendees ? (
                  <Link href={`/attendees/${s.cw_attendees.id}`} className="hover:underline">
                    {s.cw_attendees.name}
                  </Link>
                ) : null}
                <span>{s.published_at ?? s.seen_at}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

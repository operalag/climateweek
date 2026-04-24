import { tryGetServiceSupabase } from "@/lib/supabase/server";
import { EmptyState } from "@/components/shared/EmptyState";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function OutreachPage() {
  const sb = tryGetServiceSupabase();
  if (!sb) return <EmptyState title="Supabase not configured" />;
  const { data } = await sb
    .from("cw_outreach_drafts")
    .select("*, cw_attendees(id,name,kind)")
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Outreach · review queue</h1>
      {!data?.length ? (
        <EmptyState title="No drafts yet">
          Call <code>POST /api/outreach</code> with an array of <code>attendee_ids</code>.
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          {data.map((d: any) => (
            <li key={d.id} className="panel p-4">
              <div className="flex items-center justify-between">
                <Link href={`/attendees/${d.cw_attendees?.id}`} className="font-medium hover:underline">
                  {d.cw_attendees?.name}
                </Link>
                <div className="flex items-center gap-2">
                  <span className="chip">{d.angle}</span>
                  <span className="chip">{d.channel}</span>
                  <span className="chip">{d.state}</span>
                </div>
              </div>
              {d.subject ? (
                <div className="mt-2 text-xs" style={{ color: "var(--text-dim)" }}>
                  Subject: {d.subject}
                </div>
              ) : null}
              <pre className="mt-2 whitespace-pre-wrap text-sm">{d.body}</pre>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

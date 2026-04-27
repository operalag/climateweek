import { tryGetServiceSupabase } from "@/lib/supabase/server";
import { EmptyState } from "@/components/shared/EmptyState";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function AttendeePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = tryGetServiceSupabase();
  if (!sb) return <EmptyState title="Supabase not configured" />;

  const [{ data: attendee }, { data: scores }, { data: signals }, { data: drafts }, { data: events }] =
    await Promise.all([
      sb.from("cw_attendees").select("*").eq("id", id).single(),
      sb.from("cw_scores").select("*").eq("attendee_id", id).order("created_at", { ascending: false }).limit(5),
      sb.from("cw_signals").select("*").eq("attendee_id", id).order("seen_at", { ascending: false }).limit(15),
      sb.from("cw_outreach_drafts").select("*").eq("attendee_id", id).order("created_at", { ascending: false }).limit(10),
      sb
        .from("cw_event_attendees")
        .select("relation, cw_events(id,title,date,start_time,location,theme,track)")
        .eq("attendee_id", id),
    ]);

  if (!attendee) return notFound();
  const latest = scores?.[0];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>
            {attendee.kind}
          </div>
          <h1 className="text-3xl font-semibold">{attendee.name}</h1>
          <div className="mt-1 text-sm" style={{ color: "var(--text-dim)" }}>
            {[attendee.role, attendee.sector, attendee.hq_city, attendee.hq_country]
              .filter(Boolean)
              .join(" · ") || "—"}
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {attendee.partnership_tier ? (
              <span className={`chip tier-${attendee.partnership_tier}`}>{attendee.partnership_tier}</span>
            ) : null}
            {(attendee.tags ?? []).map((t: string) => (
              <span key={t} className="chip">{t}</span>
            ))}
          </div>
        </div>
        {latest ? (
          <div className="panel p-4 w-64">
            <div className="text-xs" style={{ color: "var(--text-dim)" }}>Composite score</div>
            <div className="text-4xl font-semibold">{latest.composite}</div>
            <div className="mt-2 space-y-1 text-xs">
              <Row k="Reachout fit" v={latest.reachout_fit} />
              <Row k="Influence" v={latest.influence} />
              <Row k="Signal strength" v={latest.signal_strength} />
            </div>
          </div>
        ) : null}
      </div>

      {attendee.bio ? (
        <section className="panel p-4">
          <div className="text-xs uppercase tracking-wide mb-2" style={{ color: "var(--text-dim)" }}>About</div>
          <p className="text-sm whitespace-pre-wrap">{attendee.bio}</p>
        </section>
      ) : null}

      {events?.length ? (
        <section>
          <h2 className="text-lg font-medium mb-2">
            CWZ events <span style={{ color: "var(--text-dim)" }}>({events.length})</span>
          </h2>
          <ul className="space-y-2">
            {events.map((e: any, i: number) =>
              e.cw_events ? (
                <li key={`${e.cw_events.id}-${i}`} className="panel p-3 text-sm flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <a href={`/events/${e.cw_events.id}`} className="font-medium hover:underline">
                      {e.cw_events.title}
                    </a>
                    <div className="mt-1 text-xs" style={{ color: "var(--text-dim)" }}>
                      {[e.cw_events.date, e.cw_events.start_time, e.cw_events.location].filter(Boolean).join(" · ")}
                    </div>
                  </div>
                  <span className="chip">{e.relation}</span>
                </li>
              ) : null,
            )}
          </ul>
        </section>
      ) : null}

      <section>
        <h2 className="text-lg font-medium mb-2">Signals</h2>
        {signals?.length ? (
          <ul className="space-y-2">
            {signals.map((s) => (
              <li key={s.id} className="panel p-3 text-sm">
                <div className="flex items-center justify-between">
                  <a href={s.url ?? "#"} target="_blank" rel="noreferrer" className="hover:underline">
                    {s.title}
                  </a>
                  <span className="chip">{s.source}</span>
                </div>
                <div className="mt-1 text-xs" style={{ color: "var(--text-dim)" }}>
                  {s.published_at ?? s.seen_at} · trigger: {s.trigger_score ?? "—"}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="No signals yet">Run the news monitor.</EmptyState>
        )}
      </section>

      <section>
        <h2 className="text-lg font-medium mb-2">Outreach drafts</h2>
        {drafts?.length ? (
          <ul className="space-y-2">
            {drafts.map((d) => (
              <li key={d.id} className="panel p-3 text-sm">
                <div className="flex items-center justify-between">
                  <div className="font-medium">
                    {d.angle} · {d.channel}
                  </div>
                  <span className="chip">{d.state}</span>
                </div>
                {d.subject ? <div className="mt-1 text-xs" style={{ color: "var(--text-dim)" }}>Subject: {d.subject}</div> : null}
                <pre className="mt-2 whitespace-pre-wrap text-sm">{d.body}</pre>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="No drafts yet">Generate drafts for this attendee.</EmptyState>
        )}
      </section>
    </div>
  );
}

function Row({ k, v }: { k: string; v: number | null }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span style={{ color: "var(--text-dim)" }}>{k}</span>
      <div className="flex items-center gap-2 flex-1 max-w-[140px]">
        <div className="score-bar flex-1">
          <span style={{ width: `${v ?? 0}%` }} />
        </div>
        <span className="tabular-nums">{v ?? "—"}</span>
      </div>
    </div>
  );
}

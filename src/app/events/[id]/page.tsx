import Link from "next/link";
import { notFound } from "next/navigation";
import { tryGetServiceSupabase } from "@/lib/supabase/server";
import { EmptyState } from "@/components/shared/EmptyState";

export const dynamic = "force-dynamic";

type EventLinkRow = {
  relation: string;
  cw_attendees:
    | { id: string; name: string; kind: string; role?: string | null }
    | { id: string; name: string; kind: string; role?: string | null }[]
    | null;
};

const oneAttendee = (row: EventLinkRow["cw_attendees"]) =>
  Array.isArray(row) ? row[0] ?? null : row;

export default async function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = tryGetServiceSupabase();
  if (!sb) return <EmptyState title="Supabase not configured" />;

  const [{ data: event }, { data: links }] = await Promise.all([
    sb.from("cw_events").select("*").eq("id", id).single(),
    sb
      .from("cw_event_attendees")
      .select("relation, cw_attendees(id,name,kind,role)")
      .eq("event_id", id),
  ]);

  if (!event) return notFound();
  const rows = (links ?? []) as EventLinkRow[];
  const speakers = rows.filter(
    (l) => l.relation === "speaker" || l.relation === "panelist" || l.relation === "moderator",
  );
  const hostRow = rows.find((l) => l.relation === "host");
  const hostAttendee = hostRow ? oneAttendee(hostRow.cw_attendees) : null;

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>
          Climate Week Zurich event
        </div>
        <h1 className="text-3xl font-semibold mt-1">{event.title}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {event.date ? <span className="chip">{event.date}</span> : null}
          {event.start_time ? (
            <span className="chip">
              {event.start_time}
              {event.end_time ? `–${event.end_time}` : ""}
            </span>
          ) : null}
          {event.location ? <span className="chip">{event.location}</span> : null}
          {event.theme || event.track ? <span className="chip">{event.theme ?? event.track}</span> : null}
          {event.url ? (
            <a href={event.url} target="_blank" rel="noreferrer" className="chip hover:underline">
              source ↗
            </a>
          ) : null}
        </div>
      </div>

      {hostAttendee ? (
        <section className="panel p-4">
          <div className="text-xs uppercase tracking-wide mb-1" style={{ color: "var(--text-dim)" }}>
            Hosted by
          </div>
          <Link href={`/attendees/${hostAttendee.id}`} className="font-medium hover:underline">
            {hostAttendee.name}
          </Link>
        </section>
      ) : null}

      {event.description ? (
        <section className="panel p-4">
          <div className="text-xs uppercase tracking-wide mb-2" style={{ color: "var(--text-dim)" }}>
            About
          </div>
          <p className="text-sm whitespace-pre-wrap">{event.description}</p>
        </section>
      ) : null}

      <section>
        <h2 className="text-lg font-medium mb-3">
          Speakers <span style={{ color: "var(--text-dim)" }}>({speakers.length})</span>
        </h2>
        {speakers.length === 0 ? (
          <EmptyState title="No speakers extracted yet">
            Re-run <code>POST /api/events/scrape</code>.
          </EmptyState>
        ) : (
          <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {speakers.map((s, i) => {
              const a = oneAttendee(s.cw_attendees);
              if (!a) return null;
              return (
                <li key={`${a.id}-${i}`} className="panel p-3">
                  <Link href={`/attendees/${a.id}`} className="font-medium hover:underline">
                    {a.name}
                  </Link>
                  {a.role ? (
                    <div className="mt-1 text-xs" style={{ color: "var(--text-dim)" }}>
                      {a.role}
                    </div>
                  ) : null}
                  <div className="mt-2 flex items-center gap-1">
                    <span className="chip">{s.relation}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

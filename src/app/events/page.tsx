import Link from "next/link";
import { tryGetServiceSupabase } from "@/lib/supabase/server";
import { EmptyState } from "@/components/shared/EmptyState";
import { CWZ } from "@/lib/constants";

export const dynamic = "force-dynamic";

type Params = Promise<{ [k: string]: string | string[] | undefined }>;

interface EventRow {
  id: string;
  title: string;
  slug: string | null;
  date: string | null;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  theme: string | null;
  track: string | null;
  description: string | null;
  url: string | null;
}

export default async function EventsPage({ searchParams }: { searchParams: Params }) {
  const p = await searchParams;
  const day = (p.day as string) ?? "";
  const theme = (p.theme as string) ?? "";
  const q = (p.q as string) ?? "";

  const sb = tryGetServiceSupabase();
  if (!sb) return <EmptyState title="Supabase not configured" />;

  let query = sb
    .from("cw_events")
    .select("id,title,slug,date,start_time,end_time,location,theme,track,description,url")
    .order("date", { ascending: true, nullsFirst: false })
    .order("start_time", { ascending: true, nullsFirst: false })
    .limit(500);
  if (day) query = query.eq("date", day);
  if (theme) query = query.or(`theme.eq.${theme},track.eq.${theme}`);
  if (q) query = query.ilike("title", `%${q}%`);

  const { data, error } = await query;
  const rows: EventRow[] = (data ?? []) as EventRow[];

  const themes = Array.from(
    new Set(
      rows
        .map((e) => e.theme || e.track)
        .filter((x): x is string => !!x),
    ),
  ).sort();

  const days = ["2026-05-04", "2026-05-05", "2026-05-06", "2026-05-07", "2026-05-08", "2026-05-09"];

  // Group by date
  const byDate = new Map<string, EventRow[]>();
  for (const e of rows) {
    const k = e.date ?? "Date TBA";
    const arr = byDate.get(k) ?? [];
    arr.push(e);
    byDate.set(k, arr);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Events</h1>
          <div className="text-sm" style={{ color: "var(--text-dim)" }}>
            {rows.length} events · {CWZ.startDate} → {CWZ.endDate}
          </div>
        </div>
        <form className="flex items-center gap-2 text-sm flex-wrap">
          <select name="day" defaultValue={day} className="bg-transparent border rounded px-2 py-1" style={{ borderColor: "var(--border)" }}>
            <option value="">All days</option>
            {days.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
          <select name="theme" defaultValue={theme} className="bg-transparent border rounded px-2 py-1" style={{ borderColor: "var(--border)" }}>
            <option value="">All themes</option>
            {themes.map((t) => (
              <option key={t} value={t}>{t.length > 40 ? t.slice(0, 40) + "…" : t}</option>
            ))}
          </select>
          <input
            name="q"
            defaultValue={q}
            placeholder="search title…"
            className="bg-transparent border rounded px-2 py-1"
            style={{ borderColor: "var(--border)" }}
          />
          <button type="submit" className="border rounded px-3 py-1" style={{ borderColor: "var(--border)" }}>
            Filter
          </button>
        </form>
      </div>

      {error ? (
        <EmptyState title="Query failed">{error.message}</EmptyState>
      ) : rows.length === 0 ? (
        <EmptyState title="No events yet">
          Run <code>POST /api/events/harvest</code> then <code>/api/events/scrape</code>.
        </EmptyState>
      ) : (
        <div className="space-y-6">
          {[...byDate.entries()].map(([d, evs]) => (
            <section key={d}>
              <div className="text-xs uppercase tracking-wide mb-2" style={{ color: "var(--text-dim)" }}>
                {d}
              </div>
              <ul className="space-y-2">
                {evs.map((e) => (
                  <li key={e.id} className="panel p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <Link href={`/events/${e.id}`} className="font-medium hover:underline">
                          {e.title}
                        </Link>
                        {e.description ? (
                          <div
                            className="mt-1 text-sm line-clamp-2"
                            style={{ color: "var(--text-dim)" }}
                          >
                            {e.description.slice(0, 220)}
                          </div>
                        ) : null}
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          {e.start_time ? (
                            <span className="chip">
                              {e.start_time}
                              {e.end_time ? `–${e.end_time}` : ""}
                            </span>
                          ) : null}
                          {e.location ? (
                            <span className="chip" title={e.location}>
                              {e.location.slice(0, 40)}
                            </span>
                          ) : null}
                          {e.theme || e.track ? (
                            <span className="chip">{e.theme ?? e.track}</span>
                          ) : null}
                        </div>
                      </div>
                      {e.url ? (
                        <a
                          href={e.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs whitespace-nowrap"
                          style={{ color: "var(--text-dim)" }}
                        >
                          source ↗
                        </a>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

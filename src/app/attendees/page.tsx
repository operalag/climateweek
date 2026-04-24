import Link from "next/link";
import { tryGetServiceSupabase } from "@/lib/supabase/server";
import { EmptyState } from "@/components/shared/EmptyState";

export const dynamic = "force-dynamic";

type Params = Promise<{ [k: string]: string | string[] | undefined }>;

export default async function AttendeesPage({ searchParams }: { searchParams: Params }) {
  const p = await searchParams;
  const kind = (p.kind as string) ?? "organization";
  const sector = (p.sector as string) ?? "";
  const tier = (p.tier as string) ?? "";
  const q = (p.q as string) ?? "";

  const sb = tryGetServiceSupabase();
  if (!sb) return <EmptyState title="Supabase not configured">See README.</EmptyState>;

  let query = sb
    .from("cw_attendees")
    .select("id,name,kind,role,partnership_tier,sector,hq_city,hq_country,website,enrichment_state")
    .order("updated_at", { ascending: false })
    .limit(200);
  if (kind) query = query.eq("kind", kind);
  if (sector) query = query.eq("sector", sector);
  if (tier) query = query.eq("partnership_tier", tier);
  if (q) query = query.ilike("name", `%${q}%`);

  const { data, error } = await query;

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between">
        <h1 className="text-2xl font-semibold">Attendees</h1>
        <form className="flex items-center gap-2 text-sm">
          <select name="kind" defaultValue={kind} className="bg-transparent border rounded px-2 py-1" style={{ borderColor: "var(--border)" }}>
            <option value="organization">Organizations</option>
            <option value="individual">Individuals</option>
          </select>
          <select name="tier" defaultValue={tier} className="bg-transparent border rounded px-2 py-1" style={{ borderColor: "var(--border)" }}>
            <option value="">Any tier</option>
            {["platinum","gold","silver","bronze","contributor","community","academic","media"].map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <input
            name="q"
            defaultValue={q}
            placeholder="search name…"
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
      ) : !data?.length ? (
        <EmptyState title="No attendees yet">
          Run <code>POST /api/discover</code> to seed from the Climate Week site.
        </EmptyState>
      ) : (
        <div className="panel overflow-x-auto">
          <table className="w-full text-sm">
            <thead style={{ color: "var(--text-dim)" }}>
              <tr className="text-left">
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Role / Sector</th>
                <th className="px-3 py-2">HQ</th>
                <th className="px-3 py-2">Tier</th>
                <th className="px-3 py-2">State</th>
              </tr>
            </thead>
            <tbody>
              {data.map((a) => (
                <tr key={a.id} className="border-t" style={{ borderColor: "var(--border)" }}>
                  <td className="px-3 py-2">
                    <Link href={`/attendees/${a.id}`} className="hover:underline">
                      {a.name}
                    </Link>
                    {a.website ? (
                      <a
                        href={a.website}
                        target="_blank"
                        rel="noreferrer"
                        className="ml-2 text-xs"
                        style={{ color: "var(--text-dim)" }}
                      >
                        ↗
                      </a>
                    ) : null}
                  </td>
                  <td className="px-3 py-2" style={{ color: "var(--text-dim)" }}>
                    {a.role ?? a.sector ?? "—"}
                  </td>
                  <td className="px-3 py-2" style={{ color: "var(--text-dim)" }}>
                    {[a.hq_city, a.hq_country].filter(Boolean).join(", ") || "—"}
                  </td>
                  <td className="px-3 py-2">
                    {a.partnership_tier ? (
                      <span className={`chip tier-${a.partnership_tier}`}>{a.partnership_tier}</span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <span className="chip">{a.enrichment_state}</span>
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

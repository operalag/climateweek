import { NextResponse } from "next/server";
import { runOutreach } from "@/lib/agents/outreach";
import { getServiceSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    attendee_ids?: string[];
    sender?: { name: string; org: string; ask: string; language?: "en" | "de" };
  };
  const sb = getServiceSupabase();
  const { data } = await sb
    .from("cw_attendees")
    .select("id,name,kind,role,sector,bio,org_id")
    .in("id", body.attendee_ids ?? []);

  const sender = body.sender ?? {
    name: "Toni",
    org: "Operal AG",
    ask: "15 min at Climate Week Zurich to explore collaboration",
    language: "en" as const,
  };

  const result = await runOutreach({
    attendees:
      data?.map((a) => ({
        id: a.id,
        name: a.name,
        kind: a.kind,
        role: a.role,
        sector: a.sector,
        short_description: a.bio,
        sender,
      })) ?? [],
  });

  // persist
  const rows = result.items.flatMap((r) =>
    r.drafts.map((d) => ({
      attendee_id: r.id,
      angle: d.angle,
      channel: d.channel,
      subject: d.subject,
      body: d.body,
      language: sender.language ?? "en",
      state: "pending",
    })),
  );
  if (rows.length) await sb.from("cw_outreach_drafts").insert(rows);

  return NextResponse.json({ drafts: rows.length, errors: result.errors });
}

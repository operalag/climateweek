/**
 * @OUTREACH_AGENT — Claude drafts ready for human review.
 * 6 angles (intro, investor, journalist, partnership, speaker_followup,
 * event_invite) × 2 channels (email, LinkedIn).
 */
import { z } from "zod";
import { claudeStructured } from "@/lib/providers/anthropic";
import type { AgentResult } from "@/lib/types";

export type OutreachAngle =
  | "intro"
  | "investor"
  | "journalist"
  | "partnership"
  | "speaker_followup"
  | "event_invite";

export interface OutreachInput {
  id: string;
  name: string;
  kind: "organization" | "individual";
  role?: string | null;
  org_name?: string | null;
  sector?: string | null;
  short_description?: string | null;
  relevant_signals?: string[];
  sender: { name: string; org: string; ask: string; language?: "en" | "de" };
  angles?: OutreachAngle[];
}

const DraftSchema = z.object({
  drafts: z.array(
    z.object({
      angle: z.enum([
        "intro",
        "investor",
        "journalist",
        "partnership",
        "speaker_followup",
        "event_invite",
      ]),
      channel: z.enum(["email", "linkedin"]),
      subject: z.string().nullable().default(null),
      body: z.string(),
    }),
  ),
});

export async function draftOutreach(
  input: OutreachInput,
): Promise<z.infer<typeof DraftSchema>["drafts"]> {
  const angles: OutreachAngle[] = input.angles ?? [
    "intro",
    "partnership",
    "speaker_followup",
    "event_invite",
  ];
  const lang = input.sender.language ?? "en";

  const parsed = await claudeStructured({
    schema: DraftSchema,
    system: `You draft concise, specific outreach for Climate Week Zurich. Language: ${lang}. Tone: warm, expert, non-spammy. Always name the event they are tied to. LinkedIn drafts: <500 chars. Email drafts: <180 words. Never fabricate facts.`,
    user: JSON.stringify({ input, angles }, null, 2),
    maxTokens: 2500,
  });
  return parsed.drafts;
}

export async function runOutreach(args: {
  attendees: OutreachInput[];
}): Promise<AgentResult<{ id: string; drafts: Awaited<ReturnType<typeof draftOutreach>> }>> {
  const started = new Date().toISOString();
  const out: { id: string; drafts: Awaited<ReturnType<typeof draftOutreach>> }[] = [];
  const errors: { source: string; message: string }[] = [];

  for (const a of args.attendees) {
    try {
      const drafts = await draftOutreach(a);
      out.push({ id: a.id, drafts });
    } catch (err) {
      errors.push({ source: a.name, message: (err as Error).message });
    }
  }

  return {
    ok: errors.length === 0,
    items: out,
    errors,
    run: { started_at: started, finished_at: new Date().toISOString(), provider: "outreach" },
  };
}

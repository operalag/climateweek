/**
 * @SCORER_AGENT — Claude-based structured scoring.
 * Returns 0–100 on three axes: reachout_fit, influence, signal_strength.
 */
import { z } from "zod";
import { claudeStructured } from "@/lib/providers/anthropic";
import { ROLE_WEIGHT, TIER_WEIGHT, DEFAULT_ICP } from "@/lib/constants";
import type { AgentResult } from "@/lib/types";

const VERSION = "v1.0";

const ScoreSchema = z.object({
  reachout_fit: z.number().int().min(0).max(100),
  influence: z.number().int().min(0).max(100),
  signal_strength: z.number().int().min(0).max(100),
  rationale: z.string(),
});

export interface ScoreInput {
  kind: "organization" | "individual";
  name: string;
  role?: string | null;
  partnership_tier?: string | null;
  sector?: string | null;
  short_description?: string | null;
  recent_signals?: { title: string; published_at?: string }[];
  icp?: typeof DEFAULT_ICP;
}

export interface ScoreResult {
  version: string;
  reachout_fit: number;
  influence: number;
  signal_strength: number;
  composite: number;
  rationale: string;
}

/** Heuristic base influence — used as a prior we hand Claude. */
function priorInfluence(i: ScoreInput): number {
  if (i.partnership_tier) return TIER_WEIGHT[i.partnership_tier] ?? 40;
  if (i.role) {
    for (const r of ROLE_WEIGHT) if (r.match.test(i.role)) return r.weight;
  }
  return 30;
}

export async function scoreAttendee(input: ScoreInput): Promise<ScoreResult> {
  const icp = input.icp ?? DEFAULT_ICP;
  const prior = priorInfluence(input);

  const parsed = await claudeStructured({
    schema: ScoreSchema,
    system:
      "You score Climate Week Zurich attendees on three axes, 0-100. " +
      "reachout_fit = how well they match the ICP. " +
      "influence = how senior / how weighty their org is (anchor near the provided prior). " +
      "signal_strength = how actionable the recent signals are. " +
      "Be concise and concrete in rationale (2-3 sentences).",
    user: JSON.stringify({ input, icp, prior_influence: prior }, null, 2),
  });

  const composite = Math.round(
    parsed.reachout_fit * 0.45 +
      parsed.influence * 0.35 +
      parsed.signal_strength * 0.2,
  );

  return { version: VERSION, ...parsed, composite };
}

export async function runScorer(args: {
  attendees: ({ id: string } & ScoreInput)[];
  icp?: typeof DEFAULT_ICP;
}): Promise<AgentResult<{ id: string; score: ScoreResult }>> {
  const started = new Date().toISOString();
  const out: { id: string; score: ScoreResult }[] = [];
  const errors: { source: string; message: string }[] = [];

  for (const a of args.attendees) {
    try {
      const score = await scoreAttendee({ ...a, icp: args.icp });
      out.push({ id: a.id, score });
    } catch (err) {
      errors.push({ source: a.name, message: (err as Error).message });
    }
  }

  return {
    ok: errors.length === 0,
    items: out,
    errors,
    run: { started_at: started, finished_at: new Date().toISOString(), provider: "scorer" },
  };
}

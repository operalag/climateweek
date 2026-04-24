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
  reachout_fit: z.number().min(0).max(100).default(50),
  influence: z.number().min(0).max(100).default(50),
  signal_strength: z.number().min(0).max(100).default(30),
  rationale: z.string().default(""),
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
    system: `You score Climate Week Zurich attendees on three axes (0-100 integers).
- reachout_fit: alignment with the ICP
- influence: seniority of role or weight of org (anchor near prior_influence)
- signal_strength: how actionable recent signals are (default 30 when no signals given)
Return STRICT JSON with exactly these keys: {"reachout_fit": <int>, "influence": <int>, "signal_strength": <int>, "rationale": "<2-3 sentences>"}. No prose, no wrappers, no extra keys.`,
    user: JSON.stringify({ input, icp, prior_influence: prior }, null, 2),
    maxTokens: 400,
  });

  const composite = Math.round(
    parsed.reachout_fit * 0.45 +
      parsed.influence * 0.35 +
      parsed.signal_strength * 0.2,
  );

  return {
    version: VERSION,
    reachout_fit: Math.round(parsed.reachout_fit),
    influence: Math.round(parsed.influence),
    signal_strength: Math.round(parsed.signal_strength),
    rationale: parsed.rationale,
    composite,
  };
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

/**
 * @DEDUPER_AGENT — "UBS AG" == "UBS Switzerland" == "UBS".
 * Fast rule-based pass + Claude fallback for ambiguous clusters.
 */
import { z } from "zod";
import { claudeStructured } from "@/lib/providers/anthropic";
import { normalizeName } from "@/lib/normalize";

export interface DedupInput {
  id: string;
  kind: "organization" | "individual";
  name: string;
}

export interface DedupCluster {
  canonical_id: string;
  canonical_name: string;
  member_ids: string[];
}

const ClusterSchema = z.object({
  clusters: z.array(
    z.object({
      canonical_name: z.string(),
      members: z.array(z.string()),
    }),
  ),
});

/** Group by normalized name; return clusters with >1 member. */
export function ruleBasedClusters(inputs: DedupInput[]): DedupCluster[] {
  const groups = new Map<string, DedupInput[]>();
  for (const i of inputs) {
    const key = `${i.kind}|${normalizeName(i.name)}`;
    const g = groups.get(key) ?? [];
    g.push(i);
    groups.set(key, g);
  }
  const clusters: DedupCluster[] = [];
  for (const g of groups.values()) {
    if (g.length <= 1) continue;
    const canon = g[0];
    clusters.push({
      canonical_id: canon.id,
      canonical_name: canon.name,
      member_ids: g.map((x) => x.id),
    });
  }
  return clusters;
}

/** Claude pass — takes the *remaining* orgs (after rule-based merge) and
 * clusters semantically-equivalent names ("Nestlé SA" == "Nestle"). */
export async function claudeClusters(inputs: DedupInput[]): Promise<DedupCluster[]> {
  if (inputs.length < 2) return [];
  const parsed = await claudeStructured({
    schema: ClusterSchema,
    system:
      "You are a B2B data deduper. Given a list of organization names with ids, return clusters of names that refer to the *same* real-world entity. Only include clusters with 2+ members. Prefer the most formal name as canonical. Return strict JSON.",
    user: JSON.stringify(inputs.slice(0, 300), null, 2),
    maxTokens: 4000,
  });

  return parsed.clusters.map((c) => ({
    canonical_id: inputs.find((i) => c.members.includes(i.id))?.id ?? c.members[0],
    canonical_name: c.canonical_name,
    member_ids: c.members,
  }));
}

export async function dedupAll(inputs: DedupInput[]): Promise<DedupCluster[]> {
  const rule = ruleBasedClusters(inputs);
  const merged = new Set(rule.flatMap((c) => c.member_ids));
  const remaining = inputs.filter((i) => !merged.has(i.id));
  const llm = await claudeClusters(remaining).catch(() => []);
  return [...rule, ...llm];
}

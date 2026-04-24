/**
 * @ENRICHER_AGENT — Turns a bare attendee name into a full profile:
 * website, domain, HQ, sector, LinkedIn, short bio, key people.
 *
 * Strategy:
 *  1. Perplexity Sonar does the research pass and cites sources.
 *  2. Claude structures the result into our schema.
 *  3. Firecrawl pulls the org website and extracts a short bio.
 *  4. Apollo (optional) adds the top 5 contacts matching target roles.
 */
import { z } from "zod";
import { perplexityAsk } from "@/lib/providers/perplexity";
import { claudeStructured } from "@/lib/providers/anthropic";
import { firecrawlScrape } from "@/lib/providers/firecrawl";
import { apolloOrgEnrich, apolloPeopleSearch } from "@/lib/providers/apollo";
import { deriveDomain } from "@/lib/normalize";
import type { AgentResult } from "@/lib/types";

export interface EnrichedOrg {
  name: string;
  website: string | null;
  domain: string | null;
  linkedin_url: string | null;
  hq_city: string | null;
  hq_country: string | null;
  sector: string | null;
  short_description: string | null;
  employees_estimate: number | null;
  sources: string[];
}

const OrgSchema = z.object({
  website: z.string().nullable().default(null),
  linkedin_url: z.string().nullable().default(null),
  hq_city: z.string().nullable().default(null),
  hq_country: z.string().nullable().default(null),
  sector: z.string().nullable().default(null),
  short_description: z.string().nullable().default(null),
});

async function enrichOrgViaPerplexity(name: string): Promise<Partial<EnrichedOrg>> {
  const prompt = `Research the organization "${name}" and return the following fields:\n- website (root URL)\n- linkedin_url (full https://linkedin.com/company/... URL)\n- hq_city\n- hq_country\n- sector (one of: climate-tech, sustainable-finance, carbon-markets, renewable-energy, circular-economy, nature-tech, ESG-data, impact-investing, consulting, academia, government, NGO, other)\n- short_description (1-2 sentences, what they do, in English)\n\nReturn ONLY a JSON object with exactly those keys; use null for unknown.`;
  const ans = await perplexityAsk(prompt, {
    system: "You are a fast B2B research assistant. Return only JSON.",
    model: "sonar",
  });
  try {
    const parsed = await claudeStructured({
      schema: OrgSchema,
      system: "Reformat this into strict JSON matching the schema. Use null where unknown.",
      user: ans.content,
    });
    return { ...parsed, sources: ans.citations };
  } catch {
    return { sources: ans.citations };
  }
}

async function enrichOrgViaApollo(domain: string): Promise<Partial<EnrichedOrg>> {
  const org = await apolloOrgEnrich(domain);
  if (!org) return {};
  return {
    website: org.website_url ?? null,
    domain: org.primary_domain ?? domain,
    linkedin_url: org.linkedin_url ?? null,
    hq_city: org.city ?? null,
    hq_country: org.country ?? null,
    sector: org.industry ?? null,
    short_description: org.short_description ?? null,
    employees_estimate: org.estimated_num_employees ?? null,
  };
}

async function extractWebsiteBio(url: string): Promise<string | null> {
  try {
    const page = await firecrawlScrape(url, { formats: ["markdown"], onlyMainContent: true });
    if (!page.markdown) return null;
    return page.markdown.slice(0, 2000);
  } catch {
    return null;
  }
}

export async function enrichOrganization(name: string): Promise<EnrichedOrg> {
  const base: EnrichedOrg = {
    name,
    website: null,
    domain: null,
    linkedin_url: null,
    hq_city: null,
    hq_country: null,
    sector: null,
    short_description: null,
    employees_estimate: null,
    sources: [],
  };

  const pxp = await enrichOrgViaPerplexity(name).catch(() => ({} as Partial<EnrichedOrg>));
  Object.assign(base, pxp);

  const domain = deriveDomain(base.website);
  if (domain) base.domain = domain;

  if (base.domain) {
    try {
      const apollo = await enrichOrgViaApollo(base.domain);
      Object.assign(base, { ...apollo, sources: base.sources });
    } catch {
      // soft-fail
    }
  }

  if (base.website && !base.short_description) {
    const bio = await extractWebsiteBio(base.website);
    if (bio) base.short_description = bio.slice(0, 400);
  }

  return base;
}

export interface EnrichedPerson {
  name: string;
  title: string | null;
  email: string | null;
  linkedin_url: string | null;
  organization: string | null;
}

export async function enrichPeopleForOrg(
  orgName: string,
  domain: string | null,
  targetTitles = ["CEO", "Founder", "Head of Sustainability", "Chief Sustainability Officer", "VP", "Director"],
): Promise<EnrichedPerson[]> {
  try {
    const people = await apolloPeopleSearch({
      organizationName: orgName,
      organizationDomain: domain ?? undefined,
      titles: targetTitles,
      perPage: 10,
    });
    return people.map((p) => ({
      name: p.name ?? `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim(),
      title: p.title ?? null,
      email: p.email ?? null,
      linkedin_url: p.linkedin_url ?? null,
      organization: p.organization?.name ?? orgName,
    }));
  } catch {
    return [];
  }
}

export async function runEnricher(args: {
  attendees: { id: string; name: string; kind: "organization" | "individual" }[];
  limit?: number;
}): Promise<AgentResult<{ id: string; enriched: EnrichedOrg | null; people?: EnrichedPerson[] }>> {
  const started = new Date().toISOString();
  const out: { id: string; enriched: EnrichedOrg | null; people?: EnrichedPerson[] }[] = [];
  const errors: { source: string; message: string }[] = [];

  const limit = args.limit ?? args.attendees.length;
  for (const a of args.attendees.slice(0, limit)) {
    try {
      if (a.kind !== "organization") {
        out.push({ id: a.id, enriched: null });
        continue;
      }
      const e = await enrichOrganization(a.name);
      const people = e.domain
        ? await enrichPeopleForOrg(a.name, e.domain).catch(() => [])
        : [];
      out.push({ id: a.id, enriched: e, people });
    } catch (err) {
      errors.push({ source: a.name, message: (err as Error).message });
      out.push({ id: a.id, enriched: null });
    }
  }

  return {
    ok: errors.length === 0,
    items: out,
    errors,
    run: { started_at: started, finished_at: new Date().toISOString(), provider: "enricher" },
  };
}

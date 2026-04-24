/**
 * Apollo.io — people + organization enrichment.
 * Docs: https://apolloio.github.io/apollo-api-docs/
 */

const BASE = "https://api.apollo.io/v1";

function key() {
  const k = process.env.APPOLLO_API_KEY;
  if (!k) throw new Error("APPOLLO_API_KEY missing");
  return k;
}

export interface ApolloOrg {
  id?: string;
  name?: string;
  website_url?: string;
  primary_domain?: string;
  linkedin_url?: string;
  city?: string;
  country?: string;
  industry?: string;
  estimated_num_employees?: number;
  short_description?: string;
}

export interface ApolloPerson {
  id?: string;
  name?: string;
  first_name?: string;
  last_name?: string;
  title?: string;
  email?: string;
  linkedin_url?: string;
  city?: string;
  country?: string;
  organization?: ApolloOrg;
}

export async function apolloOrgEnrich(domain: string): Promise<ApolloOrg | null> {
  const res = await fetch(`${BASE}/organizations/enrich?domain=${encodeURIComponent(domain)}`, {
    headers: { "X-Api-Key": key(), accept: "application/json" },
  });
  if (!res.ok) return null;
  const body = (await res.json()) as { organization?: ApolloOrg };
  return body.organization ?? null;
}

export async function apolloPeopleSearch(args: {
  organizationName?: string;
  organizationDomain?: string;
  titles?: string[];
  page?: number;
  perPage?: number;
}): Promise<ApolloPerson[]> {
  const body: Record<string, unknown> = {
    page: args.page ?? 1,
    per_page: args.perPage ?? 10,
  };
  if (args.organizationName) body.q_organization_name = args.organizationName;
  if (args.organizationDomain) body.q_organization_domains = [args.organizationDomain];
  if (args.titles) body.person_titles = args.titles;

  const res = await fetch(`${BASE}/mixed_people/search`, {
    method: "POST",
    headers: { "X-Api-Key": key(), "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) return [];
  const json = (await res.json()) as { people?: ApolloPerson[] };
  return json.people ?? [];
}

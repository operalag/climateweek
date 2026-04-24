/**
 * The Guardian — Open Platform search.
 * Docs: https://open-platform.theguardian.com/
 */
const BASE = "https://content.guardianapis.com/search";

function key() {
  const k = process.env.GUARDIAN_API_KEY;
  if (!k) throw new Error("GUARDIAN_API_KEY missing");
  return k;
}

export interface GuardianHit {
  id: string;
  webTitle: string;
  webUrl: string;
  webPublicationDate: string;
  sectionName?: string;
}

export async function guardianSearch(
  q: string,
  opts: { pageSize?: number; fromDate?: string } = {},
): Promise<GuardianHit[]> {
  const params = new URLSearchParams({
    "api-key": key(),
    q,
    "page-size": String(opts.pageSize ?? 20),
    "order-by": "newest",
    ...(opts.fromDate ? { "from-date": opts.fromDate } : {}),
  });
  const res = await fetch(`${BASE}?${params}`);
  if (!res.ok) throw new Error(`guardian ${res.status}: ${await res.text()}`);
  const body = (await res.json()) as { response?: { results?: GuardianHit[] } };
  return body.response?.results ?? [];
}

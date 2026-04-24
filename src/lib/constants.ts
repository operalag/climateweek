export const CWZ = {
  year: Number(process.env.CWZ_YEAR ?? 2026),
  startDate: process.env.CWZ_START_DATE ?? "2026-05-04",
  endDate: process.env.CWZ_END_DATE ?? "2026-05-09",
  location: "Zurich, Switzerland",
  homepage: "https://www.climateweekzurich.org",
  hashtag: "#CWZ2026",
} as const;

/** Source pages the crawler agent always pulls. */
export const SEED_PAGES = [
  { slug: "our-partners", url: `${CWZ.homepage}/our-partners`, kind: "partners" as const },
  { slug: "featured-events-speakers", url: `${CWZ.homepage}/featured-events-speakers`, kind: "speakers" as const },
  { slug: "all-events", url: `${CWZ.homepage}/all-events`, kind: "events" as const },
  { slug: "main-programme", url: `${CWZ.homepage}/main-programme`, kind: "events" as const },
  { slug: "exhibition-centre", url: `${CWZ.homepage}/exhibition-centre`, kind: "exhibitors" as const },
  { slug: "12-themes-of-cwz2026", url: `${CWZ.homepage}/12-themes-of-cwz2026`, kind: "themes" as const },
];

/** Partnership tiers, in priority order — higher tier = higher base influence. */
export const PARTNERSHIP_TIERS = [
  "platinum",
  "gold",
  "silver",
  "bronze",
  "contributor",
  "community",
  "academic",
  "media",
] as const;

export const TIER_WEIGHT: Record<string, number> = {
  platinum: 100,
  gold: 85,
  silver: 70,
  bronze: 55,
  contributor: 40,
  community: 30,
  academic: 45,
  media: 35,
};

/** Rough role-seniority weights for influence scoring on individuals. */
export const ROLE_WEIGHT: Array<{ match: RegExp; weight: number }> = [
  { match: /\b(CEO|Chief Executive|Founder|President|Chair)\b/i, weight: 100 },
  { match: /\b(CFO|COO|CSO|CTO|CIO|CMO|CHRO|Chief\s+[A-Z])/i, weight: 90 },
  { match: /\b(Managing\s+(Partner|Director)|Global Head|Head of|Director of)\b/i, weight: 80 },
  { match: /\b(VP|Vice President|SVP|EVP|Head\b)/i, weight: 70 },
  { match: /\b(Partner|Professor|Advisor|Senior)\b/i, weight: 60 },
  { match: /\b(Manager|Lead|Principal|Specialist)\b/i, weight: 45 },
];

/** Default ICP — tune from the dashboard later. */
export const DEFAULT_ICP = {
  sectors: [
    "climate-tech",
    "sustainable-finance",
    "carbon-markets",
    "renewable-energy",
    "circular-economy",
    "nature-tech",
    "ESG-data",
    "impact-investing",
  ],
  regions: ["Switzerland", "DACH", "Europe", "Global"],
  minEmployees: 10,
  maxEmployees: 100000,
};

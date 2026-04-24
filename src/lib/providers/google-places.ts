/**
 * Google Places (new v1 Text Search) — resolve HQ coordinates + basic info.
 * Docs: https://developers.google.com/maps/documentation/places/web-service/text-search
 */
const BASE = "https://places.googleapis.com/v1/places:searchText";

function key() {
  const k = process.env.GOOGLE_PLACES_API;
  if (!k) throw new Error("GOOGLE_PLACES_API missing");
  return k;
}

export interface PlaceHit {
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude: number; longitude: number };
  websiteUri?: string;
  types?: string[];
}

export async function placesTextSearch(query: string): Promise<PlaceHit[]> {
  const res = await fetch(BASE, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "X-Goog-Api-Key": key(),
      "X-Goog-FieldMask":
        "places.displayName,places.formattedAddress,places.location,places.websiteUri,places.types",
    },
    body: JSON.stringify({ textQuery: query, maxResultCount: 5 }),
  });
  if (!res.ok) throw new Error(`places ${res.status}: ${await res.text()}`);
  const body = (await res.json()) as { places?: PlaceHit[] };
  return body.places ?? [];
}

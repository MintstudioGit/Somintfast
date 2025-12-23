export type GooglePlace = {
  placeId: string;
  name: string;
  address?: string;
  location?: { lat: number; lng: number };
  types?: string[];
  website?: string;
  phone?: string;
};

const BASE = "https://maps.googleapis.com/maps/api/place";

function key(): string {
  const k = process.env.GOOGLE_MAPS_API_KEY;
  if (!k) throw new Error("Missing GOOGLE_MAPS_API_KEY");
  return k;
}

async function getJson<T>(url: string, timeoutMs = 15000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal, cache: "no-store" });
    const text = await res.text();
    if (!res.ok) throw new Error(`Google Places HTTP ${res.status}: ${text.slice(0, 200)}`);
    return JSON.parse(text) as T;
  } finally {
    clearTimeout(timer);
  }
}

type TextSearchResponse = {
  status: string;
  error_message?: string;
  next_page_token?: string;
  results?: Array<{
    place_id: string;
    name: string;
    formatted_address?: string;
    geometry?: { location: { lat: number; lng: number } };
    types?: string[];
  }>;
};

type DetailsResponse = {
  status: string;
  error_message?: string;
  result?: {
    place_id: string;
    name: string;
    formatted_address?: string;
    geometry?: { location: { lat: number; lng: number } };
    website?: string;
    formatted_phone_number?: string;
    international_phone_number?: string;
    types?: string[];
  };
};

function toPlace(r: NonNullable<TextSearchResponse["results"]>[number]): GooglePlace {
  return {
    placeId: r.place_id,
    name: r.name,
    address: r.formatted_address,
    location: r.geometry?.location,
    types: r.types,
  };
}

export async function googleTextSearch(params: {
  query: string; // e.g. "doctors in Berlin"
  maxResults?: number; // up to 60 (3 pages)
}): Promise<GooglePlace[]> {
  const max = Math.min(60, Math.max(1, params.maxResults ?? 20));
  const k = key();

  const places: GooglePlace[] = [];
  let pageToken: string | undefined;

  for (let page = 0; page < 3 && places.length < max; page++) {
    // Page tokens require a short delay before they become valid
    if (pageToken) await new Promise((r) => setTimeout(r, 2200));

    const url =
      `${BASE}/textsearch/json?` +
      new URLSearchParams({
        query: params.query,
        key: k,
        ...(pageToken ? { pagetoken: pageToken } : {}),
      }).toString();

    const json = await getJson<TextSearchResponse>(url);
    if (json.status !== "OK" && json.status !== "ZERO_RESULTS") {
      throw new Error(`Google Places error: ${json.status} ${json.error_message ?? ""}`.trim());
    }

    for (const r of json.results ?? []) {
      places.push(toPlace(r));
      if (places.length >= max) break;
    }

    pageToken = json.next_page_token;
    if (!pageToken) break;
  }

  // de-dupe by placeId
  const seen = new Set<string>();
  return places.filter((p) => (seen.has(p.placeId) ? false : (seen.add(p.placeId), true)));
}

export async function googlePlaceDetails(placeId: string): Promise<GooglePlace> {
  const k = key();
  const url =
    `${BASE}/details/json?` +
    new URLSearchParams({
      place_id: placeId,
      fields: "place_id,name,formatted_address,geometry,website,formatted_phone_number,international_phone_number,types",
      key: k,
    }).toString();

  const json = await getJson<DetailsResponse>(url);
  if (json.status !== "OK") {
    throw new Error(`Google Place Details error: ${json.status} ${json.error_message ?? ""}`.trim());
  }
  const r = json.result!;
  return {
    placeId: r.place_id,
    name: r.name,
    address: r.formatted_address,
    location: r.geometry?.location,
    website: r.website,
    phone: r.international_phone_number ?? r.formatted_phone_number,
    types: r.types,
  };
}


export type SerpGoogleMapsPlace = {
  /** Stable identifier when available (place_id / data_id / cid). */
  sourceRef: string;
  name: string;
  website?: string;
  phone?: string;
  address?: string;
  location?: { lat: number; lng: number };
  rating?: number;
  reviews?: number;
};

type SerpApiResponse = {
  search_metadata?: { status?: string };
  error?: string;
  error_message?: string;
  local_results?: Array<{
    title?: string;
    website?: string;
    phone?: string;
    address?: string;
    rating?: number;
    reviews?: number;
    place_id?: string;
    data_id?: string;
    cid?: string;
    gps_coordinates?: { latitude?: number; longitude?: number };
  }>;
};

const BASE = "https://serpapi.com/search.json";

function key(): string {
  // user requested SerpAPI crawler integration
  const k = process.env.SERPAPI_API_KEY;
  if (!k) throw new Error("Missing SERPAPI_API_KEY");
  return k;
}

function toSourceRef(r: NonNullable<SerpApiResponse["local_results"]>[number]): string {
  if (r.place_id) return `place_id:${r.place_id}`;
  if (r.data_id) return `data_id:${r.data_id}`;
  if (r.cid) return `cid:${r.cid}`;
  // fallback: not perfect, but keeps dedupe stable-ish within city+query
  return `name:${(r.title ?? "unknown").trim()}|addr:${(r.address ?? "").trim()}`;
}

async function getJson(url: string, timeoutMs = 20000): Promise<SerpApiResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal, cache: "no-store" });
    const text = await res.text();
    if (!res.ok) throw new Error(`SerpAPI HTTP ${res.status}: ${text.slice(0, 250)}`);
    return JSON.parse(text) as SerpApiResponse;
  } finally {
    clearTimeout(timer);
  }
}

export async function serpApiGoogleMapsSearch(params: {
  query: string;
  maxResults?: number;
}): Promise<SerpGoogleMapsPlace[]> {
  const max = Math.min(60, Math.max(1, params.maxResults ?? 20));
  const url =
    `${BASE}?` +
    new URLSearchParams({
      engine: "google_maps",
      q: params.query,
      hl: "en",
      api_key: key(),
    }).toString();

  const json = await getJson(url);
  const status = json.search_metadata?.status ?? "unknown";
  if (status !== "Success") {
    // SerpAPI uses 200 OK even for some failures
    const msg = json.error ?? json.error_message ?? status;
    throw new Error(`SerpAPI error: ${msg}`);
  }

  const results = (json.local_results ?? [])
    .map((r) => {
      const name = (r.title ?? "").trim();
      if (!name) return null;
      const lat = r.gps_coordinates?.latitude;
      const lng = r.gps_coordinates?.longitude;
      return {
        sourceRef: toSourceRef(r),
        name,
        website: r.website,
        phone: r.phone,
        address: r.address,
        location:
          typeof lat === "number" && typeof lng === "number" ? { lat, lng } : undefined,
        rating: typeof r.rating === "number" ? r.rating : undefined,
        reviews: typeof r.reviews === "number" ? r.reviews : undefined,
      } satisfies SerpGoogleMapsPlace;
    })
    .filter(Boolean) as SerpGoogleMapsPlace[];

  return results.slice(0, max);
}


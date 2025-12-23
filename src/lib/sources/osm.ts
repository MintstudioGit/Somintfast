export type OsmPlace = {
  sourceRef?: string; // "node/123" | "way/456" | "relation/789"
  name: string;
  website?: string;
  phone?: string;
  email?: string;
  address?: string;
  location?: string;
  tags?: Record<string, string>;
};

function escapeOverpassString(s: string) {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

type OverpassResponse = { ok: boolean; status: number; elements: any[]; error?: string };

async function overpassRequest(data: string, timeoutMs: number): Promise<OverpassResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded; charset=UTF-8" },
      body: new URLSearchParams({ data }).toString(),
      signal: controller.signal,
    });
    const status = res.status;
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false, status, elements: [], error: text.slice(0, 200) };
    }
    const json = (await res.json()) as any;
    const elements: any[] = Array.isArray(json?.elements) ? json.elements : [];
    return { ok: true, status, elements };
  } catch {
    return { ok: false, status: 0, elements: [], error: "network_error" };
  } finally {
    clearTimeout(timer);
  }
}

function toPlaces(elements: any[], cityFallback: string): OsmPlace[] {
  const places: OsmPlace[] = [];
  for (const el of elements) {
    const tags = el.tags ?? {};
    const name = tags.name;
    if (!name) continue;

    const website = tags.website ?? tags["contact:website"];
    const email = tags.email ?? tags["contact:email"];
    const phone = tags.phone ?? tags["contact:phone"];

    const addrStreet = tags["addr:street"];
    const addrHousenumber = tags["addr:housenumber"];
    const addrPostcode = tags["addr:postcode"];
    const addrCity = tags["addr:city"] ?? cityFallback;
    const address =
      addrStreet || addrPostcode
        ? [
            addrStreet && addrHousenumber ? `${addrStreet} ${addrHousenumber}` : addrStreet,
            addrPostcode && addrCity ? `${addrPostcode} ${addrCity}` : addrCity,
          ]
            .filter(Boolean)
            .join(", ")
        : undefined;

    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;
    const location =
      typeof lat === "number" && typeof lon === "number"
        ? `${lat.toFixed(5)}, ${lon.toFixed(5)}`
        : undefined;

    const sourceRef =
      el.type && typeof el.id === "number" ? `${el.type}/${el.id}` : undefined;

    places.push({
      sourceRef,
      name,
      website,
      email,
      phone,
      address,
      location,
      tags,
    });
  }
  return places;
}

export async function searchOsmBusinesses(params: {
  city: string;
  query?: string; // e.g. "restaurant", "zahnarzt", "agentur"
  limit?: number;
  timeoutMs?: number;
}): Promise<OsmPlace[]> {
  const limit = Math.min(50, Math.max(1, params.limit ?? 20));
  const timeoutMs = params.timeoutMs ?? 20000;
  const q = params.query?.trim();

  // Overpass QL: search within administrative area by city name.
  // We look for elements with a name and optional website/email/phone tags.
  const filter = q
    ? `[name~"${escapeOverpassString(q)}",i]`
    : "";

  const overpass = `
[out:json][timeout:25];
area["name"="${escapeOverpassString(params.city)}"]["boundary"="administrative"]->.a;
(
  node["name"]${filter}(area.a);
  way["name"]${filter}(area.a);
  relation["name"]${filter}(area.a);
);
out tags center ${limit};
`.trim();

  const controller = new AbortController();
  void controller; // legacy var kept; not used
  const resp = await overpassRequest(overpass, timeoutMs);
  if (!resp.ok) return [];
  return toPlaces(resp.elements.slice(0, limit), params.city);
}

export type OSMTagFilter = { key: string; value?: string };

export async function searchOsmByBbox(params: {
  bbox: { south: number; west: number; north: number; east: number };
  cityFallback: string;
  tagFilters: OSMTagFilter[];
  limit?: number;
  timeoutMs?: number;
  delayMs?: number;
}): Promise<{ places: OsmPlace[]; rateLimited: boolean }> {
  const limit = Math.min(250, Math.max(1, params.limit ?? 200));
  const timeoutMs = params.timeoutMs ?? 25000;
  const { south, west, north, east } = params.bbox;

  const filters = params.tagFilters
    .map((f) => (f.value ? `["${f.key}"="${escapeOverpassString(f.value)}"]` : `["${f.key}"]`))
    .join("");

  const overpass = `
[out:json][timeout:25];
(
  nwr${filters}(${south},${west},${north},${east});
);
out tags center ${limit};
`.trim();

  if (params.delayMs && params.delayMs > 0) {
    await new Promise((r) => setTimeout(r, params.delayMs));
  }

  const resp = await overpassRequest(overpass, timeoutMs);
  const rateLimited = resp.status === 429 || (resp.error?.toLowerCase().includes("rate") ?? false);
  if (!resp.ok) return { places: [], rateLimited };
  return { places: toPlaces(resp.elements, params.cityFallback), rateLimited };
}


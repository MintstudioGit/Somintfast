export type OsmPlace = {
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
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded; charset=UTF-8" },
      body: new URLSearchParams({ data: overpass }).toString(),
      signal: controller.signal,
    });
    if (!res.ok) return [];
    const json = (await res.json()) as any;
    const elements: any[] = Array.isArray(json?.elements) ? json.elements : [];

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
      const addrCity = tags["addr:city"] ?? params.city;
      const address =
        addrStreet || addrPostcode
          ? [addrStreet && addrHousenumber ? `${addrStreet} ${addrHousenumber}` : addrStreet, addrPostcode && addrCity ? `${addrPostcode} ${addrCity}` : addrCity]
              .filter(Boolean)
              .join(", ")
          : undefined;

      const lat = el.lat ?? el.center?.lat;
      const lon = el.lon ?? el.center?.lon;
      const location =
        typeof lat === "number" && typeof lon === "number"
          ? `${lat.toFixed(5)}, ${lon.toFixed(5)}`
          : undefined;

      places.push({
        name,
        website,
        email,
        phone,
        address,
        location,
        tags,
      });

      if (places.length >= limit) break;
    }

    return places;
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}


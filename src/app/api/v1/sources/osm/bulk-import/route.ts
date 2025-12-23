import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { logUsage, requireApiKey } from "@/lib/api-key";
import { searchOsmByBbox, type OSMTagFilter } from "@/lib/sources/osm";

const BodySchema = z.object({
  city: z.string().min(1).default("Berlin"),
  kind: z.enum(["doctors", "all"]).optional().default("doctors"),
  target: z.number().int().min(50).max(1000).optional().default(1000),
  maxCalls: z.number().int().min(5).max(30).optional().default(25),
});

// Berlin bounding box (approx.)
const BERLIN_BBOX = { south: 52.3383, west: 13.0884, north: 52.6755, east: 13.7612 };

function tileBbox(b: typeof BERLIN_BBOX, rows: number, cols: number) {
  const tiles: Array<{ south: number; west: number; north: number; east: number }> = [];
  const latStep = (b.north - b.south) / rows;
  const lonStep = (b.east - b.west) / cols;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const south = b.south + r * latStep;
      const north = b.south + (r + 1) * latStep;
      const west = b.west + c * lonStep;
      const east = b.west + (c + 1) * lonStep;
      tiles.push({ south, west, north, east });
    }
  }
  return tiles;
}

function tagFiltersFor(kind: "doctors" | "all"): OSMTagFilter[][] {
  if (kind === "doctors") {
    // Doctors in OSM appear under amenity/healthcare tags.
    return [
      [{ key: "amenity", value: "doctors" }],
      [{ key: "healthcare", value: "doctor" }],
      [{ key: "healthcare", value: "clinic" }],
      [{ key: "amenity", value: "dentist" }],
    ];
  }

  // "All categories" – not literally everything (that would be millions),
  // but broad business buckets across common tags.
  return [
    [{ key: "shop" }],
    [{ key: "office" }],
    [{ key: "craft" }],
    [{ key: "amenity" }],
    [{ key: "tourism" }],
    [{ key: "leisure" }],
    [{ key: "healthcare" }],
    [{ key: "man_made" }],
  ];
}

/**
 * Bulk import with adaptive throttling:
 * - tries to make 20–30 Overpass calls (tiles x tag filters)
 * - slows down on rate-limit/timeouts, speeds up again after consecutive successes
 * - stops once it reaches `target` leads (<= 1000)
 */
export async function POST(req: Request) {
  const auth = await requireApiKey(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const json = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { city, kind, target, maxCalls } = parsed.data;
  const filters = tagFiltersFor(kind);

  // Use Berlin tiling; for other cities we still use Berlin bbox as a fallback for now.
  // (We can later add Nominatim bbox lookup.)
  const tiles = tileBbox(BERLIN_BBOX, 5, 5); // 25 calls baseline

  const createdIds: string[] = [];
  let calls = 0;
  let delayMs = 150; // start fast
  let successStreak = 0;

  // simple in-request de-dupe
  const seenRef = new Set<string>();

  outer: for (const filterGroup of filters) {
    for (const tile of tiles) {
      if (calls >= maxCalls) break outer;
      if (createdIds.length >= target) break outer;

      calls += 1;
      const resp = await searchOsmByBbox({
        bbox: tile,
        cityFallback: city,
        tagFilters: filterGroup,
        limit: 250,
        delayMs,
      });

      // adaptive throttling
      if (resp.rateLimited || resp.places.length === 0) {
        successStreak = 0;
        delayMs = Math.min(5000, Math.round(delayMs * 1.7 + 100));
      } else {
        successStreak += 1;
        if (successStreak >= 3) delayMs = Math.max(75, Math.round(delayMs * 0.85));
      }

      for (const p of resp.places) {
        if (createdIds.length >= target) break;

        const ref = p.sourceRef ? `osm:${p.sourceRef}` : `name:${p.name}|web:${p.website ?? ""}|addr:${p.address ?? ""}`;
        if (seenRef.has(ref)) continue;
        seenRef.add(ref);

        try {
          const lead = await prisma.lead.create({
            data: {
              customerId: auth.customerId,
              source: "osm",
              sourceRef: p.sourceRef ?? null,
              companyName: p.name,
              website: p.website,
              email: p.email,
              phone: p.phone,
              address: p.address,
              location: p.location ?? city,
              notes: `Bulk imported from OpenStreetMap (${kind}).`,
              enrichedAt: new Date(),
            },
            select: { id: true },
          });
          createdIds.push(lead.id);
        } catch {
          // unique constraint hit or any other issue; ignore and continue
        }
      }
    }
  }

  void logUsage({
    customerId: auth.customerId,
    apiKeyId: auth.apiKeyId,
    route: "/api/v1/sources/osm/bulk-import",
    method: "POST",
    status: 201,
    req,
  });

  return NextResponse.json(
    {
      created: createdIds.length,
      target,
      callsMade: calls,
      finalDelayMs: delayMs,
      kind,
      city,
    },
    { status: 201 },
  );
}


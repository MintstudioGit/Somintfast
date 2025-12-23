import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { logUsage, requireApiKey } from "@/lib/api-key";
import { googlePlaceDetails, googleTextSearch } from "@/lib/sources/google-places";
import type { GooglePlace } from "@/lib/sources/google-places";

const ImportSchema = z.object({
  city: z.string().min(1),
  query: z.string().optional(),
  limit: z.number().int().min(1).max(50).optional(),
});

/**
 * Legacy route (kept for backwards compatibility).
 * Now imports from Google Places instead of OpenStreetMap.
 * Creates leads scoped to the authenticated customer.
 */
export async function POST(req: Request) {
  const auth = await requireApiKey(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const json = await req.json().catch(() => null);
  const parsed = ImportSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const query = `${parsed.data.query?.trim() || "business"} in ${parsed.data.city.trim()}`;
  const results = await googleTextSearch({ query, maxResults: parsed.data.limit ?? 20 });
  if (results.length === 0) {
    void logUsage({
      customerId: auth.customerId,
      apiKeyId: auth.apiKeyId,
      route: "/api/v1/sources/osm/import",
      method: "POST",
      status: 200,
      req,
    });
    return NextResponse.json({ created: 0, leads: [] });
  }

  // Create leads; de-dupe via @@unique([customerId, source, sourceRef])
  const leads = [];
  for (const p of results) {
    let details: GooglePlace | null = null;
    try {
      details = await googlePlaceDetails(p.placeId);
    } catch {
      details = p;
    }

    try {
      const lead = await prisma.lead.create({
        data: {
          customerId: auth.customerId,
          source: "google_places",
          sourceRef: details.placeId,
          companyName: details.name,
          website: details.website,
          phone: details.phone,
          address: details.address,
          location:
            details.location && typeof details.location.lat === "number"
              ? `${details.location.lat.toFixed(5)}, ${details.location.lng.toFixed(5)}`
              : parsed.data.city,
          notes: `Imported from Google Places (legacy /osm/import).`,
          enrichedAt: new Date(),
        },
      });
      leads.push(lead);
    } catch {
      // unique constraint hit or any other issue; ignore and continue
    }
  }

  void logUsage({
    customerId: auth.customerId,
    apiKeyId: auth.apiKeyId,
    route: "/api/v1/sources/osm/import",
    method: "POST",
    status: 201,
    req,
  });

  return NextResponse.json({ created: leads.length, leads }, { status: 201 });
}


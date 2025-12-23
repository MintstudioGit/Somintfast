import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { logUsage, requireApiKey } from "@/lib/api-key";
import { serpApiGoogleMapsSearch } from "@/lib/sources/serpapi-google-maps";
import type { SerpGoogleMapsPlace } from "@/lib/sources/serpapi-google-maps";
import { scrapeImpressum, type ImpressumResult } from "@/lib/sources/impressum";

const ImportSchema = z.object({
  city: z.string().min(1),
  query: z.string().optional(),
  limit: z.number().int().min(1).max(50).optional(),
});

/**
 * Legacy route (kept for backwards compatibility).
 * Now imports from Google Maps via SerpAPI instead of OpenStreetMap.
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
  const results = await serpApiGoogleMapsSearch({
    query,
    maxResults: parsed.data.limit ?? 20,
  });
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
    const place = p as SerpGoogleMapsPlace;
    const imp: ImpressumResult = place.website
      ? await scrapeImpressum(place.website).catch((): ImpressumResult => ({}))
      : {};

    try {
      const lead = await prisma.lead.create({
        data: {
          customerId: auth.customerId,
          source: "serpapi_google_maps",
          sourceRef: place.sourceRef,
          companyName: place.name,
          website: place.website,
          phone: imp.phone ?? place.phone,
          email: imp.email,
          owner: imp.owner,
          address: imp.address ?? place.address,
          location:
            place.location && typeof place.location.lat === "number"
              ? `${place.location.lat.toFixed(5)}, ${place.location.lng.toFixed(5)}`
              : parsed.data.city,
          notes: [
            "Imported from Google Maps (SerpAPI, legacy /osm/import).",
            typeof place.rating === "number" ? `Rating: ${place.rating}` : null,
            typeof place.reviews === "number" ? `Reviews: ${place.reviews}` : null,
            imp.sourceUrl ? `Impressum: ${imp.sourceUrl}` : null,
          ]
            .filter(Boolean)
            .join("\n"),
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


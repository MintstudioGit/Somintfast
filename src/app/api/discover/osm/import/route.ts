import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { Lead } from "@prisma/client";
import { serpApiGoogleMapsSearch } from "@/lib/sources/serpapi-google-maps";
import { scrapeImpressum, type ImpressumResult } from "@/lib/sources/impressum";

const BodySchema = z.object({
  city: z.string().min(1),
  q: z.string().optional(),
  limit: z.number().int().min(1).max(50).optional(),
});

/**
 * Legacy alias (kept for backwards compatibility).
 * Public (no-auth) import for the UI:
 * searches Google Maps via SerpAPI and inserts results into the local DB.
 */
export async function POST(req: Request) {
  try {
    const json = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", issues: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const query = `${parsed.data.q?.trim() || "business"} in ${parsed.data.city.trim()}`;
    const results = await serpApiGoogleMapsSearch({
      query,
      maxResults: parsed.data.limit ?? 20,
    });

    if (results.length === 0) return NextResponse.json({ created: 0, leads: [] });

    const created: Lead[] = [];
    for (const p of results) {
      // de-dupe by sourceRef
      const existing = await prisma.lead.findFirst({
        where: { source: "serpapi_google_maps", sourceRef: p.sourceRef },
      });
      if (existing) continue;

      const imp: ImpressumResult = p.website
        ? await scrapeImpressum(p.website).catch((): ImpressumResult => ({}))
        : {};

      const lead = await prisma.lead.create({
        data: {
          source: "serpapi_google_maps",
          sourceRef: p.sourceRef,
          companyName: p.name,
          website: p.website,
          phone: imp.phone ?? p.phone,
          email: imp.email,
          owner: imp.owner,
          address: imp.address ?? p.address,
          location:
            p.location && typeof p.location.lat === "number"
              ? `${p.location.lat.toFixed(5)}, ${p.location.lng.toFixed(5)}`
              : parsed.data.city,
          notes: [
            "Imported from Google Maps (SerpAPI Discover, legacy /osm/import).",
            typeof p.rating === "number" ? `Rating: ${p.rating}` : null,
            typeof p.reviews === "number" ? `Reviews: ${p.reviews}` : null,
            imp.sourceUrl ? `Impressum: ${imp.sourceUrl}` : null,
          ]
            .filter(Boolean)
            .join("\n"),
          enrichedAt: new Date(),
        },
      });
      created.push(lead);
    }

    return NextResponse.json({ created: created.length, leads: created }, { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Import failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}


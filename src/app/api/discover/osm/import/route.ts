import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { googlePlaceDetails, googleTextSearch } from "@/lib/sources/google-places";

const BodySchema = z.object({
  city: z.string().min(1),
  q: z.string().optional(),
  limit: z.number().int().min(1).max(50).optional(),
});

/**
 * Public (no-auth) import for the UI:
 * searches Google Places and inserts results into the local DB.
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
    const results = await googleTextSearch({ query, maxResults: parsed.data.limit ?? 20 });

    if (results.length === 0) return NextResponse.json({ created: 0, leads: [] });

    const created: any[] = [];
    for (const p of results) {
      // de-dupe by google place_id
      const existing = await prisma.lead.findFirst({
        where: { source: "google_places", sourceRef: p.placeId },
      });
      if (existing) continue;

      // fetch details to get website/phone when available
      let details: any = null;
      try {
        details = await googlePlaceDetails(p.placeId);
      } catch {
        details = p;
      }

      const lead = await prisma.lead.create({
        data: {
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
          notes: "Imported from Google Places (Discover).",
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


import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { searchOsmBusinesses } from "@/lib/sources/osm";

const BodySchema = z.object({
  city: z.string().min(1),
  q: z.string().optional(),
  limit: z.number().int().min(1).max(50).optional(),
});

/**
 * Public (no-auth) import for the UI:
 * searches OSM and inserts results into the local DB.
 */
export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const places = await searchOsmBusinesses({
    city: parsed.data.city,
    query: parsed.data.q,
    limit: parsed.data.limit,
  });

  if (places.length === 0) return NextResponse.json({ created: 0, leads: [] });

  const created: any[] = [];
  for (const p of places) {
    const existing = await prisma.lead.findFirst({
      where: {
        companyName: p.name,
        ...(p.website ? { website: p.website } : {}),
      },
    });
    if (existing) continue;

    const lead = await prisma.lead.create({
      data: {
        companyName: p.name,
        website: p.website,
        email: p.email,
        phone: p.phone,
        address: p.address,
        location: p.location ?? parsed.data.city,
        notes: "Imported from OpenStreetMap (Discover).",
        enrichedAt: new Date(),
      },
    });
    created.push(lead);
  }

  return NextResponse.json({ created: created.length, leads: created }, { status: 201 });
}


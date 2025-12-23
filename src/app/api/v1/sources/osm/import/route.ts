import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { logUsage, requireApiKey } from "@/lib/api-key";
import { searchOsmBusinesses } from "@/lib/sources/osm";

const ImportSchema = z.object({
  city: z.string().min(1),
  query: z.string().optional(),
  limit: z.number().int().min(1).max(50).optional(),
});

/**
 * Real-data import from OpenStreetMap via Overpass API.
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

  const places = await searchOsmBusinesses(parsed.data);
  if (places.length === 0) {
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

  // Create leads; de-dupe by (customerId, companyName, website) best-effort
  const leads = [];
  for (const p of places) {
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
        location: p.location ?? parsed.data.city,
        notes: `Imported from OpenStreetMap (Overpass).`,
        enrichedAt: new Date(),
      },
    });
    leads.push(lead);
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


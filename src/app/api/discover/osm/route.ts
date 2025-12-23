import { NextResponse } from "next/server";
import { z } from "zod";
import { searchOsmBusinesses } from "@/lib/sources/osm";

const QuerySchema = z.object({
  city: z.string().min(1),
  q: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

/**
 * Public (no-auth) discovery search for the UI.
 * Uses OpenStreetMap (Overpass) to fetch real businesses.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const parsed = QuerySchema.safeParse({
    city: url.searchParams.get("city") ?? "",
    q: url.searchParams.get("q") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const places = await searchOsmBusinesses({
    city: parsed.data.city,
    query: parsed.data.q,
    limit: parsed.data.limit,
  });

  return NextResponse.json({ places });
}


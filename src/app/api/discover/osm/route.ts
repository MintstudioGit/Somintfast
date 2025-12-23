import { NextResponse } from "next/server";
import { z } from "zod";
import { googleTextSearch } from "@/lib/sources/google-places";

const QuerySchema = z.object({
  city: z.string().min(1),
  q: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

/**
 * Public (no-auth) discovery search for the UI.
 * Uses Google Places Text Search (requires GOOGLE_MAPS_API_KEY).
 */
export async function GET(req: Request) {
  try {
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

    const query = `${parsed.data.q?.trim() || "business"} in ${parsed.data.city.trim()}`;
    const places = await googleTextSearch({ query, maxResults: parsed.data.limit ?? 20 });

    return NextResponse.json({ places });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Discover failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}


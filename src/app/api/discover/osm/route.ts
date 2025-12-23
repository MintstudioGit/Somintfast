import { NextResponse } from "next/server";
import { z } from "zod";
import { serpApiGoogleMapsSearch } from "@/lib/sources/serpapi-google-maps";

const QuerySchema = z.object({
  city: z.string().min(1),
  q: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

/**
 * Public (no-auth) discovery search for the UI.
 * Legacy alias (kept for backwards compatibility).
 * Uses SerpAPI Google Maps engine (requires SERPAPI_API_KEY).
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
    const results = await serpApiGoogleMapsSearch({
      query,
      maxResults: parsed.data.limit ?? 20,
    });

    // Keep a stable, UI-friendly response shape (matching legacy OSM-ish fields).
    const places = results.map((p) => ({
      source: "serpapi_google_maps",
      sourceRef: p.sourceRef,
      name: p.name,
      website: p.website,
      phone: p.phone,
      email: undefined as string | undefined,
      address: p.address,
      location:
        p.location && typeof p.location.lat === "number" && typeof p.location.lng === "number"
          ? `${p.location.lat.toFixed(5)}, ${p.location.lng.toFixed(5)}`
          : undefined,
      rating: p.rating,
      reviews: p.reviews,
    }));

    return NextResponse.json({ places });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Discover failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}


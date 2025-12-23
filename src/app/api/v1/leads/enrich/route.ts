import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { logUsage, requireApiKey } from "@/lib/api-key";
import { scrapeImpressum } from "@/lib/sources/impressum";

const EnrichSchema = z.object({
  leadId: z.string().min(1),
});

/**
 * Enrich an existing lead with real contact data by scraping the website’s Impressum/Kontakt pages.
 */
export async function POST(req: Request) {
  const auth = await requireApiKey(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const json = await req.json().catch(() => null);
  const parsed = EnrichSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const lead = await prisma.lead.findFirst({
    where: { id: parsed.data.leadId, customerId: auth.customerId },
  });
  if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!lead.website) {
    return NextResponse.json({ error: "Lead has no website to enrich from" }, { status: 400 });
  }

  const data = await scrapeImpressum(lead.website);

  const updated = await prisma.lead.update({
    where: { id: lead.id },
    data: {
      email: data.email ?? lead.email,
      phone: data.phone ?? lead.phone,
      address: data.address ?? lead.address,
      owner: data.owner ?? lead.owner,
      notes: data.sourceUrl
        ? `${lead.notes ?? ""}${lead.notes ? "\n" : ""}Enriched from: ${data.sourceUrl}`.trim()
        : lead.notes,
      enrichedAt: new Date(),
    },
  });

  void logUsage({
    customerId: auth.customerId,
    apiKeyId: auth.apiKeyId,
    route: "/api/v1/leads/enrich",
    method: "POST",
    status: 200,
    req,
  });

  return NextResponse.json({ lead: updated, enrichment: data });
}


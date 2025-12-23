import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { logUsage, requireApiKey } from "@/lib/api-key";
import { guessEmails } from "@/lib/email/guess";
import { isDisposableEmail } from "@/lib/email/disposable";
import { hasMx } from "@/lib/email/verify";

const BodySchema = z.object({
  leadId: z.string().min(1),
  updateLead: z.boolean().optional().default(true),
});

export async function POST(req: Request) {
  const auth = await requireApiKey(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const json = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(json);
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
  if (!lead.owner) {
    return NextResponse.json(
      { error: "Lead has no owner name to guess from" },
      { status: 400 },
    );
  }

  const domain = lead.website ?? "";
  const candidates = guessEmails(
    {
      fullName: lead.owner,
      companyName: lead.companyName,
      domain,
    },
    15,
  );
  if (candidates.length === 0) {
    return NextResponse.json({ error: "Could not generate candidates" }, { status: 400 });
  }

  const mx = candidates[0]?.domain ? await hasMx(candidates[0].domain) : false;
  const ranked = await Promise.all(
    candidates.map(async (c) => {
      const disp = await isDisposableEmail(c.email);
      const finalScore = c.score + (mx ? 5 : -20) + (disp.disposable ? -50 : 0);
      return { ...c, mx, disposable: disp.disposable, finalScore };
    }),
  );
  ranked.sort((a, b) => b.finalScore - a.finalScore);
  const best = ranked.find((c) => !c.disposable) ?? ranked[0];

  const updatedLead = parsed.data.updateLead
    ? await prisma.lead.update({
        where: { id: lead.id },
        data: {
          email: best.email,
          notes: `${lead.notes ?? ""}${lead.notes ? "\n" : ""}Guessed email: ${best.email} (${best.pattern})`.trim(),
        },
      })
    : lead;

  void logUsage({
    customerId: auth.customerId,
    apiKeyId: auth.apiKeyId,
    route: "/api/v1/leads/guess-email",
    method: "POST",
    status: 200,
    req,
  });

  return NextResponse.json({ best, candidates: ranked, lead: updatedLead });
}


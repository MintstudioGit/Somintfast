import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiKey, logUsage } from "@/lib/api-key";
import { guessEmails } from "@/lib/email/guess";
import { isDisposableEmail } from "@/lib/email/disposable";
import { hasMx } from "@/lib/email/verify";

const GuessSchema = z.object({
  ownerName: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  companyName: z.string().optional(),
  domain: z.string().min(3),
  limit: z.number().int().min(1).max(50).optional(),
  verify: z.boolean().optional().default(true),
});

export async function POST(req: Request) {
  const auth = await requireApiKey(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const json = await req.json().catch(() => null);
  const parsed = GuessSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const candidates = guessEmails(
    {
      fullName: parsed.data.ownerName,
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      companyName: parsed.data.companyName,
      domain: parsed.data.domain,
    },
    parsed.data.limit ?? 15,
  );

  if (!parsed.data.verify) {
    void logUsage({
      customerId: auth.customerId,
      apiKeyId: auth.apiKeyId,
      route: "/api/v1/email/guess",
      method: "POST",
      status: 200,
      req,
    });
    return NextResponse.json({ candidates });
  }

  // verify domain MX once, and disposable per candidate
  const domain = candidates[0]?.domain;
  const mx = domain ? await hasMx(domain) : false;

  const enriched = await Promise.all(
    candidates.map(async (c) => {
      const disp = await isDisposableEmail(c.email);
      const score = c.score + (mx ? 5 : -20) + (disp.disposable ? -50 : 0);
      return {
        ...c,
        mx,
        disposable: disp.disposable,
        disposableProvider: disp.provider,
        finalScore: score,
      };
    }),
  );

  enriched.sort((a, b) => b.finalScore - a.finalScore);

  void logUsage({
    customerId: auth.customerId,
    apiKeyId: auth.apiKeyId,
    route: "/api/v1/email/guess",
    method: "POST",
    status: 200,
    req,
  });

  return NextResponse.json({ candidates: enriched });
}


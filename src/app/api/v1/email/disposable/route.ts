import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiKey, logUsage } from "@/lib/api-key";
import { isDisposableEmail } from "@/lib/email/disposable";

const BodySchema = z.object({
  email: z.string().email(),
});

export async function GET(req: Request) {
  const auth = await requireApiKey(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const email = url.searchParams.get("email");
  if (!email) return NextResponse.json({ error: "Missing email" }, { status: 400 });

  const result = await isDisposableEmail(email);

  void logUsage({
    customerId: auth.customerId,
    apiKeyId: auth.apiKeyId,
    route: "/api/v1/email/disposable",
    method: "GET",
    status: 200,
    req,
  });

  return NextResponse.json({ email, ...result });
}

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

  const result = await isDisposableEmail(parsed.data.email);

  void logUsage({
    customerId: auth.customerId,
    apiKeyId: auth.apiKeyId,
    route: "/api/v1/email/disposable",
    method: "POST",
    status: 200,
    req,
  });

  return NextResponse.json({ email: parsed.data.email, ...result });
}


import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logUsage, requireApiKey } from "@/lib/api-key";

export async function GET(req: Request) {
  const auth = await requireApiKey(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const customer = await prisma.customer.findUnique({
    where: { id: auth.customerId },
    select: { id: true, name: true, email: true, createdAt: true },
  });

  const res = NextResponse.json({ customer });
  void logUsage({
    customerId: auth.customerId,
    apiKeyId: auth.apiKeyId,
    route: "/api/v1/me",
    method: "GET",
    status: 200,
    req,
  });
  return res;
}


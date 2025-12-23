import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logUsage, requireApiKey } from "@/lib/api-key";

export async function GET(req: Request) {
  const auth = await requireApiKey(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [total, last30d, byStatus] = await Promise.all([
    prisma.lead.count({ where: { customerId: auth.customerId } }),
    prisma.lead.count({ where: { customerId: auth.customerId, createdAt: { gte: since } } }),
    prisma.lead.groupBy({
      by: ["status"],
      where: { customerId: auth.customerId },
      _count: { _all: true },
    }),
  ]);

  void logUsage({
    customerId: auth.customerId,
    apiKeyId: auth.apiKeyId,
    route: "/api/v1/metrics",
    method: "GET",
    status: 200,
    req,
  });

  return NextResponse.json({
    totalLeads: total,
    leadsLast30Days: last30d,
    byStatus: Object.fromEntries(byStatus.map((x) => [x.status, x._count._all])),
  });
}


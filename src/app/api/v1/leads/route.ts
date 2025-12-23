import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { logUsage, requireApiKey } from "@/lib/api-key";
import type { Prisma } from "@prisma/client";

const CreateLeadSchema = z.object({
  companyName: z.string().min(1),
  website: z.string().url().optional().or(z.literal("")).transform((v) => (v ? v : undefined)),
  industry: z.string().optional(),
  location: z.string().optional(),
  status: z.enum(["NEW", "CONTACTED", "QUALIFIED", "WON", "LOST"]).optional(),
  owner: z.string().optional(),
  notes: z.string().optional(),
});

export async function GET(req: Request) {
  const auth = await requireApiKey(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const status = url.searchParams.get("status") ?? undefined;
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") ?? "25")));
  const cursor = url.searchParams.get("cursor") ?? undefined;

  const where: Prisma.LeadWhereInput = {
    customerId: auth.customerId,
  };
  if (status) where.status = status as any;
  if (q) {
    where.OR = [
      { companyName: { contains: q } },
      { website: { contains: q } },
      { industry: { contains: q } },
      { location: { contains: q } },
      { owner: { contains: q } },
    ];
  }

  const leads = await prisma.lead.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = leads.length > limit;
  const items = hasMore ? leads.slice(0, limit) : leads;
  const nextCursor = hasMore ? items[items.length - 1]?.id : null;

  void logUsage({
    customerId: auth.customerId,
    apiKeyId: auth.apiKeyId,
    route: "/api/v1/leads",
    method: "GET",
    status: 200,
    req,
  });

  return NextResponse.json({ leads: items, nextCursor });
}

export async function POST(req: Request) {
  const auth = await requireApiKey(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const json = await req.json().catch(() => null);
  const parsed = CreateLeadSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const lead = await prisma.lead.create({
    data: {
      ...parsed.data,
      customerId: auth.customerId,
    },
  });

  void logUsage({
    customerId: auth.customerId,
    apiKeyId: auth.apiKeyId,
    route: "/api/v1/leads",
    method: "POST",
    status: 201,
    req,
  });

  return NextResponse.json({ lead }, { status: 201 });
}


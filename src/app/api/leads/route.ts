import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
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
  try {
    // Apollo-style DB search:
    // /api/leads?q=...&status=NEW&limit=25&cursor=<id>
    const url = new URL(req.url);
    const q = (url.searchParams.get("q") ?? "").trim();
    const status = url.searchParams.get("status") ?? undefined;
    const limit = Math.min(
      100,
      Math.max(1, Number(url.searchParams.get("limit") ?? "50")),
    );
    const cursor = url.searchParams.get("cursor") ?? undefined;

    const where: Prisma.LeadWhereInput = {};
    if (status) where.status = status as any;
    if (q) {
      where.OR = [
        { companyName: { contains: q } },
        { website: { contains: q } },
        { industry: { contains: q } },
        { location: { contains: q } },
        { owner: { contains: q } },
        { email: { contains: q } },
        { phone: { contains: q } },
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

    return NextResponse.json({ leads: items, nextCursor });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to query database";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const json = await req.json().catch(() => null);
    const parsed = CreateLeadSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", issues: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const lead = await prisma.lead.create({ data: parsed.data });
    return NextResponse.json({ lead }, { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to create lead";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}


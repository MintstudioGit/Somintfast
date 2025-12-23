import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const CreateLeadSchema = z.object({
  companyName: z.string().min(1),
  website: z.string().url().optional().or(z.literal("")).transform((v) => (v ? v : undefined)),
  industry: z.string().optional(),
  location: z.string().optional(),
  status: z.enum(["NEW", "CONTACTED", "QUALIFIED", "WON", "LOST"]).optional(),
  owner: z.string().optional(),
  notes: z.string().optional(),
});

export async function GET() {
  try {
    const leads = await prisma.lead.findMany({
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ leads });
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


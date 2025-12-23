import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createApiKey } from "@/lib/api-key";

const CreateKeySchema = z.object({
  customer: z.object({
    name: z.string().min(1),
    email: z.string().email().optional(),
  }),
  keyName: z.string().min(1).default("Default"),
});

/**
 * Dev-friendly endpoint to create a customer + API key.
 * In production you’d protect this behind admin auth.
 */
export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = CreateKeySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { name, email } = parsed.data.customer;

  const customer = email
    ? await prisma.customer.upsert({
        where: { email },
        update: { name },
        create: { name, email },
      })
    : await prisma.customer.create({ data: { name } });

  const { token, apiKeyId } = await createApiKey({
    customerId: customer.id,
    name: parsed.data.keyName,
  });

  return NextResponse.json(
    {
      customer: { id: customer.id, name: customer.name, email: customer.email },
      apiKey: { id: apiKeyId, token },
    },
    { status: 201 },
  );
}


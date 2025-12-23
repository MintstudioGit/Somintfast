import crypto from "crypto";
import { prisma } from "@/lib/prisma";

export type ApiKeyAuth = {
  customerId: string;
  apiKeyId: string;
};

function sha256(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function randomToken(bytes = 24) {
  return crypto.randomBytes(bytes).toString("base64url");
}

export function extractApiKey(req: Request): string | null {
  const auth = req.headers.get("authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
  const headerKey = req.headers.get("x-api-key");
  if (headerKey) return headerKey.trim();
  return null;
}

export async function requireApiKey(req: Request): Promise<ApiKeyAuth | null> {
  const token = extractApiKey(req);
  if (!token) return null;

  // token format: mlb_<prefix>_<secret>
  const parts = token.split("_");
  if (parts.length < 3) return null;
  const prefix = parts[1] ?? "";
  const keyHash = sha256(token);

  const key = await prisma.apiKey.findFirst({
    where: { prefix, keyHash, revokedAt: null },
    select: { id: true, customerId: true },
  });
  if (!key) return null;

  await prisma.apiKey.update({
    where: { id: key.id },
    data: { lastUsedAt: new Date() },
  });

  return { apiKeyId: key.id, customerId: key.customerId };
}

export async function logUsage(args: {
  customerId: string;
  apiKeyId?: string;
  route: string;
  method: string;
  status: number;
  req: Request;
}) {
  const ip =
    args.req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    args.req.headers.get("x-real-ip") ??
    undefined;
  const userAgent = args.req.headers.get("user-agent") ?? undefined;

  try {
    await prisma.usageLog.create({
      data: {
        customerId: args.customerId,
        apiKeyId: args.apiKeyId,
        route: args.route,
        method: args.method,
        status: args.status,
        ip,
        userAgent,
      },
    });
  } catch {
    // best-effort
  }
}

export async function createApiKey(params: {
  customerId: string;
  name: string;
}): Promise<{ token: string; apiKeyId: string }> {
  const prefix = randomToken(6);
  const secret = randomToken(24);
  const token = `mlb_${prefix}_${secret}`;
  const keyHash = sha256(token);
  const last4 = token.slice(-4);

  const apiKey = await prisma.apiKey.create({
    data: {
      customerId: params.customerId,
      name: params.name,
      prefix,
      keyHash,
      last4,
    },
    select: { id: true },
  });

  return { token, apiKeyId: apiKey.id };
}


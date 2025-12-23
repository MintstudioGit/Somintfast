import { resolveMx } from "dns/promises";

export async function hasMx(domain: string): Promise<boolean> {
  try {
    const mx = await resolveMx(domain);
    return Array.isArray(mx) && mx.length > 0;
  } catch {
    return false;
  }
}


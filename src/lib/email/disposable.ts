const KICKBOX_BASE = "https://open.kickbox.com/v1/disposable";

export async function isDisposableEmail(email: string): Promise<{
  disposable: boolean;
  provider: "kickbox-open" | "local";
}> {
  const normalized = email.trim().toLowerCase();
  const domain = normalized.split("@")[1] ?? "";
  if (!domain) return { disposable: false, provider: "local" };

  // quick local blocklist (tiny, just common ones; external check is primary)
  const localDisposableDomains = new Set([
    "mailinator.com",
    "guerrillamail.com",
    "10minutemail.com",
    "tempmail.com",
    "yopmail.com",
  ]);
  if (localDisposableDomains.has(domain)) {
    return { disposable: true, provider: "local" };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 7000);
  try {
    const res = await fetch(`${KICKBOX_BASE}/${encodeURIComponent(normalized)}`, {
      signal: controller.signal,
      headers: { "accept": "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return { disposable: false, provider: "kickbox-open" };
    const json = (await res.json()) as { disposable?: boolean };
    return { disposable: Boolean(json?.disposable), provider: "kickbox-open" };
  } catch {
    return { disposable: false, provider: "kickbox-open" };
  } finally {
    clearTimeout(timer);
  }
}


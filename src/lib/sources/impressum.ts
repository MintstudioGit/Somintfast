import * as cheerio from "cheerio";

export type ImpressumResult = {
  owner?: string;
  email?: string;
  phone?: string;
  address?: string;
  sourceUrl?: string;
};

const IMPRESSUM_PATHS = [
  "/impressum",
  "/kontakt",
  "/imprint",
  "/legal",
  "/about",
  "/ueber-uns",
];

const EMAIL_RE = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
const PHONE_RE =
  /(\+?\d{1,3}[\s/.-]?)?(\(?\d{2,5}\)?[\s/.-]?)?\d{3,5}[\s/.-]?\d{3,6}/g;

function normalizeUrl(input: string) {
  const u = input.trim();
  if (u.startsWith("http://") || u.startsWith("https://")) return u;
  return `https://${u}`;
}

async function fetchHtml(url: string, timeoutMs = 10000): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "user-agent": "MintLeadBase/1.0 (lead enrichment)",
        "accept": "text/html,application/xhtml+xml",
      },
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function pickFirstMatch(re: RegExp, text: string): string | undefined {
  re.lastIndex = 0;
  const m = re.exec(text);
  return m?.[0];
}

function extractAddress(text: string): string | undefined {
  // very lightweight heuristic for German addresses
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const streetIdx = lines.findIndex((l) =>
    /\b(straße|str\.|weg|platz|allee|gasse)\b/i.test(l),
  );
  if (streetIdx === -1) return undefined;
  const street = lines[streetIdx];
  const city = lines.slice(streetIdx + 1, streetIdx + 4).find((l) => /\b\d{5}\b/.test(l));
  if (city) return `${street}, ${city}`;
  return street;
}

function extractOwner(text: string): string | undefined {
  const patterns = [
    /Geschäftsführer[:\s]+([A-ZÄÖÜ][^\n,]{3,80})/i,
    /Inhaber[:\s]+([A-ZÄÖÜ][^\n,]{3,80})/i,
    /Vertretungsberechtigter[:\s]+([A-ZÄÖÜ][^\n,]{3,80})/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m?.[1]) return m[1].trim();
  }
  return undefined;
}

export async function scrapeImpressum(websiteOrDomain: string): Promise<ImpressumResult> {
  const base = new URL(normalizeUrl(websiteOrDomain));
  const candidates = IMPRESSUM_PATHS.map((p) => new URL(p, base).toString());

  // also try www. variant if host has no subdomain
  if (!base.hostname.startsWith("www.")) {
    const withWww = new URL(base.toString());
    withWww.hostname = `www.${base.hostname}`;
    candidates.push(...IMPRESSUM_PATHS.map((p) => new URL(p, withWww).toString()));
  }

  for (const url of candidates) {
    const html = await fetchHtml(url);
    if (!html) continue;

    const $ = cheerio.load(html);
    const text = $("body").text();

    const email = pickFirstMatch(EMAIL_RE, text);
    const phone = pickFirstMatch(PHONE_RE, text);
    const owner = extractOwner(text);
    const address = extractAddress(text);

    if (email || phone || owner || address) {
      return { email, phone, owner, address, sourceUrl: url };
    }
  }

  return {};
}


import punycode from "punycode/";

export type GuessEmailInput = {
  firstName?: string;
  lastName?: string;
  fullName?: string;
  domain?: string; // example.com
  companyName?: string;
};

export type EmailCandidate = {
  email: string;
  localPart: string;
  domain: string;
  pattern: string;
  score: number;
};

function normalizeDomain(domain: string): string | null {
  const d = domain.trim().toLowerCase();
  if (!d) return null;
  const withoutProto = d.replace(/^https?:\/\//, "");
  const host = withoutProto.split("/")[0] ?? "";
  const clean = host.replace(/^www\./, "");
  if (!clean.includes(".")) return null;
  // IDN support
  return punycode.toASCII(clean);
}

function slug(s: string) {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, "-");
}

function nameParts(input: GuessEmailInput): { first?: string; last?: string } {
  const first = input.firstName?.trim();
  const last = input.lastName?.trim();
  if (first || last) return { first: first || undefined, last: last || undefined };

  const full = input.fullName?.trim();
  if (!full) return {};
  const parts = full.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return { first: parts[0] };
  return { first: parts[0], last: parts.slice(1).join(" ") };
}

function toLocalAtom(s: string): string {
  return slug(s).replace(/-/g, "");
}

export function guessEmails(input: GuessEmailInput, limit = 15): EmailCandidate[] {
  const domain = input.domain ? normalizeDomain(input.domain) : null;
  if (!domain) return [];

  const { first, last } = nameParts(input);
  const f = first ? toLocalAtom(first) : "";
  const l = last ? toLocalAtom(last) : "";
  const fi = f ? f[0] : "";
  const li = l ? l[0] : "";

  const companyToken = input.companyName ? toLocalAtom(input.companyName) : "";

  const patterns: Array<{ pattern: string; make: () => string | null; score: number }> = [
    { pattern: "first.last", make: () => (f && l ? `${f}.${l}` : null), score: 100 },
    { pattern: "firstlast", make: () => (f && l ? `${f}${l}` : null), score: 96 },
    { pattern: "f.last", make: () => (fi && l ? `${fi}.${l}` : null), score: 94 },
    { pattern: "first.l", make: () => (f && li ? `${f}.${li}` : null), score: 90 },
    { pattern: "first", make: () => (f ? `${f}` : null), score: 70 },
    { pattern: "last", make: () => (l ? `${l}` : null), score: 65 },
    { pattern: "flast", make: () => (fi && l ? `${fi}${l}` : null), score: 88 },
    { pattern: "firstl", make: () => (f && li ? `${f}${li}` : null), score: 84 },
    { pattern: "f.l", make: () => (fi && li ? `${fi}.${li}` : null), score: 78 },
    { pattern: "info", make: () => "info", score: 30 },
    { pattern: "kontakt", make: () => "kontakt", score: 28 },
    { pattern: "hello", make: () => "hello", score: 24 },
    { pattern: "office", make: () => "office", score: 22 },
    { pattern: "company", make: () => (companyToken ? `${companyToken}` : null), score: 18 },
  ];

  const seen = new Set<string>();
  const candidates: EmailCandidate[] = [];
  for (const p of patterns) {
    const local = p.make();
    if (!local) continue;
    const normalizedLocal = local
      .toLowerCase()
      .replace(/[^a-z0-9._+-]/g, "")
      .replace(/^\.+|\.+$/g, "")
      .replace(/\.\.+/g, ".");
    if (!normalizedLocal) continue;
    const email = `${normalizedLocal}@${domain}`;
    if (seen.has(email)) continue;
    seen.add(email);
    candidates.push({
      email,
      localPart: normalizedLocal,
      domain,
      pattern: p.pattern,
      score: p.score,
    });
    if (candidates.length >= limit) break;
  }

  return candidates.sort((a, b) => b.score - a.score);
}


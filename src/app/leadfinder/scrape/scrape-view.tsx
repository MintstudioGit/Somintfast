"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Globe,
  Loader2,
  CheckCircle2,
  XCircle,
  Building2,
  Mail,
  Phone,
  MapPin,
  AlertCircle,
  Star,
  Search,
  Plus,
  Trash2,
} from "lucide-react";

interface ScrapeResult {
  success: boolean;
  data?: {
    id: string;
    companyName: string | null;
    websiteUrl: string;
    ownerName: string | null;
    email: string | null;
    phone: string | null;
    address: string | null;
    tier: string;
    scrapedAt: string;
    googleMapsData: {
      name: string;
      rating?: number;
      placeId: string;
    } | null;
    verification: {
      status: string;
      isValid: boolean;
      overallScore: number | null;
      provider: string | null;
    } | null;
  };
  meta?: {
    scrapingDepth: string;
    remainingToday: number;
    dataSources: {
      impressum: boolean;
      googleMaps: boolean;
      emailVerification: boolean;
    };
  };
  error?: string;
}

export default function ScrapingInterface() {
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [tier, setTier] = useState<string>("STARTER");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScrapeResult | null>(null);

  // Bulk scraping
  const [bulkUrls, setBulkUrls] = useState("");
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkResults, setBulkResults] = useState<Array<{ url: string; result: ScrapeResult }>>([]);
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0 });

  const scrapeSingleWebsite = async () => {
    if (!websiteUrl.trim()) return;

    setLoading(true);
    setResult(null);

    try {
      const res = await fetch("/api/leadfinder/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          websiteUrl: websiteUrl.trim(),
          tier,
          verifyEmail: true,
        }),
      });

      const data: ScrapeResult = await res.json();
      setResult(data);

      if (data.success) {
        // Clear the input on success
        setWebsiteUrl("");
      }
    } catch (error) {
      setResult({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setLoading(false);
    }
  };

  const scrapeBulkWebsites = async () => {
    const urls = bulkUrls
      .split("\n")
      .map((url) => url.trim())
      .filter((url) => url.length > 0);

    if (urls.length === 0) return;

    setBulkLoading(true);
    setBulkResults([]);
    setBulkProgress({ current: 0, total: urls.length });

    const results: Array<{ url: string; result: ScrapeResult }> = [];

    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      setBulkProgress({ current: i + 1, total: urls.length });

      try {
        const res = await fetch("/api/leadfinder/scrape", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            websiteUrl: url,
            tier,
            verifyEmail: true,
          }),
        });

        const data: ScrapeResult = await res.json();
        results.push({ url, result: data });
      } catch (error) {
        results.push({
          url,
          result: {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
          },
        });
      }

      // Small delay between requests to avoid overwhelming the server
      if (i < urls.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    setBulkResults(results);
    setBulkLoading(false);
    setBulkUrls("");
  };

  const getEmailStatusBadge = (status: string | undefined, isValid: boolean) => {
    if (!status) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">
          <AlertCircle className="h-3 w-3" />
          Not Verified
        </span>
      );
    }

    switch (status) {
      case "VALID":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
            <CheckCircle2 className="h-3 w-3" />
            Valid
          </span>
        );
      case "INVALID":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700">
            <XCircle className="h-3 w-3" />
            Invalid
          </span>
        );
      case "RISKY":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
            <AlertCircle className="h-3 w-3" />
            Risky
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">
            <AlertCircle className="h-3 w-3" />
            {status}
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="mx-auto max-w-7xl px-6 py-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-zinc-900">
              Scrape Leads
            </h1>
            <p className="mt-2 text-zinc-600">
              Extract B2B contact information from websites
            </p>
          </div>
          <Link
            href="/leadfinder"
            className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            <Search className="h-4 w-4" />
            Search Leads
          </Link>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Single Scrape */}
          <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-zinc-900">
              Single Website Scrape
            </h2>
            <p className="mt-1 text-sm text-zinc-600">
              Enter a website URL to extract lead information
            </p>

            <div className="mt-6 space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-700">
                  Website URL
                </label>
                <div className="relative">
                  <Globe className="pointer-events-none absolute left-3 top-3 h-5 w-5 text-zinc-400" />
                  <input
                    type="url"
                    value={websiteUrl}
                    onChange={(e) => setWebsiteUrl(e.target.value)}
                    placeholder="https://example.com"
                    className="w-full rounded-lg border border-zinc-200 bg-white py-2.5 pl-10 pr-4 text-sm outline-none focus:border-zinc-300 focus:ring-2 focus:ring-zinc-100"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !loading) {
                        scrapeSingleWebsite();
                      }
                    }}
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-700">
                  Data Quality Tier
                </label>
                <select
                  value={tier}
                  onChange={(e) => setTier(e.target.value)}
                  className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-zinc-300 focus:ring-2 focus:ring-zinc-100"
                >
                  <option value="SOLO">Solo - Basic scraping (€49/mo)</option>
                  <option value="STARTER">Starter - Enhanced + SMTP (€149/mo)</option>
                  <option value="TEAM">Team - Premium + Reoon (€345/mo)</option>
                  <option value="PROFESSIONAL">Professional - Advanced (€995/mo)</option>
                  <option value="ENTERPRISE">Enterprise - Full features (€1,990/mo)</option>
                </select>
              </div>

              <button
                onClick={scrapeSingleWebsite}
                disabled={loading || !websiteUrl.trim()}
                className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Scraping...
                  </>
                ) : (
                  <>
                    <Globe className="h-4 w-4" />
                    Scrape Website
                  </>
                )}
              </button>
            </div>

            {/* Single Result */}
            {result && (
              <div className="mt-6 rounded-lg border border-zinc-200 p-4">
                {result.success && result.data ? (
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2 text-emerald-700">
                        <CheckCircle2 className="h-5 w-5" />
                        <span className="font-medium">Successfully scraped!</span>
                      </div>
                      {result.data.googleMapsData?.rating && (
                        <div className="flex items-center gap-1 rounded bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700">
                          <Star className="h-3 w-3 fill-current" />
                          {result.data.googleMapsData.rating.toFixed(1)}
                        </div>
                      )}
                    </div>

                    <div>
                      <div className="text-sm font-medium text-zinc-700">Company</div>
                      <div className="mt-1 text-lg font-semibold text-zinc-900">
                        {result.data.companyName || "Unknown"}
                      </div>
                    </div>

                    {result.data.ownerName && (
                      <div className="flex items-center gap-2 text-sm text-zinc-700">
                        <Building2 className="h-4 w-4 text-zinc-400" />
                        {result.data.ownerName}
                      </div>
                    )}

                    {result.data.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-emerald-600" />
                        <span className="text-sm text-zinc-700">{result.data.email}</span>
                        {result.data.verification &&
                          getEmailStatusBadge(
                            result.data.verification.status,
                            result.data.verification.isValid
                          )}
                      </div>
                    )}

                    {result.data.phone && (
                      <div className="flex items-center gap-2 text-sm text-zinc-700">
                        <Phone className="h-4 w-4 text-blue-600" />
                        {result.data.phone}
                      </div>
                    )}

                    {result.data.address && (
                      <div className="flex items-center gap-2 text-sm text-zinc-600">
                        <MapPin className="h-4 w-4 text-zinc-400" />
                        {result.data.address}
                      </div>
                    )}

                    {result.meta && (
                      <div className="border-t border-zinc-200 pt-3 text-xs text-zinc-600">
                        <div>Data sources: {Object.keys(result.meta.dataSources).filter(k => result.meta!.dataSources[k as keyof typeof result.meta.dataSources]).join(", ")}</div>
                        <div className="mt-1">Scraping depth: {result.meta.scrapingDepth}</div>
                        <div className="mt-1">Remaining today: {result.meta.remainingToday}</div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-start gap-2 text-rose-700">
                    <XCircle className="h-5 w-5 flex-shrink-0" />
                    <div>
                      <div className="font-medium">Scraping failed</div>
                      <div className="mt-1 text-sm text-rose-600">
                        {result.error || "Unknown error"}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Bulk Scrape */}
          <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-zinc-900">
              Bulk Website Scrape
            </h2>
            <p className="mt-1 text-sm text-zinc-600">
              Enter multiple URLs (one per line) to scrape in batch
            </p>

            <div className="mt-6 space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-700">
                  Website URLs (one per line)
                </label>
                <textarea
                  value={bulkUrls}
                  onChange={(e) => setBulkUrls(e.target.value)}
                  placeholder="https://example1.com&#10;https://example2.com&#10;https://example3.com"
                  rows={8}
                  className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-zinc-300 focus:ring-2 focus:ring-zinc-100"
                />
              </div>

              <button
                onClick={scrapeBulkWebsites}
                disabled={bulkLoading || !bulkUrls.trim()}
                className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
              >
                {bulkLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Scraping {bulkProgress.current}/{bulkProgress.total}...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
                    Scrape {bulkUrls.split("\n").filter((u) => u.trim()).length} Websites
                  </>
                )}
              </button>
            </div>

            {/* Bulk Results */}
            {bulkResults.length > 0 && (
              <div className="mt-6 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium text-zinc-700">
                    Results ({bulkResults.length})
                  </div>
                  <button
                    onClick={() => setBulkResults([])}
                    className="inline-flex items-center gap-1 text-xs text-zinc-600 hover:text-zinc-900"
                  >
                    <Trash2 className="h-3 w-3" />
                    Clear
                  </button>
                </div>

                <div className="max-h-96 space-y-2 overflow-y-auto">
                  {bulkResults.map((item, idx) => (
                    <div
                      key={idx}
                      className={`rounded-lg border p-3 ${
                        item.result.success
                          ? "border-emerald-200 bg-emerald-50"
                          : "border-rose-200 bg-rose-50"
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        {item.result.success ? (
                          <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-emerald-600" />
                        ) : (
                          <XCircle className="h-4 w-4 flex-shrink-0 text-rose-600" />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium text-zinc-900">
                            {item.result.data?.companyName || new URL(item.url).hostname}
                          </div>
                          <div className="mt-1 truncate text-xs text-zinc-600">
                            {item.url}
                          </div>
                          {item.result.success && item.result.data?.email && (
                            <div className="mt-2 flex items-center gap-2 text-xs">
                              <Mail className="h-3 w-3" />
                              <span className="truncate">{item.result.data.email}</span>
                            </div>
                          )}
                          {!item.result.success && item.result.error && (
                            <div className="mt-1 text-xs text-rose-600">
                              {item.result.error}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="border-t border-zinc-200 pt-3 text-xs text-zinc-600">
                  {bulkResults.filter((r) => r.result.success).length} successful,{" "}
                  {bulkResults.filter((r) => !r.result.success).length} failed
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Info Panel */}
        <div className="mt-6 rounded-xl border border-blue-200 bg-blue-50 p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 flex-shrink-0 text-blue-600" />
            <div>
              <h3 className="font-medium text-blue-900">How it works</h3>
              <ul className="mt-2 space-y-1 text-sm text-blue-800">
                <li>• Scrapes German Impressum pages for contact information</li>
                <li>• Enriches data with Google Maps (ratings, verified info)</li>
                <li>• Verifies emails using SMTP (Starter+) or Reoon API (Team+)</li>
                <li>• All scraped leads are searchable in the LeadFinder search page</li>
                <li>• Different tiers provide different data quality and verification levels</li>
              </ul>
              <div className="mt-4">
                <Link
                  href="/leadfinder"
                  className="inline-flex items-center gap-1 text-sm font-medium text-blue-900 hover:underline"
                >
                  <Search className="h-4 w-4" />
                  Search scraped leads →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

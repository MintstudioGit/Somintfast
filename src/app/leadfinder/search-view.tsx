"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Search,
  Filter,
  Download,
  Building2,
  Mail,
  Phone,
  MapPin,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Globe,
  Star,
  X,
} from "lucide-react";

interface LeadResult {
  id: string;
  companyName: string | null;
  websiteUrl: string;
  ownerName: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  tier: string;
  scrapedAt: string;
  googleMaps: {
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
}

interface SearchResponse {
  success: boolean;
  data: LeadResult[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
    stats: {
      total: number;
      withEmail: number;
      withPhone: number;
      emailVerified: number;
    };
  };
}

export default function LeadFinderSearch() {
  const [searchQuery, setSearchQuery] = useState("");
  const [leads, setLeads] = useState<LeadResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState<SearchResponse["meta"] | null>(null);
  const [selectedLead, setSelectedLead] = useState<LeadResult | null>(null);

  // Filters
  const [filters, setFilters] = useState({
    hasEmail: "",
    hasPhone: "",
    emailStatus: "",
    tier: "",
  });
  const [showFilters, setShowFilters] = useState(false);

  const searchLeads = useCallback(async (query: string, currentPage: number, currentFilters: typeof filters) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        q: query,
        page: currentPage.toString(),
        limit: "25",
      });

      // Add filters
      if (currentFilters.hasEmail) params.set("hasEmail", currentFilters.hasEmail);
      if (currentFilters.hasPhone) params.set("hasPhone", currentFilters.hasPhone);
      if (currentFilters.emailStatus) params.set("emailStatus", currentFilters.emailStatus);
      if (currentFilters.tier) params.set("tier", currentFilters.tier);

      const res = await fetch(`/api/leadfinder/search?${params}`);
      const json: SearchResponse = await res.json();

      if (json.success) {
        setLeads(json.data);
        setMeta(json.meta);
      }
    } catch (error) {
      console.error("Search error:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    searchLeads(searchQuery, page, filters);
  }, [searchQuery, page, filters, searchLeads]);

  const exportToCSV = () => {
    if (leads.length === 0) return;

    const headers = [
      "Company Name",
      "Website",
      "Owner",
      "Email",
      "Phone",
      "Address",
      "Email Status",
      "Email Valid",
      "Scraped Date",
    ];

    const rows = leads.map((lead) => [
      lead.companyName || "",
      lead.websiteUrl,
      lead.ownerName || "",
      lead.email || "",
      lead.phone || "",
      lead.address || "",
      lead.verification?.status || "Not Verified",
      lead.verification?.isValid ? "Yes" : "No",
      new Date(lead.scrapedAt).toLocaleDateString(),
    ]);

    const csv = [
      headers.join(","),
      ...rows.map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `leadfinder-export-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
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

  const activeFilterCount = Object.values(filters).filter((v) => v !== "").length;

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="mx-auto max-w-7xl px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900">
            LeadFinder
          </h1>
          <p className="mt-2 text-zinc-600">
            Search and discover B2B leads with verified contact information
          </p>
        </div>

        {/* Search Bar */}
        <div className="mb-6 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-3 h-5 w-5 text-zinc-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                placeholder="Search companies, websites, emails, owners..."
                className="w-full rounded-lg border border-zinc-200 bg-white py-2.5 pl-10 pr-4 text-sm outline-none focus:border-zinc-300 focus:ring-2 focus:ring-zinc-100"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
                  showFilters || activeFilterCount > 0
                    ? "border-zinc-900 bg-zinc-900 text-white"
                    : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
                }`}
              >
                <Filter className="h-4 w-4" />
                Filters
                {activeFilterCount > 0 && (
                  <span className="ml-1 rounded-full bg-white px-1.5 py-0.5 text-xs text-zinc-900">
                    {activeFilterCount}
                  </span>
                )}
              </button>

              <button
                onClick={exportToCSV}
                disabled={leads.length === 0}
                className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
              >
                <Download className="h-4 w-4" />
                Export CSV
              </button>
            </div>
          </div>

          {/* Filters Panel */}
          {showFilters && (
            <div className="mt-4 grid gap-4 border-t border-zinc-200 pt-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-700">
                  Has Email
                </label>
                <select
                  value={filters.hasEmail}
                  onChange={(e) => {
                    setFilters({ ...filters, hasEmail: e.target.value });
                    setPage(1);
                  }}
                  className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-300 focus:ring-2 focus:ring-zinc-100"
                >
                  <option value="">All</option>
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-700">
                  Has Phone
                </label>
                <select
                  value={filters.hasPhone}
                  onChange={(e) => {
                    setFilters({ ...filters, hasPhone: e.target.value });
                    setPage(1);
                  }}
                  className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-300 focus:ring-2 focus:ring-zinc-100"
                >
                  <option value="">All</option>
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-700">
                  Email Status
                </label>
                <select
                  value={filters.emailStatus}
                  onChange={(e) => {
                    setFilters({ ...filters, emailStatus: e.target.value });
                    setPage(1);
                  }}
                  className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-300 focus:ring-2 focus:ring-zinc-100"
                >
                  <option value="">All</option>
                  <option value="VALID">Valid</option>
                  <option value="INVALID">Invalid</option>
                  <option value="RISKY">Risky</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-700">
                  Data Tier
                </label>
                <select
                  value={filters.tier}
                  onChange={(e) => {
                    setFilters({ ...filters, tier: e.target.value });
                    setPage(1);
                  }}
                  className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-300 focus:ring-2 focus:ring-zinc-100"
                >
                  <option value="">All Tiers</option>
                  <option value="SOLO">Solo</option>
                  <option value="STARTER">Starter</option>
                  <option value="TEAM">Team</option>
                  <option value="PROFESSIONAL">Professional</option>
                  <option value="ENTERPRISE">Enterprise</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Stats */}
        {meta && (
          <div className="mb-6 grid gap-4 sm:grid-cols-4">
            <div className="rounded-lg border border-zinc-200 bg-white p-4">
              <div className="text-sm text-zinc-600">Total Results</div>
              <div className="mt-1 text-2xl font-semibold text-zinc-900">
                {meta.stats.total.toLocaleString()}
              </div>
            </div>
            <div className="rounded-lg border border-zinc-200 bg-white p-4">
              <div className="text-sm text-zinc-600">With Email</div>
              <div className="mt-1 text-2xl font-semibold text-emerald-600">
                {meta.stats.withEmail.toLocaleString()}
              </div>
            </div>
            <div className="rounded-lg border border-zinc-200 bg-white p-4">
              <div className="text-sm text-zinc-600">With Phone</div>
              <div className="mt-1 text-2xl font-semibold text-blue-600">
                {meta.stats.withPhone.toLocaleString()}
              </div>
            </div>
            <div className="rounded-lg border border-zinc-200 bg-white p-4">
              <div className="text-sm text-zinc-600">Email Verified</div>
              <div className="mt-1 text-2xl font-semibold text-purple-600">
                {meta.stats.emailVerified.toLocaleString()}
              </div>
            </div>
          </div>
        )}

        {/* Results */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_380px]">
          {/* Results Table */}
          <div className="space-y-4">
            {loading ? (
              <div className="flex items-center justify-center rounded-xl border border-zinc-200 bg-white p-12">
                <div className="text-center">
                  <Loader2 className="mx-auto h-8 w-8 animate-spin text-zinc-400" />
                  <p className="mt-2 text-sm text-zinc-600">Searching leads...</p>
                </div>
              </div>
            ) : leads.length === 0 ? (
              <div className="rounded-xl border border-zinc-200 bg-white p-12 text-center">
                <Building2 className="mx-auto h-12 w-12 text-zinc-300" />
                <h3 className="mt-4 text-lg font-semibold text-zinc-900">
                  No leads found
                </h3>
                <p className="mt-2 text-sm text-zinc-600">
                  Try adjusting your search query or filters
                </p>
              </div>
            ) : (
              <>
                {leads.map((lead) => (
                  <div
                    key={lead.id}
                    onClick={() => setSelectedLead(lead)}
                    className={`cursor-pointer rounded-xl border bg-white p-4 transition-all hover:border-zinc-300 hover:shadow-md ${
                      selectedLead?.id === lead.id
                        ? "border-zinc-900 shadow-md"
                        : "border-zinc-200"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="truncate text-lg font-semibold text-zinc-900">
                            {lead.companyName || "Unknown Company"}
                          </h3>
                          {lead.googleMaps?.rating && (
                            <div className="flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 text-xs font-medium text-amber-700">
                              <Star className="h-3 w-3 fill-current" />
                              {lead.googleMaps.rating.toFixed(1)}
                            </div>
                          )}
                        </div>

                        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-zinc-600">
                          {lead.websiteUrl && (
                            <a
                              href={lead.websiteUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1 hover:text-zinc-900"
                            >
                              <Globe className="h-4 w-4" />
                              {new URL(lead.websiteUrl).hostname}
                            </a>
                          )}
                          {lead.ownerName && (
                            <span className="inline-flex items-center gap-1">
                              <Building2 className="h-4 w-4" />
                              {lead.ownerName}
                            </span>
                          )}
                        </div>

                        <div className="mt-3 flex flex-wrap items-center gap-3">
                          {lead.email ? (
                            <div className="flex items-center gap-2">
                              <Mail className="h-4 w-4 text-emerald-600" />
                              <span className="text-sm text-zinc-700">
                                {lead.email}
                              </span>
                              {getEmailStatusBadge(
                                lead.verification?.status,
                                lead.verification?.isValid || false
                              )}
                            </div>
                          ) : (
                            <span className="text-sm text-zinc-400">No email</span>
                          )}
                        </div>

                        {lead.phone && (
                          <div className="mt-2 flex items-center gap-2">
                            <Phone className="h-4 w-4 text-blue-600" />
                            <span className="text-sm text-zinc-700">{lead.phone}</span>
                          </div>
                        )}

                        {lead.address && (
                          <div className="mt-2 flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-zinc-400" />
                            <span className="text-sm text-zinc-600">{lead.address}</span>
                          </div>
                        )}
                      </div>

                      <div className="text-right">
                        <div className="rounded bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-700">
                          {lead.tier}
                        </div>
                        <div className="mt-2 text-xs text-zinc-500">
                          {new Date(lead.scrapedAt).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Pagination */}
                {meta && meta.totalPages > 1 && (
                  <div className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white px-4 py-3">
                    <div className="text-sm text-zinc-600">
                      Page {meta.page} of {meta.totalPages} ({meta.total.toLocaleString()}{" "}
                      total)
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                      >
                        <ChevronLeft className="h-4 w-4" />
                        Previous
                      </button>
                      <button
                        onClick={() => setPage((p) => p + 1)}
                        disabled={!meta.hasMore}
                        className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                      >
                        Next
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Details Panel */}
          <aside className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm lg:sticky lg:top-8 lg:h-fit">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-zinc-900">Lead Details</h2>
              {selectedLead && (
                <button
                  onClick={() => setSelectedLead(null)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg hover:bg-zinc-100"
                >
                  <X className="h-4 w-4 text-zinc-500" />
                </button>
              )}
            </div>

            {!selectedLead ? (
              <div className="mt-4 rounded-lg border border-dashed border-zinc-200 bg-zinc-50 p-8 text-center">
                <Building2 className="mx-auto h-8 w-8 text-zinc-300" />
                <p className="mt-2 text-sm text-zinc-600">
                  Select a lead to view details
                </p>
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                <div>
                  <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Company
                  </div>
                  <div className="mt-1 text-base font-semibold text-zinc-900">
                    {selectedLead.companyName || "Unknown"}
                  </div>
                </div>

                {selectedLead.websiteUrl && (
                  <div>
                    <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                      Website
                    </div>
                    <a
                      href={selectedLead.websiteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 block text-sm text-blue-600 hover:underline"
                    >
                      {selectedLead.websiteUrl}
                    </a>
                  </div>
                )}

                {selectedLead.ownerName && (
                  <div>
                    <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                      Owner
                    </div>
                    <div className="mt-1 text-sm text-zinc-900">
                      {selectedLead.ownerName}
                    </div>
                  </div>
                )}

                {selectedLead.email && (
                  <div>
                    <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                      Email
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <a
                        href={`mailto:${selectedLead.email}`}
                        className="text-sm text-blue-600 hover:underline"
                      >
                        {selectedLead.email}
                      </a>
                    </div>
                    {selectedLead.verification && (
                      <div className="mt-2">
                        {getEmailStatusBadge(
                          selectedLead.verification.status,
                          selectedLead.verification.isValid
                        )}
                        {selectedLead.verification.overallScore !== null && (
                          <div className="mt-1 text-xs text-zinc-600">
                            Score: {selectedLead.verification.overallScore}%
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {selectedLead.phone && (
                  <div>
                    <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                      Phone
                    </div>
                    <a
                      href={`tel:${selectedLead.phone}`}
                      className="mt-1 block text-sm text-blue-600 hover:underline"
                    >
                      {selectedLead.phone}
                    </a>
                  </div>
                )}

                {selectedLead.address && (
                  <div>
                    <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                      Address
                    </div>
                    <div className="mt-1 text-sm text-zinc-900">
                      {selectedLead.address}
                    </div>
                  </div>
                )}

                {selectedLead.googleMaps && (
                  <div>
                    <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                      Google Maps
                    </div>
                    <div className="mt-1 text-sm text-zinc-900">
                      {selectedLead.googleMaps.rating && (
                        <div className="flex items-center gap-2">
                          <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                          <span>{selectedLead.googleMaps.rating.toFixed(1)} rating</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="border-t border-zinc-200 pt-4">
                  <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Data Quality
                  </div>
                  <div className="mt-2 rounded bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-700">
                    {selectedLead.tier} Tier
                  </div>
                  <div className="mt-2 text-xs text-zinc-600">
                    Scraped {new Date(selectedLead.scrapedAt).toLocaleDateString()}
                  </div>
                </div>
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}

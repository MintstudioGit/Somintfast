"use client";

import { useEffect, useMemo, useState } from "react";
import type { Lead } from "@prisma/client";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Columns3,
  Filter,
  Loader2,
  Plus,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";

type LeadRow = Lead;

function badgeClasses(status: Lead["status"]) {
  switch (status) {
    case "NEW":
      return "bg-zinc-100 text-zinc-700 border-zinc-200";
    case "CONTACTED":
      return "bg-blue-50 text-blue-700 border-blue-200";
    case "QUALIFIED":
      return "bg-amber-50 text-amber-800 border-amber-200";
    case "WON":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "LOST":
      return "bg-rose-50 text-rose-700 border-rose-200";
    default:
      return "bg-zinc-100 text-zinc-700 border-zinc-200";
  }
}

export default function DatabaseView() {
  const [tab, setTab] = useState<"database" | "discover">("database");
  const [rows, setRows] = useState<LeadRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [globalFilter, setGlobalFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [discoverCity, setDiscoverCity] = useState("Berlin");
  const [discoverQuery, setDiscoverQuery] = useState("zahnarzt");
  const [discoverLoading, setDiscoverLoading] = useState(false);
  const [discoverError, setDiscoverError] = useState<string | null>(null);
  const [discoverPlaces, setDiscoverPlaces] = useState<
    Array<{
      name: string;
      website?: string;
      phone?: string;
      email?: string;
      address?: string;
      location?: string;
    }>
  >([]);

  const selected = useMemo(
    () => rows.find((r) => r.id === selectedId) ?? null,
    [rows, selectedId],
  );

  const columns = useMemo<ColumnDef<LeadRow>[]>(
    () => [
      {
        accessorKey: "companyName",
        header: "Company",
        cell: ({ row }) => (
          <div className="min-w-0">
            <div className="truncate font-medium text-zinc-950">
              {row.original.companyName}
            </div>
            <div className="truncate text-xs text-zinc-500">
              {row.original.website ?? "—"}
            </div>
          </div>
        ),
      },
      { accessorKey: "industry", header: "Industry", cell: (info) => info.getValue() ?? "—" },
      { accessorKey: "location", header: "Location", cell: (info) => info.getValue() ?? "—" },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
          <span
            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${badgeClasses(row.original.status)}`}
          >
            {row.original.status}
          </span>
        ),
      },
      { accessorKey: "owner", header: "Owner", cell: (info) => info.getValue() ?? "—" },
      {
        accessorKey: "createdAt",
        header: "Created",
        cell: ({ row }) => (
          <span className="text-zinc-600">
            {new Date(row.original.createdAt).toLocaleDateString()}
          </span>
        ),
      },
    ],
    [],
  );

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setLoadError(null);
      try {
        const params = new URLSearchParams();
        if (globalFilter.trim()) params.set("q", globalFilter.trim());
        if (statusFilter) params.set("status", statusFilter);
        params.set("limit", "200");

        const res = await fetch(`/api/leads?${params.toString()}`, { cache: "no-store" });
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(
            `Failed to load leads (${res.status}). ${
              text ? "Server response: " + text.slice(0, 200) : ""
            }`.trim(),
          );
        }

        const contentType = res.headers.get("content-type") ?? "";
        if (!contentType.includes("application/json")) {
          const text = await res.text().catch(() => "");
          throw new Error(
            `Expected JSON but got '${contentType}'. ${
              text ? "Server response: " + text.slice(0, 200) : ""
            }`.trim(),
          );
        }

        const json = (await res.json()) as { leads?: LeadRow[] };
        if (!cancelled) {
          setRows(json.leads ?? []);
          table.setPageIndex(0);
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : "Failed to load leads";
        if (!cancelled) setLoadError(message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    const t = setTimeout(() => void load(), 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [globalFilter, statusFilter, table]);

  async function discoverSearch() {
    setDiscoverLoading(true);
    setDiscoverError(null);
    try {
      const params = new URLSearchParams();
      params.set("city", discoverCity.trim());
      if (discoverQuery.trim()) params.set("q", discoverQuery.trim());
      params.set("limit", "25");
      const res = await fetch(`/api/discover/osm?${params.toString()}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`Discover failed (${res.status})`);
      const json = (await res.json()) as { places?: any[] };
      setDiscoverPlaces(Array.isArray(json.places) ? json.places : []);
    } catch (e) {
      setDiscoverError(e instanceof Error ? e.message : "Discover failed");
    } finally {
      setDiscoverLoading(false);
    }
  }

  async function importDiscover() {
    setDiscoverLoading(true);
    setDiscoverError(null);
    try {
      const res = await fetch("/api/discover/osm/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          city: discoverCity.trim(),
          q: discoverQuery.trim() || undefined,
          limit: 25,
        }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Import failed (${res.status}) ${text.slice(0, 200)}`.trim());
      }
      const json = (await res.json()) as { leads?: LeadRow[] };
      if (Array.isArray(json.leads) && json.leads.length) {
        setTab("database");
        setRows((prev) => [...json.leads!, ...prev]);
      }
    } catch (e) {
      setDiscoverError(e instanceof Error ? e.message : "Import failed");
    } finally {
      setDiscoverLoading(false);
    }
  }

  async function createDemoLead() {
    const res = await fetch("/api/leads", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        companyName: `New Lead ${Math.floor(Math.random() * 1000)}`,
        website: "https://example.com",
        industry: "Software",
        location: "Berlin, DE",
        status: "NEW",
        owner: "—",
        notes: "Created from UI",
      }),
    });
    if (!res.ok) return;
    const json = (await res.json()) as { lead: LeadRow };
    setRows((prev) => [json.lead, ...prev]);
    setSelectedId(json.lead.id);
  }

  const visibleColumns = table.getAllLeafColumns().filter((c) => c.getIsVisible());

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Database</h1>
            <p className="mt-1 text-sm text-zinc-500">
              Search your leads like Apollo: database + discover.
            </p>
          </div>
          <button
            onClick={createDemoLead}
            className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-3.5 py-2 text-sm font-medium text-white hover:bg-zinc-800"
          >
            <Plus className="h-4 w-4" />
            Add lead
          </button>
        </div>

        {/* Tabs */}
        <div className="mt-6 inline-flex rounded-xl border border-zinc-200 bg-white p-1 shadow-sm">
          <button
            onClick={() => setTab("database")}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
              tab === "database" ? "bg-zinc-900 text-white" : "text-zinc-700 hover:bg-zinc-50"
            }`}
          >
            Database
          </button>
          <button
            onClick={() => setTab("discover")}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
              tab === "discover" ? "bg-zinc-900 text-white" : "text-zinc-700 hover:bg-zinc-50"
            }`}
          >
            Discover
          </button>
        </div>

        {/* Toolbar */}
        <div className="mt-6 flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-3 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-md">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
              <input
                value={globalFilter}
                onChange={(e) => setGlobalFilter(e.target.value)}
                placeholder={tab === "discover" ? "Keyword (e.g. zahnarzt, agentur…)" : "Search leads (company, email, phone…)"}
                className="w-full rounded-lg border border-zinc-200 bg-white py-2 pl-9 pr-9 text-sm outline-none focus:border-zinc-300 focus:ring-2 focus:ring-zinc-100"
              />
              {globalFilter ? (
                <button
                  onClick={() => setGlobalFilter("")}
                  className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-md hover:bg-zinc-100"
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4 text-zinc-500" />
                </button>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {tab === "database" ? (
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="h-10 rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-700"
                >
                  <option value="">All statuses</option>
                  <option value="NEW">NEW</option>
                  <option value="CONTACTED">CONTACTED</option>
                  <option value="QUALIFIED">QUALIFIED</option>
                  <option value="WON">WON</option>
                  <option value="LOST">LOST</option>
                </select>
              ) : (
                <input
                  value={discoverCity}
                  onChange={(e) => setDiscoverCity(e.target.value)}
                  placeholder="City (e.g. Berlin)"
                  className="h-10 w-[160px] rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-700"
                />
              )}

              <div className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700">
                <Filter className="h-4 w-4 text-zinc-500" />
                {tab === "database" ? "Results" : "Discover"}
                <span className="ml-1 rounded-md bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-700">
                  {tab === "database" ? rows.length : discoverPlaces.length}
                </span>
              </div>

              <details className="relative">
                <summary className="list-none">
                  <div className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50">
                    <Columns3 className="h-4 w-4 text-zinc-500" />
                    Columns
                    <ChevronDown className="h-4 w-4 text-zinc-500" />
                  </div>
                </summary>
                <div className="absolute right-0 z-20 mt-2 w-56 rounded-xl border border-zinc-200 bg-white p-2 shadow-lg">
                  <div className="px-2 py-1 text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Visible columns
                  </div>
                  <div className="mt-1 space-y-1">
                    {table.getAllLeafColumns().map((col) => (
                      <label
                        key={col.id}
                        className="flex cursor-pointer items-center justify-between rounded-lg px-2 py-1.5 text-sm hover:bg-zinc-50"
                      >
                        <span className="text-zinc-700">{col.columnDef.header as string}</span>
                        <input
                          type="checkbox"
                          checked={col.getIsVisible()}
                          onChange={col.getToggleVisibilityHandler()}
                          className="h-4 w-4 accent-zinc-900"
                        />
                      </label>
                    ))}
                  </div>
                </div>
              </details>

              <div className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700">
                <SlidersHorizontal className="h-4 w-4 text-zinc-500" />
                View
              </div>
            </div>
          </div>
        </div>

        {tab === "discover" ? (
          <div className="mt-4 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-zinc-900">Discover real leads</div>
                <div className="mt-1 text-sm text-zinc-600">
                  Uses Google Places (requires <code className="rounded bg-zinc-100 px-1 py-0.5">GOOGLE_MAPS_API_KEY</code>). Search, then import into your database.
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setDiscoverQuery(globalFilter);
                    void discoverSearch();
                  }}
                  className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
                  disabled={discoverLoading}
                >
                  {discoverLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  Search
                </button>
                <button
                  onClick={importDiscover}
                  className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
                  disabled={discoverLoading || discoverPlaces.length === 0}
                >
                  Import results
                </button>
              </div>
            </div>

            {discoverError ? (
              <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
                {discoverError}
              </div>
            ) : null}

            <div className="mt-4 divide-y divide-zinc-100 overflow-hidden rounded-lg border border-zinc-200">
              {discoverPlaces.length === 0 ? (
                <div className="p-4 text-sm text-zinc-600">
                  No results yet. Enter a city + keyword (e.g. “Berlin” + “agentur”) and click Search.
                </div>
              ) : (
                discoverPlaces.map((p, idx) => (
                  <div key={`${p.name}-${idx}`} className="flex items-start justify-between gap-3 p-4">
                    <div className="min-w-0">
                      <div className="truncate font-medium text-zinc-950">{p.name}</div>
                      <div className="mt-1 space-y-1 text-sm text-zinc-600">
                        <div className="truncate">{p.website ?? "—"}</div>
                        <div className="truncate">{p.address ?? p.location ?? "—"}</div>
                        <div className="truncate">{p.email ?? p.phone ?? ""}</div>
                      </div>
                    </div>
                    <button
                      onClick={async () => {
                        const res = await fetch("/api/leads", {
                          method: "POST",
                          headers: { "content-type": "application/json" },
                          body: JSON.stringify({
                            companyName: p.name,
                            website: p.website,
                            location: p.location ?? discoverCity,
                            notes: "Added from Discover.",
                            owner: "",
                            status: "NEW",
                          }),
                        });
                        if (res.ok) {
                          const j = (await res.json()) as { lead: LeadRow };
                          setRows((prev) => [j.lead, ...prev]);
                          setTab("database");
                          setSelectedId(j.lead.id);
                        }
                      }}
                      className="shrink-0 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
                    >
                      Add
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : null}

        {loadError ? (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            <div className="font-medium">Couldn’t load leads</div>
            <div className="mt-1 break-words opacity-90">{loadError}</div>
            <div className="mt-2 text-rose-700">
              If this is a fresh setup, run: <code className="rounded bg-rose-100 px-1 py-0.5">npx prisma migrate dev</code>
            </div>
          </div>
        ) : null}

        {/* Table + Details */}
        <div className={`mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px] ${tab === "discover" ? "opacity-60 pointer-events-none" : ""}`}>
          <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
            <div className="border-b border-zinc-200 px-4 py-3 text-sm text-zinc-600">
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading leads…
                </span>
              ) : (
                <span>
                  {table.getFilteredRowModel().rows.length} lead(s) •{" "}
                  {visibleColumns.length} column(s)
                </span>
              )}
            </div>

            <div className="overflow-auto">
              <table className="min-w-full border-separate border-spacing-0">
                <thead className="sticky top-0 z-10 bg-white">
                  {table.getHeaderGroups().map((hg) => (
                    <tr key={hg.id}>
                      {hg.headers.map((header) => {
                        const canSort = header.column.getCanSort();
                        const sorted = header.column.getIsSorted();
                        return (
                          <th
                            key={header.id}
                            className="whitespace-nowrap border-b border-zinc-200 px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-500"
                          >
                            <button
                              disabled={!canSort}
                              onClick={header.column.getToggleSortingHandler()}
                              className={`inline-flex items-center gap-2 ${canSort ? "cursor-pointer hover:text-zinc-700" : ""}`}
                            >
                              {header.isPlaceholder
                                ? null
                                : flexRender(
                                    header.column.columnDef.header,
                                    header.getContext(),
                                  )}
                              {sorted ? (
                                <span className="text-[10px] text-zinc-400">
                                  {sorted === "asc" ? "↑" : "↓"}
                                </span>
                              ) : null}
                            </button>
                          </th>
                        );
                      })}
                    </tr>
                  ))}
                </thead>
                <tbody>
                  {table.getRowModel().rows.map((row) => {
                    const isSelected = row.original.id === selectedId;
                    return (
                      <tr
                        key={row.id}
                        onClick={() => setSelectedId(row.original.id)}
                        className={`cursor-pointer ${isSelected ? "bg-zinc-50" : "hover:bg-zinc-50"}`}
                      >
                        {row.getVisibleCells().map((cell) => (
                          <td
                            key={cell.id}
                            className="border-b border-zinc-100 px-4 py-3 text-sm text-zinc-700"
                          >
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                  {!loading && table.getRowModel().rows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={table.getAllLeafColumns().length}
                        className="px-4 py-12 text-center text-sm text-zinc-500"
                      >
                        No results. Try clearing filters or add a lead.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-zinc-200 px-4 py-3">
              <div className="text-sm text-zinc-600">
                Page {table.getState().pagination.pageIndex + 1} of{" "}
                {Math.max(1, table.getPageCount())}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => table.previousPage()}
                  disabled={!table.getCanPreviousPage()}
                  className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Prev
                </button>
                <button
                  onClick={() => table.nextPage()}
                  disabled={!table.getCanNextPage()}
                  className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          <aside className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-zinc-900">Details</div>
              {selected ? (
                <button
                  onClick={() => setSelectedId(null)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg hover:bg-zinc-100"
                  aria-label="Close details"
                >
                  <X className="h-4 w-4 text-zinc-500" />
                </button>
              ) : null}
            </div>

            {!selected ? (
              <div className="mt-3 rounded-lg border border-dashed border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600">
                Select a row to see details.
              </div>
            ) : (
              <div className="mt-3 space-y-4">
                <div>
                  <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Company
                  </div>
                  <div className="mt-1 text-base font-semibold text-zinc-950">
                    {selected.companyName}
                  </div>
                  <div className="mt-1 text-sm text-zinc-600">
                    {selected.website ?? "—"}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                      Status
                    </div>
                    <div className="mt-1">
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${badgeClasses(selected.status)}`}
                      >
                        {selected.status}
                      </span>
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                      Owner
                    </div>
                    <div className="mt-1 text-sm text-zinc-700">
                      {selected.owner ?? "—"}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                      Industry
                    </div>
                    <div className="mt-1 text-sm text-zinc-700">
                      {selected.industry ?? "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                      Location
                    </div>
                    <div className="mt-1 text-sm text-zinc-700">
                      {selected.location ?? "—"}
                    </div>
                  </div>
                </div>

                <div>
                  <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Notes
                  </div>
                  <div className="mt-1 whitespace-pre-wrap rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700">
                    {selected.notes ?? "—"}
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


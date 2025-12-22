"use client";

import { useEffect, useMemo, useState } from "react";
import type { Lead } from "@prisma/client";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
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
  const [rows, setRows] = useState<LeadRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [globalFilter, setGlobalFilter] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
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
    state: { globalFilter },
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    globalFilterFn: (row, _columnId, filterValue) => {
      const v = String(filterValue ?? "").toLowerCase();
      if (!v) return true;
      const hay = [
        row.original.companyName,
        row.original.website ?? "",
        row.original.industry ?? "",
        row.original.location ?? "",
        row.original.owner ?? "",
        row.original.status,
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(v);
    },
  });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const res = await fetch("/api/leads", { cache: "no-store" });
        const json = (await res.json()) as { leads: LeadRow[] };
        if (!cancelled) setRows(json.leads ?? []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

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
              Leads table with flexible views, filters, and row details.
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

        {/* Toolbar */}
        <div className="mt-6 flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-3 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-md">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
              <input
                value={globalFilter}
                onChange={(e) => setGlobalFilter(e.target.value)}
                placeholder="Search company, website, status, owner…"
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
              <div className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700">
                <Filter className="h-4 w-4 text-zinc-500" />
                Filters
                <span className="ml-1 rounded-md bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-700">
                  {table.getFilteredRowModel().rows.length}
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

        {/* Table + Details */}
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px]">
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


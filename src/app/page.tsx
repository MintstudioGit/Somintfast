import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-50">
      <main className="mx-auto flex max-w-4xl flex-col gap-8 px-6 py-16">
        <div className="rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-950">
            MintLeadBase
          </h1>
          <p className="mt-2 text-zinc-600">
            A clean lead database with a flexible table UI (inspired by your Figma).
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/database"
              className="inline-flex items-center justify-center rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-800"
            >
              Open Database
            </Link>
            <Link
              href="/api/leads"
              className="inline-flex items-center justify-center rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            >
              View API (JSON)
            </Link>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="text-sm font-medium text-zinc-950">Flexible table</div>
            <div className="mt-1 text-sm text-zinc-600">
              Search, sort, pagination, and column visibility.
            </div>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="text-sm font-medium text-zinc-950">Row details</div>
            <div className="mt-1 text-sm text-zinc-600">
              Click a row to open a details panel.
            </div>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="text-sm font-medium text-zinc-950">Prisma API</div>
            <div className="mt-1 text-sm text-zinc-600">
              `/api/leads` CRUD backed by SQLite.
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

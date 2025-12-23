## MintLeadBase

MintLeadBase is a lightweight lead database with a **Figma-style flexible table UI** and a **public API** you can use to integrate with external tools.

## Getting Started

### Local setup (SQLite)

```bash
npm install
#
# Required for Discover (SerpAPI Google Maps):
# export SERPAPI_API_KEY="..."
#
npx prisma migrate dev
npm run dev
```

Open:
- **UI**: `http://localhost:3000/database`
- **Internal API (no auth)**: `http://localhost:3000/api/leads`

## What’s already true (implemented)

### UI
- **Database UI**: `GET /database` provides a “flexible table” view with search, sorting, column toggles, pagination, and a right-side details panel.

### Internal REST API (no auth)
- **Leads CRUD**
  - `GET/POST /api/leads`
  - `GET/PATCH/DELETE /api/leads/:id`

### Public API (your own API) — API key protected

All endpoints below require either:
- `Authorization: Bearer <token>` **or**
- `x-api-key: <token>`

- **Create API key (dev helper)**: `POST /api/v1/auth/api-keys`
- **Who am I**: `GET /api/v1/me`
- **Customer-scoped leads**: `GET/POST /api/v1/leads` (supports `q`, `status`, `limit`, `cursor`)
- **Basic metrics**: `GET /api/v1/metrics` (lead totals + by-status)

## What’s overstated / still missing to call it “production-ready”

- **Auth hardening**: `POST /api/v1/auth/api-keys` is intentionally “dev-friendly” right now; in production it needs admin auth/provisioning.
- **Rate limiting / abuse protection**: not implemented yet.
- **Observability**: basic usage logging exists in DB, but no structured logging/tracing/alerts (Sentry, OpenTelemetry, etc.).
- **Data governance**: no GDPR/legal workflow or PII safeguards beyond basic storage.
- **Testing**: no automated test suite yet for the API/UI.

## Quick API usage

### Create a key

```bash
curl -X POST http://localhost:3000/api/v1/auth/api-keys \
  -H "content-type: application/json" \
  -d '{"customer":{"name":"Demo","email":"demo@mintleadbase.com"},"keyName":"Demo key"}'
```

### Use the key

```bash
TOKEN="mlb_..._..."
curl http://localhost:3000/api/v1/me -H "authorization: Bearer $TOKEN"
curl -X POST http://localhost:3000/api/v1/leads -H "authorization: Bearer $TOKEN" -H "content-type: application/json" -d '{"companyName":"Acme GmbH"}'
curl http://localhost:3000/api/v1/metrics -H "authorization: Bearer $TOKEN"
```

## Notes

The older text about `POST /api/leadfinder/scrape` and `GET /api/leadfinder/quality/metrics` applies to a **different LeadFinder scraping system**, not this MintLeadBase codebase.

## Environment variables

- **`SERPAPI_API_KEY`**: used by `/api/discover/places*` and Google Maps imports.
  - Local: put it in `.env.local` (project root) as `SERPAPI_API_KEY=...`

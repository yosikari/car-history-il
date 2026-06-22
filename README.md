# CarHistoryIL

A consumer-grade Israeli vehicle history platform. Enter a license plate and get
a branded, trust-inspiring report assembled from **live** Israeli government open
data (`data.gov.il` / Ministry of Transport), with a React + Tailwind frontend
and a PDF download — backed by pluggable adapters for data that has no free
public source (liens, accident records).

> **Zero-mock policy.** Every value in a report comes from a real source, or the
> section is honestly marked `unavailable` / `not_found`. The system never
> fabricates a "clean" result for liens or accidents. Where a section has no
> authoritative provider, it shows a **sourced risk assessment** explaining what
> was and wasn't checked — never a blank "N/A".

## What's mined ("gold data")
- **Ownership timeline** — every dated ownership period (private / lease / dealer
  / rental), reconstructed from the history dataset, not just a total count.
- **Usage profile** — lease / dealer / import / taxi / driving-school flags,
  derived from real registry codes (flag is `null` when no code exists — never a
  guessed `false`).
- **Mileage** — the single confirmed odometer reading (the open registry
  publishes only the last-test value; there is no public per-test history) plus
  an explicitly-labeled average-km/year *estimate*.
- **Risk intelligence** — structure/color/tire change, stolen/confiscated,
  off-road, plus honest lien & accident risk assessments.

## Architecture

```
plate ─▶ [validate] ─▶ [aggregator] ─┬─▶ extraction layer (gov sources)  ─▶ normalizer ─▶ Unified Schema ─▶ report (JSON/HTML/PDF)
                                      ├─▶ pluggable LienProvider                              ▲
                                      └─▶ pluggable AccidentProvider                          │
                                                          [cache] ◀───────────────────────────┘
```

| Layer | Location | Responsibility |
|---|---|---|
| Request handling | [src/core/validate.ts](src/core/validate.ts), [src/api/server.ts](src/api/server.ts) | Plate validation (zod), HTTP routing |
| Resilient transport | [src/core/http.ts](src/core/http.ts) | Retry, exponential backoff + jitter, timeout, UA rotation, 429 handling |
| Extraction | [src/sources/govSources.ts](src/sources/govSources.ts), [src/core/ckan.ts](src/core/ckan.ts) | Per-dataset CKAN adapters, sharded queries, classification |
| Providers | [src/sources/providers/](src/sources/providers/) | Pluggable lien & accident sources (disabled by default) |
| Normalization | [src/core/normalize.ts](src/core/normalize.ts) | Raw Hebrew records → Unified Vehicle Data Schema |
| Aggregation | [src/core/aggregator.ts](src/core/aggregator.ts) | Parallel fan-out, merge, completeness, warnings |
| Storage | [src/core/cache.ts](src/core/cache.ts) | File-backed report cache (swap for Redis in prod) |
| Presentation | [src/report/html.ts](src/report/html.ts) | RTL Hebrew HTML report + optional Playwright PDF |

The unified contract lives in [src/core/schema.ts](src/core/schema.ts).

## Data sources (verified live)

All `resource_id`s in [src/config.ts](src/config.ts) were verified against the
`data.gov.il` CKAN datastore. Key ones:

- **Registry** (specs, color, frame/VIN, test validity): `053cea08…` + `0866573c…`
- **History** (last-test mileage, ownership type, change flags): `56063a99…` + `bb2355dc…`
- **Model spec WLTP** (gearbox, hp, seats, safety, emissions): `142afde2…`
- **Recalls**: `2c33523f…` · **Off-road/scrapped**: `851ecab1…` · **Disabled tag**: `c8b9f9c8…`
- Plus motorcycle, personal-import, heavy-truck, inactive registries.

### What is NOT freely available (and how it's handled)
- **Liens / Meshkonot** — Rasham HaMashkonot is paid + CAPTCHA-gated, no free
  API. Ships as a disabled `LienProvider`. Wire a real provider via env vars.
- **Accident records** — Israel has no public crash-by-plate DB. We derive
  honest **risk indicators** (structure change, off-road, stolen flag) from real
  registry data, and leave an `AccidentProvider` slot for a future paid source.

## Usage

```bash
npm install

# JSON report (CLI)
npm run report -- 66304902 --json

# Printable HTML
npm run report -- 66304902 --html --out report.html

# PDF (requires: npm i -D playwright && npx playwright install chromium)
npm run report -- 66304902 --pdf --out report.pdf

# HTTP API
npm run serve
#   GET /api/vehicle/:plate           JSON
#   GET /api/vehicle/:plate/report    HTML
#   GET /api/vehicle/:plate/pdf       PDF
```

## Frontend (CarHistoryIL web app)

A Vite + React + Tailwind SPA in [web/](web/), served as static files by the
existing Express server (single process).

```bash
# one-time
npm run web:install

# dev (frontend on :5173, proxies /api → backend on :3000)
npm run serve          # terminal 1: backend
npm run web:dev        # terminal 2: frontend

# production: build SPA into public/, then serve everything from Express
npm run build:all      # tsc + vite build → public/
npm run serve          # http://localhost:3000 serves the SPA + API
```

The brand palette lives in [src/branding.ts](src/branding.ts) and is mirrored by
[web/tailwind.config.ts](web/tailwind.config.ts), so the web UI and the printed
PDF report share one identity.

### Enabling lien / accident providers
```bash
export LIEN_PROVIDER_ENABLED=true
export LIEN_PROVIDER_API_KEY=...      # then implement ApiLienProvider.check
```

## Development
```bash
npm run build      # tsc → dist/
npm test           # node:test unit tests (no network)
```

## Notes on resilience
- Sharded datasets are queried in parallel; legacy shards that reject filtered
  queries (409 "Invalid query" on unindexed columns) are skipped silently.
- Reports for found vehicles are cached (default 12h TTL — gov data updates daily).
- A single source failure degrades only its section's status; the report is
  always returned with an honest `completeness` score and `warnings` list.

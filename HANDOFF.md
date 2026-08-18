# ContrastMap — Sourcing Handoff

Written 2026-08-01 by Claude (Cowork), for continuation by Claude Code or another agent in this repo. Self-contained — don't assume access to this session's chat history.

## 1. Project overview

ContrastMap is a national cold plunge / infrared sauna facility directory. Astro frontend, deployed to Cloudflare Workers (`@astrojs/cloudflare`, worker name `contrastmap` per `wrangler.jsonc`). Data model is a set of TypeScript interfaces (`src/data/listing.schema.ts`) stored today as flat JSON (`src/data/listings.json`) — explicitly designed to migrate to a relational DB or D1 later without restructuring. Map is Mapbox GL (`PUBLIC_MAPBOX_TOKEN` in `.env`).

There is a **second, separate vertical**: `src/data/catalog.json` is a product catalog (at-home cold plunge tubs and infrared saunas for sale — Plunge, Ice Barrel, etc. — with affiliate-style "View deal" links). This is gear/e-commerce content, not facility listings. Don't conflate the two — they use different schemas and different sourcing methods (product/affiliate research, not GMB data).

An older static-HTML prototype lives in `contrastmap-site/` (plain HTML/JS, `build.js` injects `providers.json`/`catalog.json` into a template). It's superseded by the Astro app in `src/` but its two SEO pillar articles were already ported to `src/pages/learn/*.astro` (`cold-plunge-vs-infrared-sauna.astro`, `contrast-therapy-101.astro`) — check there before assuming content needs to be rewritten.

## 2. Current state — read this before sourcing anything

`src/data/listings.json`: **20 listings, exactly 3 cities** (Austin: 7, Los Angeles: 7, New York: 6). Migrated from the old prototype's `providers.json` via `scripts/migrate-providers.mjs`, which explicitly left several fields as `null`/placeholder for later verification. Checked directly, as of this writing:

- **address: missing on all 20/20.**
- **phone: missing on all 20/20.**
- **bookingUrl: missing on all 20/20.**
- **photos: empty on all 20/20.**
- **coordinates: present on all 20/20, but approximate** — hardcoded per-business-name lookup in `scripts/add-coordinates.mjs`, not geocoded from a real address. Treat as placeholder, not verified.
- **hours: present but fake** — every listing has all 7 days set to `{ "closed": false }` with no actual open/close times. This is the migration script's `unknownHours()` placeholder, not real data.

**This is the actual first job, not new-city discovery.** Verifying and filling these 20 existing records is a smaller, well-defined task that will validate the pipeline before scaling to new cities.

**A concrete example already found:** CØNTRAST (`contrast-austin-tx` slug) has `dropInPriceNote: "$29 communal hour / $49 private suite"` in the seed data (added 2026-07-09). A live check of contrastatx.com's homepage this session found it now markets itself as "the most affordable access to sauna and cold plunge in Austin, From $49" — the seed price may already be stale, or $29 may have been superseded. Good first test case for the verification pipeline below.

**Hardcoded city blocker:** `src/pages/[city].astro` has a `CITY_MAP` object hardcoded to exactly `austin`, `los-angeles`, `new-york`, plus a matching `CITY_EDITORIAL` blurb dict. Adding a new city to `listings.json` alone will **not** produce a page for it — this routing file (and check `src/pages/[amenity]/[city].astro` for the same pattern) needs the new city added too. Don't let a data-only city expansion silently produce no page.

## 3. Sourcing pipeline — tested and recommended this session

The question this session answered: what's the best way to source/verify accurate business data (GMB-equivalent) at scale. Tested head-to-head on a Denver pilot (not yet in `listings.json` — Denver isn't one of the 3 seeded cities):

- **DataForSEO** (`business_data_business_listings_search`) — direct Google Maps/GBP data. Structured, includes ratings/review counts and `place_topics` (Google's aggregated review-keyword counts, useful as a confidence signal). Title search on `"cold plunge"` and `"contrast therapy"` works well. **Title search on `"infrared sauna"` returns equipment dealers, not facilities — don't use it.** Narrow yield alone (5 candidates in the Denver pilot).
- **Exa** (`web_search_exa`) — much higher discovery yield. One query for local editorial roundups found ~20 additional real Denver businesses via city-magazine and local-blog "best of" articles, plus **two existing national competitor directories already indexed at this scale: saunanearme.com and plungesaunafinder.com** (each claiming 70+ Denver listings with structured amenity data). Worth a direct look at both before further build-out — competitive intel, not just a sourcing tool.
- **Tavily** (`tavily_extract`) — best fidelity for pulling exact pricing/hours/services text off a business's own known URL. Confirmed R3 Spa and The Cove's exact tiered pricing this session, more complete than DataForSEO's GMB `services` field for the same businesses.
- **Parallel** (`createTaskGroup`) — best for batch verification once a candidate list exists. Tested on 5 businesses: completed in under a minute, returned data mapped to the target schema with **per-field confidence ratings**, and caught its own mistake (one wrong-source attribution on Upswell) via the confidence flag — don't skip spot-checking low-confidence fields.

**Recommended sequence:**
1. Discovery: Exa (editorial/roundup search) + DataForSEO (Maps title search on `cold plunge` / `contrast therapy`, not `infrared sauna`). Dedupe by name + address.
2. Verification/enrichment at scale: Parallel `createTaskGroup`, output schema = the fields below.
3. Spot-check: Tavily `tavily_extract` directly on the business's own site for any Parallel result flagged medium/low confidence, or a 10% random sample regardless.
4. Only write to `listings.json` once address, phone, and real hours are confirmed — don't let placeholder/null fields silently pass through as if verified.

## 4. Credentials this needs (not yet in `.env`)

`.env.example` currently only has `PUBLIC_MAPBOX_TOKEN`. The sourcing pipeline needs API access to DataForSEO, Exa, Tavily, and Parallel — these were available in the Cowork session as MCP connectors, but **a Claude Code session in this repo will not automatically have those same connections.** Either:
(a) set up equivalent MCP servers for Claude Code, or
(b) write scripts that call each service's REST API directly with an API key.

If going the API-key route, these should be server-side only — do **not** prefix them `PUBLIC_` (that exposes them to the client bundle; `PUBLIC_MAPBOX_TOKEN` is prefixed because Mapbox's browser token is meant to be public, these are not):
```
DATAFORSEO_LOGIN=
DATAFORSEO_PASSWORD=
EXA_API_KEY=
TAVILY_API_KEY=
PARALLEL_API_KEY=
```
Verify current pricing/auth model for each before committing to volume — not checked this session.

## 5. Schema note — reconcile before importing anything

Several reference docs were produced earlier in the sourcing-strategy session (before this repo was connected) using a **flat CSV schema** (`listing_id, facility_name, has_cold_plunge, has_infrared_sauna, price_cold_plunge_single, ...`) that does **not** match this repo's actual nested `Listing` TypeScript interface (`location.address`, `amenities.coldPlunge`, `pricing.dropInPrice`, etc., per `src/data/listing.schema.ts`). Those docs are useful for the *methodology* (city priority, keyword/SERP findings, tool comparison) but any candidate data from them needs to be mapped into the real schema, not imported as-is. `scripts/migrate-providers.mjs` is the existing pattern for exactly this kind of field-mapping transform — follow its structure for any new import script (new script, don't overwrite it — it's the record of how the current 20 got in).

## 6. Suggested order of work

1. Write a verification script (adapt the Parallel/Tavily pattern above) against the **existing 20 listings** first — fill address, phone, bookingUrl, real hours, and geocode real coordinates. Small, bounded, tests the pipeline for real before scaling.
2. Fix the CØNTRAST pricing discrepancy (and any others the verification pass surfaces) as part of that same run.
3. Add Denver as the first new city (candidate data + methodology already exist from this session's pilot) — remember to extend `CITY_MAP`/`CITY_EDITORIAL` in `[city].astro` and the amenity route.
4. Look directly at saunanearme.com and plungesaunafinder.com before deciding how many more cities to prioritize — they're already operating at the scale ContrastMap is aiming for.
5. National rollout after the above is proven on 2-3 cities, not before.

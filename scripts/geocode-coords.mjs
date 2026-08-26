#!/usr/bin/env node
/**
 * Geocode listing addresses -> precise lat/lng via the Mapbox geocoding API,
 * writing the results back into src/data/listings.json (with a backup).
 *
 * Requires MAPBOX_TOKEN (a SECRET token, not the public one) in .env.
 * Run:  node scripts/geocode-coords.mjs
 *
 * The current listings.json coords are manually-placed approximations. This
 * replaces them with geocoded coordinates where Mapbox returns a high-relevance
 * match; listings it can't confidently place keep their existing coords.
 */
import { readFileSync, writeFileSync, existsSync, copyFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// --- minimal .env loader (no dotenv dependency) ---
const envPath = resolve(ROOT, '.env');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const TOKEN = process.env.MAPBOX_TOKEN;
if (!TOKEN) {
  console.error('\u2716 MAPBOX_TOKEN not set. Add a secret Mapbox token to .env (see .env.example), then re-run.');
  console.error('  Create one at https://account.mapbox.com/access-tokens/ (Secrets scope).');
  process.exit(1);
}

const listingsPath = resolve(ROOT, 'src/data/listings.json');
const data = JSON.parse(readFileSync(listingsPath, 'utf8'));
const listings = data.listings;

mkdirSync(resolve(ROOT, 'scripts/output'), { recursive: true });
const bakPath = resolve(ROOT, 'scripts/output/listings.json.bak');
copyFileSync(listingsPath, bakPath);
console.log(`backed up -> ${bakPath}\n`);

let geocoded = 0, skipped = 0, failed = 0;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

for (const l of listings) {
  const addr = l.location?.address;
  const { city, state } = l.location || {};
  const query = addr ? addr : `${l.name}, ${city}, ${state}`;
  const existing = l.location?.coordinates;
  const proximity =
    existing && Number.isFinite(existing.lat) && Number.isFinite(existing.lng)
      ? `&proximity=${existing.lng}%2C${existing.lat}`
      : '';
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${TOKEN}&country=us&limit=1${proximity}`;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`  \u2716 ${l.name}: HTTP ${res.status}`);
      failed++;
      await sleep(120);
      continue;
    }
    const body = await res.json();
    const feat = body.features?.[0];
    if (feat && feat.relevance >= 0.8) {
      const [lng, lat] = feat.center;
      l.location.coordinates = {
        lat: Math.round(lat * 1e6) / 1e6,
        lng: Math.round(lng * 1e6) / 1e6,
      };
      geocoded++;
      console.log(`  \u2713 ${l.name} -> ${lat.toFixed(5)}, ${lng.toFixed(5)} (${feat.place_type?.join('/')})`);
    } else {
      skipped++;
      console.log(`  \u00b7 ${l.name}: low relevance (${feat?.relevance ?? 'none'}) \u2014 kept existing coords`);
    }
  } catch (err) {
    failed++;
    console.warn(`  \u2716 ${l.name}: ${err.message}`);
  }
  await sleep(120); // stay under Mapbox's free-tier rate limit (~600 req/min)
}

writeFileSync(listingsPath, JSON.stringify(data, null, 2) + '\n');
console.log(`\nDone. geocoded=${geocoded} skipped=${skipped} failed=${failed}`);
console.log(`listings.json updated. Backup at ${bakPath}`);

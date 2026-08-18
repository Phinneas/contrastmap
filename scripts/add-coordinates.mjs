/**
 * Adds approximate lat/lng coordinates to listings based on neighborhood.
 * Run: node scripts/add-coordinates.mjs
 *
 * Coordinates are approximate (neighborhood-level) and should be replaced
 * with precise geocoded values during the verification process.
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = resolve(__dirname, '../src/data');

// Approximate neighborhood-level coordinates
const COORDS = {
  // Austin
  'CØNTRAST': [30.2672, -97.7251],
  'The Ocean Lab': [30.2939, -97.7336],
  'Melt Well': [30.2436, -97.7654],
  'ULU Recovery & Wellness': [30.2521, -97.7521],
  'Pure Sweat Studios': [30.2415, -97.7893],
  'SWTHZ Belterra': [30.2176, -97.8453],
  'Ceremony Spa': [30.2420, -97.7850],
  // Los Angeles
  'RESET on Third': [34.0702, -118.3421],
  'RVIVL': [33.9759, -118.4213],
  'Nordic Nirvana': [34.1385, -118.3890],
  'Club Contrast': [34.1511, -118.4492],
  'Remedy Place West Hollywood': [34.0901, -118.3626],
  'Sweatheory Hollywood': [34.0923, -118.3287],
  'Pause Studio Brentwood': [34.0367, -118.4477],
  // New York
  'Lore Bathing Club': [40.7264, -73.9921],
  'Othership Flatiron': [40.7411, -73.9903],
  'Elahni Speakeasy': [40.7449, -73.9875],
  'Recoverie': [40.6962, -73.9943],
  'Bathhouse Flatiron': [40.7405, -73.9889],
  'Continuum': [40.7359, -74.0051],
};

const data = JSON.parse(readFileSync(resolve(dataDir, 'listings.json'), 'utf8'));

let updated = 0;
for (const listing of data.listings) {
  const coords = COORDS[listing.name];
  if (coords) {
    listing.location.coordinates = { lat: coords[0], lng: coords[1] };
    updated++;
  }
}

writeFileSync(resolve(dataDir, 'listings.json'), JSON.stringify(data, null, 2));
console.log(`Added coordinates to ${updated}/${data.listings.length} listings`);

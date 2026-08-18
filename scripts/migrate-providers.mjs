/**
 * Migration script: converts the old providers.json (prototype format)
 * into the new Listing schema format.
 *
 * Run: node scripts/migrate-providers.mjs
 *
 * Fields we can infer from the old data:
 *   - name, city, neighborhood, services[], priceFrom, priceNote,
 *     rating, reviews, website, blurb, verified, featured
 *
 * Fields we infer/calculate:
 *   - state (from city), slug (from name+city+state), amenities (from services),
 *     priceRange (from priceFrom), status=active, ownership.claimed=false
 *
 * Fields left as unknown (to be filled during verification):
 *   - full address, postalCode, coordinates, phone, bookingUrl, hours, photos
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = resolve(__dirname, '../src/data');

const CITY_TO_STATE = {
  'Austin': 'TX',
  'Los Angeles': 'CA',
  'New York': 'NY',
};

// Featured studios (from original build.js)
const FEATURED = new Set(['CØNTRAST', 'RVIVL', 'Othership Flatiron', 'SWTHZ Belterra']);

function slugify(name, city, state) {
  const clean = (s) => s
    .toLowerCase()
    .replace(/ø/g, 'o')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${clean(name)}-${clean(city)}-${state.toLowerCase()}`;
}

function servicesToAmenities(services) {
  const a = {
    coldPlunge: false,
    infraredSauna: false,
    traditionalSauna: false,
    contrastTherapyMarketed: false,
  };
  for (const svc of services) {
    if (svc === 'Cold Plunge') a.coldPlunge = true;
    if (svc === 'Infrared Sauna') a.infraredSauna = true;
    if (svc === 'Contrast Therapy') a.contrastTherapyMarketed = true;
    if (svc === 'Red Light') a.redLightTherapy = true;
    if (svc === 'Compression') a.compressionTherapy = true;
    if (svc === 'Float Tank') a.floatTank = true;
  }
  return a;
}

function priceRangeFromPrice(priceFrom) {
  if (priceFrom == null) return 3;
  if (priceFrom < 30) return 1;
  if (priceFrom < 45) return 2;
  if (priceFrom < 60) return 3;
  return 4;
}

function unknownHours() {
  const days = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
  const h = {};
  for (const d of days) h[d] = { closed: false }; // unknown times, not closed
  return h;
}

function migrate() {
  const raw = JSON.parse(readFileSync(resolve(dataDir, 'providers.json'), 'utf8'));
  const providers = raw.filter(x => !x._note);

  const listings = providers.map((p) => {
    const state = CITY_TO_STATE[p.city] || 'XX';
    const slug = slugify(p.name, p.city, state);

    return {
      id: randomUUID(),
      slug,
      name: p.name,
      description: p.blurb,
      status: 'active',
      location: {
        address: null,           // TODO: fill during verification
        address2: null,
        city: p.city,
        state,
        postalCode: null,         // TODO: fill during verification
        country: 'US',
        coordinates: null,        // TODO: geocode during verification
        neighborhood: p.neighborhood || null,
      },
      amenities: servicesToAmenities(p.services),
      pricing: {
        priceRange: priceRangeFromPrice(p.priceFrom),
        dropInPrice: p.priceFrom ?? null,
        dropInPriceNote: p.priceNote || null,
        membershipAvailable: false, // unknown from seed data
        membershipPrice: null,
        membershipPriceNote: null,
      },
      contact: {
        phone: null,              // TODO: fill during verification
        website: p.website || null,
        bookingUrl: null,         // TODO: fill during verification
        email: null,
        instagram: null,
        facebook: null,
      },
      hours: unknownHours(),
      media: {
        photos: [],               // TODO: add during verification
        logo: null,
      },
      editorial: {
        rating: p.rating ?? null,
        reviewCount: p.reviews ?? null,
        featured: FEATURED.has(p.name),
        sponsored: false,
        verified: p.verified ?? false,
      },
      ownership: {
        claimed: false,
        claimedBy: null,
        claimedDate: null,
        claimMethod: null,
      },
      audit: {
        addedDate: '2026-07-09',
        addedBy: 'system',
        source: 'seed',
        lastVerifiedDate: '2026-07-09',
        lastVerifiedBy: 'system',
        lastModifiedDate: '2026-07-09',
        lastModifiedBy: 'system',
      },
    };
  });

  const output = {
    schemaVersion: '1.0.0',
    count: listings.length,
    listings,
  };

  writeFileSync(resolve(dataDir, 'listings.json'), JSON.stringify(output, null, 2));
  console.log(`Migrated ${listings.length} listings to src/data/listings.json`);

  // Stats
  const cities = [...new Set(listings.map(l => l.location.city))];
  const featured = listings.filter(l => l.editorial.featured).length;
  const verified = listings.filter(l => l.editorial.verified).length;
  console.log(`  Cities: ${cities.join(', ')}`);
  console.log(`  Featured: ${featured} | Verified: ${verified}`);
  console.log(`  Fields needing verification: address, postalCode, coordinates, phone, bookingUrl, hours, photos`);
}

migrate();

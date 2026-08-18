#!/usr/bin/env node
/**
 * import-to-listings.mjs
 *
 * Maps verified listing data to the ContrastMap Listing schema
 * (src/data/listing.schema.ts) and merges into src/data/listings.json.
 *
 * Preserves existing verified data — only fills null/placeholder fields
 * and adds new listings that don't already exist.
 *
 * Usage: node scripts/import-to-listings.mjs [--dry-run]
 * Input: scripts/output/verified-listings.json
 * Output: src/data/listings.json (updated in place)
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, 'output');
const INPUT_FILE = join(OUTPUT_DIR, 'verified-listings.json');
const LISTINGS_FILE = join(__dirname, '..', 'src', 'data', 'listings.json');

const STATE_CODE_MAP = {
  'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR',
  'California': 'CA', 'Colorado': 'CO', 'Connecticut': 'CT', 'Delaware': 'DE',
  'Florida': 'FL', 'Georgia': 'GA', 'Hawaii': 'HI', 'Idaho': 'ID',
  'Illinois': 'IL', 'Indiana': 'IN', 'Iowa': 'IA', 'Kansas': 'KS',
  'Kentucky': 'KY', 'Louisiana': 'LA', 'Maine': 'ME', 'Maryland': 'MD',
  'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN', 'Mississippi': 'MS',
  'Missouri': 'MO', 'Montana': 'MT', 'Nebraska': 'NE', 'Nevada': 'NV',
  'New Hampshire': 'NH', 'New Jersey': 'NJ', 'New Mexico': 'NM', 'New York': 'NY',
  'North Carolina': 'NC', 'North Dakota': 'ND', 'Ohio': 'OH', 'Oklahoma': 'OK',
  'Oregon': 'OR', 'Pennsylvania': 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC',
  'South Dakota': 'SD', 'Tennessee': 'TN', 'Texas': 'TX', 'Utah': 'UT',
  'Vermont': 'VT', 'Virginia': 'VA', 'Washington': 'WA', 'West Virginia': 'WV',
  'Wisconsin': 'WI', 'Wyoming': 'WY',
};

const STATE_NAME_MAP = Object.fromEntries(
  Object.entries(STATE_CODE_MAP).map(([k, v]) => [v, k])
);

/** Generate a URL-safe slug from a business name + city */
function makeSlug(name, city, state) {
  const stateCode = STATE_CODE_MAP[state] || state;
  const base = name.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
  const citySlug = city.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return `${base}-${citySlug}-${stateCode.toLowerCase()}`.replace(/-{2,}/g, '-');
}

/** Map services array to amenity flags */
function servicesToAmenities(services) {
  if (!services) return {};
  const text = services.join(' ').toLowerCase();
  return {
    coldPlunge: /cold\s*plunge|cold\s*dip|cold\s*bath|ice\s*bath/i.test(text),
    infraredSauna: /infrared\s*sauna/i.test(text),
    traditionalSauna: /traditional\s*sauna|dry\s*sauna|finnish\s*sauna/i.test(text),
    contrastTherapyMarketed: /contrast\s*therapy/i.test(text),
    redLightTherapy: /red\s*light/i.test(text),
    compressionTherapy: /compression/i.test(text),
    floatTank: /float\s*tank|floatation/i.test(text),
    cryotherapy: /cryotherapy|cryo/i.test(text),
  };
}

/** Parse hours from competitor data to schema format */
function parseHours(hoursData) {
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const result = {};
  for (const day of days) {
    if (hoursData && hoursData[day]) {
      result[day] = hoursData[day];
    } else {
      result[day] = { closed: false }; // placeholder
    }
  }
  return result;
}

/** Determine price range tier from drop-in price */
function priceRangeFromPrice(price) {
  if (!price) return 2;
  if (price < 25) return 1;
  if (price < 50) return 2;
  if (price < 100) return 3;
  return 4;
}

/** Convert a verified candidate to the Listing schema format */
function toListingSchema(candidate) {
  const name = candidate.name || 'Unknown';
  const city = candidate.city || candidate.cityName || '';
  const state = candidate.state || candidate.stateName || '';
  const stateCode = STATE_CODE_MAP[state] || state;

  // Parse address
  let address = candidate.address || candidate.streetAddress || null;
  let postalCode = candidate.postalCode || null;
  if (candidate.address && !candidate.streetAddress) {
    const parts = candidate.address.match(/^(.+?),\s*(.+?),\s*([A-Z]{2}),\s*(\d{5})/);
    if (parts) {
      address = parts[1].trim();
      postalCode = parts[4].trim();
    }
  }

  // Amenities
  const serviceAmenities = servicesToAmenities(candidate.services);
  const websiteAmenities = candidate.amenityVerification?.fromWebsite || {};
  const amenities = {
    coldPlunge: serviceAmenities.coldPlunge || websiteAmenities.coldPlunge || false,
    infraredSauna: serviceAmenities.infraredSauna || websiteAmenities.infraredSauna || false,
    traditionalSauna: serviceAmenities.traditionalSauna || websiteAmenities.traditionalSauna || false,
    contrastTherapyMarketed: serviceAmenities.contrastTherapyMarketed || websiteAmenities.contrastTherapyMarketed || false,
    redLightTherapy: serviceAmenities.redLightTherapy || websiteAmenities.redLightTherapy || undefined,
    compressionTherapy: serviceAmenities.compressionTherapy || websiteAmenities.compressionTherapy || undefined,
    floatTank: serviceAmenities.floatTank || websiteAmenities.floatTank || undefined,
    cryotherapy: serviceAmenities.cryotherapy || websiteAmenities.cryotherapy || undefined,
  };

  // Pricing
  const dropInPrice = candidate.pricing?.dropInPrice || candidate.dropInPrice || null;
  const membershipPrice = candidate.pricing?.membershipPrice || candidate.membershipPrice || null;

  // Coordinates (from Google Maps place_id or hardcoded)
  let coordinates = null;
  if (candidate.coordinates) {
    coordinates = candidate.coordinates;
  }

  return {
    id: randomUUID(),
    slug: makeSlug(name, city, state),
    name,
    description: candidate.description || '',
    status: 'active',
    location: {
      address: address || null,
      city,
      state: stateCode,
      postalCode: postalCode || null,
      country: 'US',
      coordinates: coordinates || { lat: 0, lng: 0 },
      neighborhood: candidate.neighborhood || null,
    },
    amenities,
    pricing: {
      priceRange: priceRangeFromPrice(dropInPrice),
      dropInPrice: dropInPrice,
      dropInPriceNote: dropInPrice ? `$${dropInPrice}` : null,
      membershipAvailable: !!membershipPrice,
      membershipPrice: membershipPrice,
      membershipPriceNote: membershipPrice ? `$${membershipPrice}/mo` : null,
    },
    contact: {
      phone: candidate.phone || null,
      website: candidate.website || null,
      bookingUrl: candidate.contact?.bookingUrl || null,
      email: null,
      instagram: candidate.contact?.instagram || null,
      facebook: candidate.contact?.facebook || null,
    },
    hours: parseHours(candidate.hours),
    media: {
      photos: [],
      logo: null,
    },
    editorial: {
      rating: candidate.rating || undefined,
      reviewCount: candidate.reviewCount || undefined,
      featured: false,
      sponsored: false,
      verified: candidate.verificationStatus === 'verified',
    },
    ownership: {
      claimed: false,
    },
    audit: {
      addedDate: new Date().toISOString().split('T')[0],
      addedBy: 'system-automated',
      source: 'api',
      lastVerifiedDate: new Date().toISOString().split('T')[0],
      lastModifiedDate: new Date().toISOString().split('T')[0],
    },
  };
}

/** Check if two listings are the same business (by slug or name+city) */
function isDuplicate(newListing, existingListings) {
  return existingListings.some(existing =>
    existing.slug === newListing.slug ||
    (existing.name.toLowerCase() === newListing.name.toLowerCase() &&
     existing.location.city.toLowerCase() === newListing.location.city.toLowerCase())
  );
}

/** Merge a new listing into an existing one, filling null fields */
function mergeIntoExisting(existing, incoming) {
  const updated = { ...existing };

  // Fill null/placeholder fields
  if (!existing.location.address && incoming.location.address) {
    updated.location.address = incoming.location.address;
  }
  if (!existing.location.postalCode && incoming.location.postalCode) {
    updated.location.postalCode = incoming.location.postalCode;
  }
  if (!existing.location.neighborhood && incoming.location.neighborhood) {
    updated.location.neighborhood = incoming.location.neighborhood;
  }
  if (!existing.contact.phone && incoming.contact.phone) {
    updated.contact.phone = incoming.contact.phone;
  }
  if (!existing.contact.bookingUrl && incoming.contact.bookingUrl) {
    updated.contact.bookingUrl = incoming.contact.bookingUrl;
  }
  if (!existing.contact.website && incoming.contact.website) {
    updated.contact.website = incoming.contact.website;
  }
  if (!existing.pricing.dropInPrice && incoming.pricing.dropInPrice) {
    updated.pricing.dropInPrice = incoming.pricing.dropInPrice;
    updated.pricing.dropInPriceNote = incoming.pricing.dropInPriceNote;
  }
  if (!existing.editorial.rating && incoming.editorial.rating) {
    updated.editorial.rating = incoming.editorial.rating;
    updated.editorial.reviewCount = incoming.editorial.reviewCount;
  }

  // Update amenities if new data has more info
  for (const key of ['coldPlunge', 'infraredSauna', 'traditionalSauna', 'contrastTherapyMarketed']) {
    if (!existing.amenities[key] && incoming.amenities[key]) {
      updated.amenities[key] = true;
    }
  }

  // Update hours if existing is placeholder
  const hasPlaceholderHours = existing.hours.monday && !existing.hours.monday.open && !existing.hours.monday.closed === false;
  if (hasPlaceholderHours && incoming.hours.monday?.open) {
    updated.hours = incoming.hours;
  }

  return updated;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  console.log(`🔥 ContrastMap — Import to Listings Schema`);

  if (!existsSync(INPUT_FILE)) {
    console.error(`❌ Input file not found: ${INPUT_FILE}`);
    console.error(`   Run verify-enrich.mjs first.`);
    process.exit(1);
  }

  const verifiedData = JSON.parse(readFileSync(INPUT_FILE, 'utf-8'));
  const candidates = verifiedData.listings || [];

  console.log(`   Input: ${candidates.length} verified candidates`);

  // Load existing listings
  const existingData = JSON.parse(readFileSync(LISTINGS_FILE, 'utf-8'));
  const existingListings = existingData.listings || [];

  console.log(`   Existing listings: ${existingListings.length}`);

  let addedCount = 0;
  let mergedCount = 0;
  let skippedCount = 0;

  const updatedListings = [...existingListings];

  for (const candidate of candidates) {
    if (!candidate.name || candidate.error) {
      skippedCount++;
      continue;
    }

    const newListing = toListingSchema(candidate);

    // Check for duplicates
    const existingIdx = updatedListings.findIndex(existing =>
      existing.slug === newListing.slug ||
      (existing.name.toLowerCase() === newListing.name.toLowerCase() &&
       existing.location.city.toLowerCase() === newListing.location.city.toLowerCase())
    );

    if (existingIdx !== -1) {
      // Merge into existing
      updatedListings[existingIdx] = mergeIntoExisting(updatedListings[existingIdx], newListing);
      mergedCount++;
    } else {
      // Add new listing
      updatedListings.push(newListing);
      addedCount++;
    }
  }

  // Update the data file
  const outputData = {
    schemaVersion: '1.0.0',
    count: updatedListings.length,
    listings: updatedListings,
  };

  if (dryRun) {
    console.log(`\n📋 Dry run results:`);
    console.log(`   Would add: ${addedCount} new listings`);
    console.log(`   Would merge: ${mergedCount} existing listings`);
    console.log(`   Skipped: ${skippedCount}`);
    console.log(`   Total after: ${updatedListings.length}`);
  } else {
    writeFileSync(LISTINGS_FILE, JSON.stringify(outputData, null, 2));
    console.log(`\n✅ Import complete!`);
    console.log(`   Added: ${addedCount} new listings`);
    console.log(`   Merged: ${mergedCount} existing listings`);
    console.log(`   Skipped: ${skippedCount}`);
    console.log(`   Total: ${updatedListings.length} listings in ${LISTINGS_FILE}`);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

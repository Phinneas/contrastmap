#!/usr/bin/env node
/**
 * enrich-descriptions.mjs
 * -----------------------------------------------------------------------------
 * Generates improved 100-200 word descriptions for listings that have thin,
 * placeholder, or scraped descriptions. Uses a template-based approach
 * (not AI API) to keep it safe and repeatable.
 *
 * Usage:
 *   node scripts/enrich-descriptions.mjs [--dry-run]
 *
 * Creates a backup of listings.json before modifying.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LISTINGS_PATH = path.join(__dirname, '..', 'src', 'data', 'listings.json');
const BACKUP_PATH = path.join(__dirname, 'output', 'listings-backup.json');

const dryRun = process.argv.includes('--dry-run');

// --- Template generators ---

function buildDescription(listing) {
  const parts = [];

  // Opening: what the facility is
  const amenityList = [];
  if (listing.amenities.coldPlunge) amenityList.push('cold plunge');
  if (listing.amenities.infraredSauna) amenityList.push('infrared sauna');
  if (listing.amenities.traditionalSauna) amenityList.push('traditional sauna');
  if (listing.amenities.contrastTherapyMarketed) amenityList.push('contrast therapy');
  if (listing.amenities.redLightTherapy) amenityList.push('red light therapy');
  if (listing.amenities.compressionTherapy) amenityList.push('compression therapy');
  if (listing.amenities.floatTank) amenityList.push('float therapy');

  const city = listing.location.city;
  const state = listing.location.state;
  const neighborhood = listing.location.neighborhood;

  // Build the opening sentence
  let opening = `${listing.name} is a`;
  if (amenityList.length > 0) {
    const amenities = amenityList.slice(0, 3).join(', ');
    opening += ` wellness studio in ${neighborhood ? neighborhood + ', ' : ''}${city}, ${state}, offering ${amenities}`;
    if (amenityList.length > 3) opening += ' and more';
    opening += '.';
  } else {
    opening += ` wellness facility in ${neighborhood ? neighborhood + ', ' : ''}${city}, ${state}.`;
  }
  parts.push(opening);

  // Middle: what they offer
  if (amenityList.includes('contrast therapy') || (amenityList.includes('cold plunge') && (amenityList.includes('infrared sauna') || amenityList.includes('traditional sauna')))) {
    parts.push(`The studio specializes in contrast therapy, alternating between heat and cold for a powerful vascular workout that supports recovery, circulation, and stress relief.`);
  } else if (amenityList.includes('cold plunge')) {
    parts.push(`The studio offers cold water immersion for recovery, mood, and alertness, with water temperatures typically between 39 and 55 degrees.`);
  } else if (amenityList.includes('infrared sauna') || amenityList.includes('traditional sauna')) {
    parts.push(`The studio provides heat therapy sessions for relaxation, detoxification, and cardiovascular health.`);
  }

  // Pricing info
  if (listing.pricing.dropInPriceNote) {
    parts.push(`Drop-in sessions start at ${listing.pricing.dropInPriceNote}.`);
  } else if (listing.pricing.dropInPrice) {
    parts.push(`Drop-in sessions start at $${listing.pricing.dropInPrice}.`);
  }
  if (listing.pricing.membershipAvailable) {
    if (listing.pricing.membershipPriceNote) {
      parts.push(`Memberships are available at ${listing.pricing.membershipPriceNote}.`);
    } else if (listing.pricing.membershipPrice) {
      parts.push(`Monthly memberships are available from $${listing.pricing.membershipPrice}.`);
    } else {
      parts.push(`Membership options are available for regular plungers.`);
    }
  }

  // Rating
  if (listing.editorial.rating && listing.editorial.reviewCount) {
    parts.push(`Rated ${listing.editorial.rating.toFixed(1)} with ${listing.editorial.reviewCount} reviews.`);
  } else if (listing.editorial.rating) {
    parts.push(`Rated ${listing.editorial.rating.toFixed(1)} by ContrastMap users.`);
  }

  // Closing CTA
  parts.push(`Book a session or learn more through their ContrastMap listing.`);

  return parts.join(' ');
}

function isThinDescription(desc) {
  if (!desc) return true;
  if (desc.length < 50) return true;
  if (desc.includes('TODO') || desc.includes('Placeholder') || desc.includes('placeholder')) return true;
  // If it's just a name + city, it's thin
  if (desc.length < 100 && !desc.includes('.') ) return true;
  return false;
}

// --- Main ---

console.log(`\n${'='.repeat(60)}`);
console.log('ContrastMap Description Enrichment');
console.log(`${'='.repeat(60)}\n`);

const raw = fs.readFileSync(LISTINGS_PATH, 'utf-8');
const data = JSON.parse(raw);

const listings = data.listings;
let enriched = 0;
let skipped = 0;

for (const listing of listings) {
  if (isThinDescription(listing.description)) {
    const newDesc = buildDescription(listing);
    if (dryRun) {
      console.log(`[DRY] ${listing.name}: "${listing.description || '(empty)'}" -> "${newDesc.substring(0, 80)}..."`);
    } else {
      listing.description = newDesc;
    }
    enriched++;
  } else {
    skipped++;
  }
}

console.log(`\nResults:`);
console.log(`  Enriched: ${enriched}`);
console.log(`  Skipped (already good): ${skipped}`);
console.log(`  Total: ${listings.length}`);

if (!dryRun && enriched > 0) {
  // Backup
  const outputDir = path.join(__dirname, 'output');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(BACKUP_PATH, raw);
  console.log(`  Backup: ${BACKUP_PATH}`);

  // Write
  fs.writeFileSync(LISTINGS_PATH, JSON.stringify(data, null, 2));
  console.log(`  Written: ${LISTINGS_PATH}`);
}

if (dryRun) {
  console.log('\n(Dry run — no files modified.)');
}

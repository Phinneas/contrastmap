#!/usr/bin/env node
/**
 * generate-outreach.mjs
 * -----------------------------------------------------------------------------
 * Reads Austin listings from listings.json and generates personalized outreach
 * emails for each, inviting them to claim their listing on ContrastMap.
 *
 * Usage:
 *   node scripts/generate-outreach.mjs [--city=Austin]
 *
 * Output: scripts/output/outreach-emails.json
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LISTINGS_PATH = path.join(__dirname, '..', 'src', 'data', 'listings.json');
const OUTPUT_PATH = path.join(__dirname, 'output', 'outreach-emails.json');

const cityArg = process.argv.find(a => a.startsWith('--city='));
const city = cityArg ? cityArg.split('=')[1] : 'Austin';

const SITE_URL = 'https://contrastmap.com';

function buildEmail(listing) {
  const citySlug = listing.location.city.toLowerCase().replace(/\s+/g, '-');
  const listingUrl = `${SITE_URL}/${citySlug}/${listing.slug}`;
  const firstName = listing.name.split(' ')[0];

  const subject = `Your studio is listed on ContrastMap — claim it free`;
  const body = `Hi ${firstName} team,

I'm the founder of ContrastMap, a new directory for cold plunge and infrared sauna studios. We've listed ${listing.name} on our site, and I wanted to let you know so you can claim your listing and make sure your info is accurate.

Your listing is here: ${listingUrl}

Claiming is free and takes 2 minutes. You'll be able to:
- Update your hours, pricing, and amenities
- Add photos of your studio
- Respond to inquiries from potential customers
- Get a "Verified" badge

No catch, no cost. We're building the best directory for contrast therapy and want to make sure your studio is represented accurately.

If anything in your listing needs correcting, just reply to this email and I'll fix it immediately.

Best,
Buzz
ContrastMap
${SITE_URL}`;

  return { subject, body };
}

// --- Main ---

console.log(`\n${'='.repeat(60)}`);
console.log('ContrastMap Outreach Email Generator');
console.log(`${'='.repeat(60)}\n`);

const raw = fs.readFileSync(LISTINGS_PATH, 'utf-8');
const data = JSON.parse(raw);

const cityListings = data.listings.filter(l =>
  l.location.city === city &&
  l.status === 'active' &&
  !l.ownership.claimed
);

console.log(`City: ${city}`);
console.log(`Listings to outreach: ${cityListings.length}`);
console.log();

const emails = [];
for (const listing of cityListings) {
  const citySlug = listing.location.city.toLowerCase().replace(/\s+/g, '-');
  const listingUrl = `${SITE_URL}/${citySlug}/${listing.slug}`;
  const { subject, body } = buildEmail(listing);

  emails.push({
    to: listing.contact.email || '(no email on file — check website)',
    listingName: listing.name,
    listingUrl,
    subject,
    body,
  });

  console.log(`  ${listing.name}`);
  console.log(`    URL: ${listingUrl}`);
  console.log(`    Email: ${listing.contact.email || '(none on file)'}`);
  console.log();
}

const outputDir = path.join(__dirname, 'output');
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(OUTPUT_PATH, JSON.stringify(emails, null, 2));

console.log(`\nOutput: ${OUTPUT_PATH}`);
console.log(`Total emails generated: ${emails.length}`);

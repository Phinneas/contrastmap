#!/usr/bin/env node
/**
 * verify-enrich.mjs
 *
 * For each merged candidate, visits the business's own website (if available)
 * to verify and enrich data: booking URL, pricing, amenity confirmation,
 * photos. Marks confidence level per field.
 *
 * Usage: node scripts/verify-enrich.mjs [--limit 50]
 * Input: scripts/output/merged-candidates.json
 * Output: scripts/output/verified-listings.json
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, 'output');
const INPUT_FILE = join(OUTPUT_DIR, 'merged-candidates.json');
const OUTPUT_FILE = join(OUTPUT_DIR, 'verified-listings.json');

const DELAY_MS = 800;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function fetchPage(url) {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    return res.text();
  } catch {
    return null;
  }
}

/** Extract booking URL from a business website */
function findBookingUrl(html, baseUrl) {
  // Common booking platform patterns
  const bookingPatterns = [
    /href="(https?:\/\/(?:book|booking|schedule|reserve|appoint)\.[^"]+)"/i,
    /href="(https?:\/\/[^"]*mindbodyonline[^"]*)"/i,
    /href="(https?:\/\/[^"]*vagaro[^"]*)"/i,
    /href="(https?:\/\/[^"]*squareup[^"]*book[^"]*)"/i,
    /href="(https?:\/\/[^"]*calendly[^"]*)"/i,
    /href="(https?:\/\/[^"]*acuity[^"]*)"/i,
    /href="([^"]*\/(?:book|booking|schedule|reserve|appoint)[^"]*)"/i,
  ];

  for (const pattern of bookingPatterns) {
    const match = html.match(pattern);
    if (match) {
      try {
        return new URL(match[1], baseUrl).href;
      } catch {
        return match[1];
      }
    }
  }
  return null;
}

/** Extract pricing info from a business website */
function findPricing(html) {
  const pricing = {};

  // Look for price patterns like "$29", "$49/session", "from $25"
  const dropInMatch = html.match(/(?:drop[- ]?in|day pass|single session|walk[- ]?in)[^$]*\$?(\d{2,4})/i);
  if (dropInMatch) {
    pricing.dropInPrice = parseInt(dropInMatch[1], 10);
    pricing.dropInConfidence = 'medium';
  }

  const membershipMatch = html.match(/(?:membership|member|monthly)[^$]*\$?(\d{2,4})/i);
  if (membershipMatch) {
    pricing.membershipPrice = parseInt(membershipMatch[1], 10);
    pricing.membershipConfidence = 'medium';
  }

  return pricing;
}

/** Check for amenity keywords on the business website */
function checkAmenities(html) {
  const text = html.toLowerCase();
  return {
    coldPlunge: /cold\s*(plunge|dip|bath|immersion|exposure)/i.test(text),
    infraredSauna: /infrared\s*sauna/i.test(text),
    traditionalSauna: /traditional\s*sauna|finnish\s*sauna|dry\s*sauna/i.test(text),
    contrastTherapyMarketed: /contrast\s*therapy/i.test(text),
    redLightTherapy: /red\s*light\s*therapy|rlt|photobiomodulation/i.test(text),
    compressionTherapy: /compression\s*therapy|compression\s*boots/i.test(text),
    floatTank: /float\s*tank|floatation|sensory\s*deprivation/i.test(text),
    cryotherapy: /cryotherapy|cryo\s*therapy/i.test(text),
  };
}

/** Extract phone number from a business website */
function findPhone(html) {
  const phoneMatch = html.match(/href="tel:([^"]+)"/);
  if (phoneMatch) return phoneMatch[1];
  const phoneMatch2 = html.match(/(\+?1?[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})/);
  if (phoneMatch2) return phoneMatch2[1];
  return null;
}

/** Extract social media links */
function findSocials(html) {
  const socials = {};
  const igMatch = html.match(/href="(https?:\/\/(?:www\.)?instagram\.com\/[^"]+)"/i);
  if (igMatch) socials.instagram = igMatch[1];
  const fbMatch = html.match(/href="(https?:\/\/(?:www\.)?facebook\.com\/[^"]+)"/i);
  if (fbMatch) socials.facebook = fbMatch[1];
  return socials;
}

async function verifyListing(listing) {
  const verified = { ...listing };
  const enrichment = {};

  if (!listing.website) {
    verified.verificationStatus = 'no-website';
    return verified;
  }

  console.log(`   🌐 ${listing.website}`);
  const html = await fetchPage(listing.website);

  if (!html) {
    verified.verificationStatus = 'website-unreachable';
    return verified;
  }

  // Verify amenities
  const websiteAmenities = checkAmenities(html);
  verified.amenityVerification = {
    fromWebsite: websiteAmenities,
    confidence: 'high',
  };

  // Find booking URL
  const bookingUrl = findBookingUrl(html, listing.website);
  if (bookingUrl) {
    verified.contact = verified.contact || {};
    verified.contact.bookingUrl = bookingUrl;
    enrichment.bookingUrl = { value: bookingUrl, confidence: 'high' };
  }

  // Find pricing
  const pricing = findPricing(html);
  if (pricing.dropInPrice) {
    verified.pricing = verified.pricing || {};
    verified.pricing.dropInPrice = pricing.dropInPrice;
    enrichment.dropInPrice = { value: pricing.dropInPrice, confidence: pricing.dropInConfidence };
  }
  if (pricing.membershipPrice) {
    verified.pricing = verified.pricing || {};
    verified.pricing.membershipPrice = pricing.membershipPrice;
    enrichment.membershipPrice = { value: pricing.membershipPrice, confidence: pricing.membershipConfidence };
  }

  // Find phone if missing
  if (!verified.phone) {
    const phone = findPhone(html);
    if (phone) {
      verified.phone = phone;
      enrichment.phone = { value: phone, confidence: 'high' };
    }
  }

  // Find social media
  const socials = findSocials(html);
  if (socials.instagram || socials.facebook) {
    verified.contact = verified.contact || {};
    if (socials.instagram) verified.contact.instagram = socials.instagram;
    if (socials.facebook) verified.contact.facebook = socials.facebook;
  }

  verified.verificationStatus = 'verified';
  verified.enrichment = enrichment;
  verified.verifiedAt = new Date().toISOString();

  return verified;
}

async function main() {
  const args = process.argv.slice(2);
  const limitIdx = args.indexOf('--limit');
  const limit = limitIdx !== -1 ? parseInt(args[limitIdx + 1]) : 0;

  console.log(`🔥 ContrastMap — Verify & Enrich`);

  if (!existsSync(INPUT_FILE)) {
    console.error(`❌ Input file not found: ${INPUT_FILE}`);
    console.error(`   Run dedupe-merge.mjs first.`);
    process.exit(1);
  }

  const data = JSON.parse(readFileSync(INPUT_FILE, 'utf-8'));
  let listings = data.listings || [];
  if (limit > 0) listings = listings.slice(0, limit);

  console.log(`   Input: ${listings.length} listings`);

  const verified = [];
  let verifiedCount = 0;
  let noWebsiteCount = 0;
  let unreachableCount = 0;

  for (let i = 0; i < listings.length; i++) {
    const listing = listings[i];
    console.log(`[${i + 1}/${listings.length}] ${listing.name || 'unknown'}`);

    try {
      const result = await verifyListing(listing);
      verified.push(result);

      if (result.verificationStatus === 'verified') verifiedCount++;
      else if (result.verificationStatus === 'no-website') noWebsiteCount++;
      else unreachableCount++;
    } catch (err) {
      console.error(`   ❌ ${err.message}`);
      verified.push({ ...listing, verificationStatus: 'error', error: err.message });
    }

    await sleep(DELAY_MS);
  }

  writeFileSync(OUTPUT_FILE, JSON.stringify({
    verifiedAt: new Date().toISOString(),
    total: verified.length,
    verified: verifiedCount,
    noWebsite: noWebsiteCount,
    unreachable: unreachableCount,
    listings: verified,
  }, null, 2));

  console.log(`\n✅ Verified: ${verifiedCount}/${verified.length}`);
  console.log(`   No website: ${noWebsiteCount}`);
  console.log(`   Unreachable: ${unreachableCount}`);
  console.log(`   Output: ${OUTPUT_FILE}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

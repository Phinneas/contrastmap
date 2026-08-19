#!/usr/bin/env node
/**
 * fetch-photos.mjs
 * -----------------------------------------------------------------------------
 * For listings with a website URL, fetches the homepage and extracts <img>
 * URLs that meet minimum criteria (not logo/icon, reasonable size). Stores
 * the first valid image URL in listing.media.photos.
 *
 * Usage:
 *   node scripts/fetch-photos.mjs [--dry-run] [--limit=N]
 *
 * Creates a backup of listings.json before modifying.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LISTINGS_PATH = path.join(__dirname, '..', 'src', 'data', 'listings.json');
const BACKUP_PATH = path.join(__dirname, 'output', 'listings-photos-backup.json');

const dryRun = process.argv.includes('--dry-run');
const limitArg = process.argv.find(a => a.startsWith('--limit='));
const limit = limitArg ? parseInt(limitArg.split('=')[1]) : null;

const DELAY = 500; // ms between requests

// --- Helpers ---

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

function isLogoOrIcon(img) {
  const src = (img.getAttribute('src') || '').toLowerCase();
  const alt = (img.getAttribute('alt') || '').toLowerCase();
  const cls = (img.getAttribute('class') || '').toLowerCase();
  const width = parseInt(img.getAttribute('width') || '0');
  const height = parseInt(img.getAttribute('height') || '0');

  // Skip if explicitly small
  if (width > 0 && width < 200) return true;
  if (height > 0 && height < 200) return true;

  // Skip logos, icons, sprites
  if (alt.includes('logo') || alt.includes('icon') || alt.includes('favicon')) return true;
  if (src.includes('logo') || src.includes('icon') || src.includes('sprite') || src.includes('avatar')) return true;
  if (cls.includes('logo') || cls.includes('icon')) return true;

  // Skip tracking pixels
  if (src.includes('pixel') || src.includes('tracker') || src.includes('analytics')) return true;

  return false;
}

function resolveUrl(src, baseUrl) {
  try {
    if (src.startsWith('//')) return 'https:' + src;
    if (src.startsWith('http')) return src;
    if (src.startsWith('/')) return new URL(baseUrl).origin + src;
    return new URL(src, baseUrl).href;
  } catch {
    return null;
  }
}

async function fetchPage(url) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
      redirect: 'follow',
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const html = await res.text();
    return html;
  } catch {
    return null;
  }
}

function extractImages(html, baseUrl) {
  const images = [];
  const imgRegex = /<img[^>]+>/gi;
  let match;
  while ((match = imgRegex.exec(html)) !== null) {
    const tag = match[0];
    const srcMatch = tag.match(/src=["']([^"']+)["']/i);
    if (!srcMatch) continue;
    const src = srcMatch[1];
    const resolved = resolveUrl(src, baseUrl);
    if (!resolved) continue;

    // Quick check for logo/icon patterns in src
    const srcLower = resolved.toLowerCase();
    if (srcLower.includes('logo') || srcLower.includes('icon') || srcLower.includes('favicon')) continue;
    if (srcLower.includes('sprite') || srcLower.includes('avatar')) continue;
    if (srcLower.endsWith('.svg') || srcLower.endsWith('.gif')) continue;

    // Check for data URIs
    if (resolved.startsWith('data:')) continue;

    images.push(resolved);
  }
  return images;
}

// --- Main ---

async function main() {
  console.log(`\n${'='.repeat(60)}`);
  console.log('ContrastMap Photo Fetcher');
  console.log(`${'='.repeat(60)}\n`);

  const raw = fs.readFileSync(LISTINGS_PATH, 'utf-8');
  const data = JSON.parse(raw);
  const listings = data.listings;

  let processed = 0;
  let found = 0;
  let failed = 0;
  let skipped = 0;

  for (const listing of listings) {
    if (limit && processed >= limit) break;

    // Skip if already has photos
    if (listing.media.photos && listing.media.photos.length > 0) {
      skipped++;
      continue;
    }

    // Skip if no website
    if (!listing.contact.website) {
      skipped++;
      continue;
    }

    processed++;

    console.log(`[${processed}] ${listing.name} -> ${listing.contact.website}`);

    const html = await fetchPage(listing.contact.website);
    if (!html) {
      console.log(`  ✗ Could not fetch page`);
      failed++;
      await delay(DELAY);
      continue;
    }

    const images = extractImages(html, listing.contact.website);
    if (images.length === 0) {
      console.log(`  ✗ No suitable images found`);
      failed++;
      await delay(DELAY);
      continue;
    }

    // Take up to 3 images
    const photos = images.slice(0, 3);
    console.log(`  ✓ Found ${photos.length} image(s): ${photos.map(p => p.substring(0, 60) + '...').join(', ')}`);

    if (!dryRun) {
      listing.media.photos = photos;
    }
    found++;

    await delay(DELAY);
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log('Results:');
  console.log(`  Processed: ${processed}`);
  console.log(`  Photos found: ${found}`);
  console.log(`  Failed: ${failed}`);
  console.log(`  Skipped (already has photos or no website): ${skipped}`);
  console.log(`  Total listings: ${listings.length}`);

  if (!dryRun && found > 0) {
    const outputDir = path.join(__dirname, 'output');
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(BACKUP_PATH, raw);
    console.log(`  Backup: ${BACKUP_PATH}`);
    fs.writeFileSync(LISTINGS_PATH, JSON.stringify(data, null, 2));
    console.log(`  Written: ${LISTINGS_PATH}`);
  }

  if (dryRun) {
    console.log('\n(Dry run — no files modified.)');
  }
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});

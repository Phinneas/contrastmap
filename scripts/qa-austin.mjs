#!/usr/bin/env node
/**
 * qa-austin.mjs
 * -----------------------------------------------------------------------------
 * QA pass on Austin listings. Checks:
 * - Address is non-null and has a street number
 * - Coordinates are within Austin metro area
 * - No duplicate slugs or names
 * - Website URLs return 200 (HEAD request, 5s timeout)
 * - Hours are not all null
 * - At least one core amenity is true
 *
 * Usage:
 *   node scripts/qa-austin.mjs [--city=Austin]
 *
 * Output: scripts/output/qa-austin-report.json
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LISTINGS_PATH = path.join(__dirname, '..', 'src', 'data', 'listings.json');
const OUTPUT_PATH = path.join(__dirname, 'output', 'qa-austin-report.json');

const cityArg = process.argv.find(a => a.startsWith('--city='));
const city = cityArg ? cityArg.split('=')[1] : 'Austin';

// Austin metro area bounds (approximate)
const AUSTIN_BOUNDS = {
  minLat: 30.0, maxLat: 30.7,
  minLng: -98.0, maxLng: -97.5,
};

const DELAY = 200;

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

async function checkUrl(url) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
      redirect: 'follow',
    });
    clearTimeout(timeout);
    return { status: res.status, ok: res.ok };
  } catch (err) {
    return { status: 0, ok: false, error: err.message };
  }
}

async function main() {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`ContrastMap QA Pass — ${city}`);
  console.log(`${'='.repeat(60)}\n`);

  const raw = fs.readFileSync(LISTINGS_PATH, 'utf-8');
  const data = JSON.parse(raw);
  const listings = data.listings.filter(l => l.location.city === city);

  console.log(`Found ${listings.length} listings in ${city}\n`);

  const report = {
    city,
    total: listings.length,
    checked: 0,
    errors: [],
    warnings: [],
    stats: {
      addressOk: 0,
      coordsOk: 0,
      websiteOk: 0,
      hoursOk: 0,
      amenitiesOk: 0,
      duplicates: 0,
    },
  };

  // Check for duplicates
  const slugSet = new Set();
  const nameSet = new Set();
  for (const l of listings) {
    if (slugSet.has(l.slug)) {
      report.errors.push({ listing: l.name, type: 'duplicate-slug', slug: l.slug, severity: 'critical' });
      report.stats.duplicates++;
    }
    slugSet.add(l.slug);
    if (nameSet.has(l.name.toLowerCase())) {
      report.warnings.push({ listing: l.name, type: 'duplicate-name', severity: 'warning' });
    }
    nameSet.add(l.name.toLowerCase());
  }

  for (const l of listings) {
    report.checked++;
    const issues = [];

    // 1. Address check
    if (!l.location.address || l.location.address.trim().length < 5) {
      issues.push({ type: 'address-missing', severity: 'error' });
    } else if (!/^\d+/.test(l.location.address)) {
      issues.push({ type: 'address-no-number', severity: 'warning', value: l.location.address });
    } else {
      report.stats.addressOk++;
    }

    // 2. Coordinates check
    if (l.location.coordinates) {
      const { lat, lng } = l.location.coordinates;
      const bounds = city === 'Austin' ? AUSTIN_BOUNDS : null;
      if (bounds && (lat < bounds.minLat || lat > bounds.maxLat || lng < bounds.minLng || lng > bounds.maxLng)) {
        issues.push({ type: 'coords-out-of-bounds', severity: 'error', lat, lng });
      } else {
        report.stats.coordsOk++;
      }
    } else {
      issues.push({ type: 'coords-missing', severity: 'error' });
    }

    // 3. Hours check
    const hasHours = l.hours && Object.values(l.hours).some(d => d && !d.closed && d.open);
    if (!hasHours) {
      issues.push({ type: 'hours-missing', severity: 'warning' });
    } else {
      report.stats.hoursOk++;
    }

    // 4. Amenities check
    const hasCore = l.amenities.coldPlunge || l.amenities.infraredSauna || l.amenities.traditionalSauna;
    if (!hasCore) {
      issues.push({ type: 'no-core-amenity', severity: 'error' });
    } else {
      report.stats.amenitiesOk++;
    }

    // 5. Website check (async, but we'll do it inline for simplicity)
    if (l.contact.website) {
      const result = await checkUrl(l.contact.website);
      if (!result.ok) {
        issues.push({ type: 'website-broken', severity: 'warning', url: l.contact.website, status: result.status });
      } else {
        report.stats.websiteOk++;
      }
    } else {
      issues.push({ type: 'website-missing', severity: 'info' });
    }

    // Record issues
    for (const issue of issues) {
      if (issue.severity === 'error') {
        report.errors.push({ listing: l.name, slug: l.slug, ...issue });
      } else if (issue.severity === 'warning') {
        report.warnings.push({ listing: l.name, slug: l.slug, ...issue });
      }
    }

    if (issues.length > 0) {
      console.log(`  [${issues.length} issues] ${l.name}`);
      issues.forEach(i => console.log(`    - ${i.type} (${i.severity})`));
    } else {
      console.log(`  [OK] ${l.name}`);
    }

    await delay(DELAY);
  }

  // Summary
  console.log(`\n${'='.repeat(60)}`);
  console.log('QA Summary:');
  console.log(`  Total: ${report.total}`);
  console.log(`  Checked: ${report.checked}`);
  console.log(`  Errors: ${report.errors.length}`);
  console.log(`  Warnings: ${report.warnings.length}`);
  console.log(`  Address OK: ${report.stats.addressOk}/${report.total}`);
  console.log(`  Coords OK: ${report.stats.coordsOk}/${report.total}`);
  console.log(`  Website OK: ${report.stats.websiteOk}/${report.total}`);
  console.log(`  Hours OK: ${report.stats.hoursOk}/${report.total}`);
  console.log(`  Amenities OK: ${report.stats.amenitiesOk}/${report.total}`);
  console.log(`  Duplicates: ${report.stats.duplicates}`);

  // Write report
  const outputDir = path.join(__dirname, 'output');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(report, null, 2));
  console.log(`\nReport: ${OUTPUT_PATH}`);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});

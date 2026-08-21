#!/usr/bin/env node
/**
 * confidence-report.mjs
 *
 * Computes the Listing Confidence score for every facility listing and flags
 * any whose `description` shows signs of scraped/non-editorial content. Uses the
 * SAME scoring module the pages use (src/lib/confidence-score.ts), via Node's
 * built-in TypeScript stripping — single source of truth, no duplication.
 *
 * This is a build-time diagnostic only: it prints a human summary to stdout and
 * writes a machine-readable report to scripts/output/. It does NOT modify
 * listings.json and does NOT emit anything into page output.
 *
 * Usage:  node --experimental-strip-types scripts/confidence-report.mjs
 *   (Node 22.6+ required for --experimental-strip-types; this repo's Node is 22.22.3)
 * Input:  src/data/listings.json
 * Output: scripts/output/confidence-report.json  +  console summary
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { computeListingConfidence, detectScrapedContent } from '../src/lib/confidence-score.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const INPUT_FILE = join(ROOT, 'src/data/listings.json');
const OUTPUT_DIR = join(__dirname, 'output');
const OUTPUT_FILE = join(OUTPUT_DIR, 'confidence-report.json');

function show(tag, row) {
  const s = row.score;
  console.log(
    `\n[${tag}] ${row.name} (${row.slug}) — id ${row.id}\n` +
      `  total=${s.total}  recency=${s.recency}/40  verified=${s.verified}/20  ` +
      `hours=${s.hours}/10  photos=${s.photos}/10  contact=${s.contact}/10  addr=${s.address}/10`
  );
}

function main() {
  const data = JSON.parse(readFileSync(INPUT_FILE, 'utf-8'));
  const listings = data.listings || [];
  const now = new Date();
  console.log(`🔥 ContrastMap — Listing Confidence report (now = ${now.toISOString().slice(0, 10)})`);
  console.log(`   Input: ${listings.length} listings`);

  const rows = listings.map((l) => {
    const score = computeListingConfidence(l, now);
    const markers = detectScrapedContent(l);
    return { id: l.id, slug: l.slug, name: l.name, score, markers };
  });

  // ---- distribution ----
  const totals = rows.map((r) => r.score.total).sort((a, b) => a - b);
  const bands = {
    '>=70': totals.filter((t) => t >= 70).length,
    '40-69': totals.filter((t) => t >= 40 && t < 70).length,
    '<40': totals.filter((t) => t < 40).length,
  'photos=0': rows.filter((r) => r.score.photos === 0).length,
    'address=0 (postalCode missing)': rows.filter((r) => r.score.address === 0).length,
    'realHours=0 (stub hours)': rows.filter((r) => r.score.hours === 0).length,
  'verified=true': rows.filter((r) => r.score.verified === 20).length,
  'contact=0': rows.filter((r) => r.score.contact === 0).length,
  'recency=0 (>12mo / missing)': rows.filter((r) => r.score.recency === 0).length,
  'scraped-content flags': rows.filter((r) => r.markers.length > 0).length,
  'scraped-content (severe)': rows.filter((r) => r.markers.length > 1).length,
  'scraped-content (nextjs blob)': rows.filter((r) => r.markers.length > 2).length,
  'total with real hours': rows.filter((r) => r.score.hours === 10).length,
    'total with photos': rows.filter((r) => r.score.photos === 10).length,
    'total with full address': rows.filter((r) => r.score.address === 10).length,
    'total with phone+website': rows.filter((r) => r.score.contact === 10).length,
  };

  console.log('\n=== DISTRIBUTION ===');
  console.log(`  range: ${totals[0]} .. ${totals[totals.length - 1]}`);
  for (const [k, v] of Object.entries(bands)) {
    console.log(`  ${k}: ${v}`);
  }

  // ---- examples: contrast + highest + lowest + median + one real-hours ----
  const byScore = [...rows].sort((a, b) => b.score.total - a.score.total);
  const contrast = rows.find((r) => r.slug === 'contrast-austin-tx');
  const realHoursExample = rows.find((r) => r.score.hours === 10 && r.slug !== 'contrast-austin-tx');
  console.log('\n=== EXAMPLE SCORES (with breakdown) ===');
  if (contrast) show('CØNTRAST', contrast);
  show('HIGHEST', byScore[0]);
  show('LOWEST', byScore[byScore.length - 1]);
  show('MEDIAN', byScore[Math.floor(byScore.length / 2)]);
  if (realHoursExample) show('REAL-HOURS EXAMPLE', realHoursExample);

  // ---- scraped-content flags ----
  const flags = rows.filter((r) => r.markers.length > 0);
  console.log('\n=== SCRAPED-CONTENT FLAGS (manual review — not auto-cleaned) ===');
  console.log(`total flagged: ${flags.length}`);
  for (const f of flags) {
    console.log(`  ${f.id}  ${f.slug}  [${f.markers.length} marker${f.markers.length > 1 ? 's' : ''}]  ${f.name.slice(0, 50)}`);
  }

  // ---- write machine-readable report ----
  mkdirSync(OUTPUT_DIR, { recursive: true });
  writeFileSync(
    OUTPUT_FILE,
    JSON.stringify(
      {
        generatedAt: now.toISOString(),
        count: rows.length,
        distribution: { range: [totals[0], totals[totals.length - 1]], bands },
        listings: rows.map((r) => ({ id: r.id, slug: r.slug, name: r.name, score: r.score })),
        flags: flags.map((r) => ({ id: r.id, slug: r.slug, name: r.name, markers: r.markers })),
      },
      null,
      2
    )
  );
  console.log(`\n✅ Report written: ${OUTPUT_FILE}`);
}

main();

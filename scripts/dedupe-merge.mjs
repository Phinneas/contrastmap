#!/usr/bin/env node
/**
 * dedupe-merge.mjs
 *
 * Merges competitor-listings.json and gmaps-listings.json,
 * deduplicates by name + city, and flags conflicts.
 *
 * Usage: node scripts/dedupe-merge.mjs
 * Output: scripts/output/merged-candidates.json
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, 'output');
const OUTPUT_FILE = join(OUTPUT_DIR, 'merged-candidates.json');

function loadJson(path) {
  if (!existsSync(path)) {
    console.log(`   ⚠️  ${path} not found, skipping`);
    return [];
  }
  const data = JSON.parse(readFileSync(path, 'utf-8'));
  return data.venues || data.results || [];
}

/** Normalize a business name for dedup comparison */
function normalizeName(name) {
  return name.toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\b(the|and|&|spa|studio|wellness|recovery|center|centre|club|inc|llc)\b/g, '')
    .trim()
    .replace(/\s+/g, ' ');
}

/** Check if two names are likely the same business */
function isSameBusiness(name1, name2) {
  const n1 = normalizeName(name1);
  const n2 = normalizeName(name2);
  if (n1 === n2) return true;
  // Check if one contains the other (e.g., "IcePass" vs "IcePass Cold Plunge & Sauna Club")
  if (n1.length > 8 && n2.length > 8) {
    if (n1.includes(n2) || n2.includes(n1)) return true;
  }
  // Levenshtein-like check for close matches
  const shorter = n1.length < n2.length ? n1 : n2;
  const longer = n1.length < n2.length ? n2 : n1;
  if (shorter.length > 10 && longer.includes(shorter)) return true;
  return false;
}

function mergeFields(existing, incoming) {
  const merged = { ...existing };
  const conflicts = [];

  for (const [key, value] of Object.entries(incoming)) {
    if (value == null || value === '') continue;
    if (key === 'source' || key === 'sourceUrl' || key === 'cityName' || key === 'stateName') continue;

    if (merged[key] == null || merged[key] === '' || merged[key] === undefined) {
      merged[key] = value;
    } else if (key === 'services' || key === 'amenities') {
      // Merge arrays, dedupe
      const existingArr = Array.isArray(merged[key]) ? merged[key] : [];
      const incomingArr = Array.isArray(value) ? value : [];
      merged[key] = [...new Set([...existingArr, ...incomingArr])];
    } else if (String(merged[key]) !== String(value)) {
      conflicts.push({ field: key, existing: merged[key], incoming: value });
    }
  }

  // Track all sources
  merged.sources = [...new Set([...(merged.sources || []), incoming.source || 'unknown'])];

  return { merged, conflicts };
}

async function main() {
  console.log(`🔥 ContrastMap — Dedupe & Merge`);

  const competitorData = loadJson(join(OUTPUT_DIR, 'competitor-listings.json'));
  const gmapsData = loadJson(join(OUTPUT_DIR, 'gmaps-listings.json'));

  console.log(`   Competitor listings: ${competitorData.length}`);
  console.log(`   Google Maps candidates: ${gmapsData.length}`);

  const allCandidates = [...competitorData, ...gmapsData];
  const merged = [];
  const allConflicts = [];

  for (const candidate of allCandidates) {
    if (!candidate.name || candidate.error) continue;

    const cityKey = (candidate.city || candidate.cityName || '').toLowerCase();
    const existingIdx = merged.findIndex(m =>
      isSameBusiness(m.name, candidate.name) &&
      (m.city || m.cityName || '').toLowerCase() === cityKey
    );

    if (existingIdx === -1) {
      merged.push({
        ...candidate,
        sources: [candidate.source || 'unknown'],
      });
    } else {
      const { merged: updated, conflicts } = mergeFields(merged[existingIdx], candidate);
      merged[existingIdx] = updated;
      if (conflicts.length > 0) {
        allConflicts.push({
          name: candidate.name,
          city: candidate.city || candidate.cityName,
          conflicts,
        });
      }
    }
  }

  // Sort by city then name
  merged.sort((a, b) => {
    const cityA = (a.city || a.cityName || '').toLowerCase();
    const cityB = (b.city || b.cityName || '').toLowerCase();
    if (cityA !== cityB) return cityA.localeCompare(cityB);
    return (a.name || '').localeCompare(b.name || '');
  });

  writeFileSync(OUTPUT_FILE, JSON.stringify({
    mergedAt: new Date().toISOString(),
    totalCandidates: allCandidates.length,
    totalMerged: merged.length,
    conflicts: allConflicts.length,
    listings: merged,
    conflictDetails: allConflicts,
  }, null, 2));

  console.log(`\n✅ Merged: ${merged.length} unique listings (${allCandidates.length} -> ${merged.length})`);
  console.log(`   Conflicts: ${allConflicts.length}`);
  console.log(`   Output: ${OUTPUT_FILE}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

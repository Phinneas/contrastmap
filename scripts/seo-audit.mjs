#!/usr/bin/env node
/**
 * seo-audit.mjs
 * -----------------------------------------------------------------------------
 * Crawls the built dist/ directory and checks:
 * - Every HTML file has a unique <title> under 60 chars
 * - Every HTML file has a <meta description> under 155 chars
 * - Exactly one <h1> per page
 * - All <img> tags have alt attributes
 * - Canonical tags present and unique
 * - No broken internal links
 *
 * Usage:
 *   node scripts/seo-audit.mjs
 *
 * Output: scripts/output/seo-audit-report.json
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_PATH = path.join(__dirname, '..', 'dist');
const OUTPUT_PATH = path.join(__dirname, 'output', 'seo-audit-report.json');

function walkDir(dir, ext = '.html') {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkDir(fullPath, ext));
    } else if (entry.name.endsWith(ext)) {
      results.push(fullPath);
    }
  }
  return results;
}

function extractTags(html) {
  const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : null;

  const descMatch = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i);
  const desc = descMatch ? descMatch[1].trim() : null;

  const canonicalMatch = html.match(/<link\s+rel=["']canonical["']\s+href=["']([^"']*)["']/i);
  const canonical = canonicalMatch ? canonicalMatch[1].trim() : null;

  const h1Matches = html.match(/<h1[^>]*>/gi);
  const h1Count = h1Matches ? h1Matches.length : 0;

  // Check for images without alt
  const imgMatches = html.match(/<img[^>]+>/gi) || [];
  const imgsWithoutAlt = imgMatches.filter(img => !/\balt\s*=/i.test(img));

  // Extract all internal links
  const linkMatches = html.match(/<a[^>]+href=["']([^"']*)["']/gi) || [];
  const links = linkMatches.map(match => {
    const hrefMatch = match.match(/href=["']([^"']*)["']/i);
    return hrefMatch ? hrefMatch[1] : null;
  }).filter(Boolean);

  return { title, desc, canonical, h1Count, imgsWithoutAlt, links };
}

function resolveLink(href, basePath, distPath) {
  // Skip external links, anchors, mailto, tel
  if (href.startsWith('http') || href.startsWith('mailto') || href.startsWith('tel') || href.startsWith('#')) {
    return null;
  }
  // Remove query string and anchor
  let clean = href.split('?')[0].split('#')[0];
  if (clean === '') clean = '/';

  // Resolve relative to the HTML file's directory
  let resolved;
  if (clean.startsWith('/')) {
    resolved = path.join(distPath, clean);
  } else {
    const fileDir = path.dirname(basePath);
    resolved = path.resolve(fileDir, clean);
  }

  // If it doesn't end with .html, try index.html
  if (!resolved.endsWith('.html')) {
    if (fs.existsSync(path.join(resolved, 'index.html'))) {
      resolved = path.join(resolved, 'index.html');
    } else if (fs.existsSync(resolved + '.html')) {
      resolved = resolved + '.html';
    }
  }

  return fs.existsSync(resolved) ? null : href;
}

// --- Main ---

console.log(`\n${'='.repeat(60)}`);
console.log('ContrastMap SEO Audit');
console.log(`${'='.repeat(60)}\n`);

if (!fs.existsSync(DIST_PATH)) {
  console.error('dist/ directory not found. Run `npm run build` first.');
  process.exit(1);
}

const htmlFiles = walkDir(DIST_PATH);
console.log(`Found ${htmlFiles.length} HTML files\n`);

const report = {
  totalFiles: htmlFiles.length,
  issues: [],
  stats: {
    titleOk: 0,
    titleTooLong: 0,
    titleMissing: 0,
    descOk: 0,
    descTooLong: 0,
    descMissing: 0,
    canonicalOk: 0,
    canonicalMissing: 0,
    h1Ok: 0,
    h1Missing: 0,
    h1Multiple: 0,
    imgAltOk: 0,
    imgAltMissing: 0,
    brokenLinks: 0,
  duplicateTitles: 0,
  duplicateDescs: 0,
  duplicateCanonicals: 0,
  pages: [],
  },
};

const titles = new Map();
const descs = new Map();
const canonicals = new Map();

for (const file of htmlFiles) {
  const html = fs.readFileSync(file, 'utf-8');
  const relPath = path.relative(DIST_PATH, file);
  const tags = extractTags(html);
  const pageReport = { file: relPath, issues: [] };

  // Title check
  if (!tags.title) {
    pageReport.issues.push({ type: 'title-missing', severity: 'error' });
    report.stats.titleMissing++;
  } else {
    if (tags.title.length > 60) {
      pageReport.issues.push({ type: 'title-too-long', severity: 'warning', length: tags.title.length, value: tags.title });
      report.stats.titleTooLong++;
    } else {
      report.stats.titleOk++;
    }
    if (titles.has(tags.title)) {
      pageReport.issues.push({ type: 'duplicate-title', severity: 'warning', value: tags.title, firstSeen: titles.get(tags.title) });
      report.stats.duplicateTitles++;
    } else {
      titles.set(tags.title, relPath);
    }
  }

  // Description check
  if (!tags.desc) {
    pageReport.issues.push({ type: 'desc-missing', severity: 'error' });
    report.stats.descMissing++;
  } else {
    if (tags.desc.length > 155) {
      pageReport.issues.push({ type: 'desc-too-long', severity: 'warning', length: tags.desc.length });
      report.stats.descTooLong++;
    } else {
      report.stats.descOk++;
    }
    if (descs.has(tags.desc)) {
      pageReport.issues.push({ type: 'duplicate-desc', severity: 'info' });
      report.stats.duplicateDescs++;
    } else {
      descs.set(tags.desc, relPath);
    }
  }

  // Canonical check
  if (!tags.canonical) {
    pageReport.issues.push({ type: 'canonical-missing', severity: 'warning' });
    report.stats.canonicalMissing++;
  } else {
    report.stats.canonicalOk++;
    if (canonicals.has(tags.canonical)) {
      pageReport.issues.push({ type: 'duplicate-canonical', severity: 'error', value: tags.canonical });
      report.stats.duplicateCanonicals++;
    } else {
      canonicals.set(tags.canonical, relPath);
    }
  }

  // H1 check
  if (tags.h1Count === 0) {
    pageReport.issues.push({ type: 'h1-missing', severity: 'error' });
    report.stats.h1Missing++;
  } else if (tags.h1Count > 1) {
    pageReport.issues.push({ type: 'h1-multiple', severity: 'warning', count: tags.h1Count });
    report.stats.h1Multiple++;
  } else {
    report.stats.h1Ok++;
  }

  // Image alt check
  if (tags.imgsWithoutAlt.length > 0) {
    pageReport.issues.push({ type: 'img-alt-missing', severity: 'warning', count: tags.imgsWithoutAlt.length });
    report.stats.imgAltMissing += tags.imgsWithoutAlt.length;
  } else {
    report.stats.imgAltOk++;
  }

  // Broken links check
  for (const link of tags.links) {
    const broken = resolveLink(link, file, DIST_PATH);
    if (broken) {
      pageReport.issues.push({ type: 'broken-link', severity: 'error', href: broken });
      report.stats.brokenLinks++;
    }
  }

  if (pageReport.issues.length > 0) {
    report.issues.push(...pageReport.issues.map(i => ({ file: relPath, ...i })));
    console.log(`  [${pageReport.issues.length} issues] ${relPath}`);
    pageReport.issues.forEach(i => console.log(`    - ${i.type} (${i.severity})${i.value ? ': ' + i.value.substring(0, 60) : ''}`));
  } else {
    console.log(`  [OK] ${relPath}`);
  }

  report.stats.pages.push(pageReport);
}

console.log(`\n${'='.repeat(60)}`);
console.log('SEO Audit Summary:');
console.log(`  Files checked: ${report.totalFiles}`);
console.log(`  Title OK: ${report.stats.titleOk}`);
console.log(`  Title too long: ${report.stats.titleTooLong}`);
console.log(`  Title missing: ${report.stats.titleMissing}`);
console.log(`  Desc OK: ${report.stats.descOk}`);
console.log(`  Desc too long: ${report.stats.descTooLong}`);
console.log(`  Desc missing: ${report.stats.descMissing}`);
console.log(`  Canonical OK: ${report.stats.canonicalOk}`);
console.log(`  H1 OK: ${report.stats.h1Ok}`);
console.log(`  H1 missing: ${report.stats.h1Missing}`);
console.log(`  H1 multiple: ${report.stats.h1Multiple}`);
console.log(`  Img alt OK: ${report.stats.imgAltOk}`);
console.log(`  Img alt missing: ${report.stats.imgAltMissing}`);
console.log(`  Broken links: ${report.stats.brokenLinks}`);
console.log(`  Duplicate titles: ${report.stats.duplicateTitles}`);
console.log(`  Duplicate canonicals: ${report.stats.duplicateCanonicals}`);

const outputDir = path.join(__dirname, 'output');
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(OUTPUT_PATH, JSON.stringify(report, null, 2));
console.log(`\nReport: ${OUTPUT_PATH}`);

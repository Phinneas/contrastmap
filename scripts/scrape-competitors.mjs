#!/usr/bin/env node
/**
 * scrape-competitors.mjs
 *
 * Scrapes plungesaunafinder.com for venue listings across target cities.
 * Extracts: name, address, rating, reviews, hours, services, amenities,
 * phone, website, Google Maps link, coordinates (from Maps link).
 *
 * Usage: node scripts/scrape-competitors.mjs [--cities "Austin,TX,Denver,CO"]
 * Default: scrapes all 10 MVP cities + 3 existing cities.
 *
 * Output: scripts/output/competitor-listings.json
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, 'output');
const OUTPUT_FILE = join(OUTPUT_DIR, 'competitor-listings.json');

const BASE_URL = 'https://plungesaunafinder.com';

// City -> state slug mapping
const DEFAULT_CITIES = [
  { name: 'Austin', state: 'Texas', stateSlug: 'texas', citySlug: 'austin' },
  { name: 'Denver', state: 'Colorado', stateSlug: 'colorado', citySlug: 'denver' },
  { name: 'Chicago', state: 'Illinois', stateSlug: 'illinois', citySlug: 'chicago' },
  { name: 'San Diego', state: 'California', stateSlug: 'california', citySlug: 'san-diego' },
  { name: 'Houston', state: 'Texas', stateSlug: 'texas', citySlug: 'houston' },
  { name: 'New York', state: 'New York', stateSlug: 'new-york', citySlug: 'new-york' },
  { name: 'Los Angeles', state: 'California', stateSlug: 'california', citySlug: 'los-angeles' },
  { name: 'Tampa', state: 'Florida', stateSlug: 'florida', citySlug: 'tampa' },
  { name: 'Las Vegas', state: 'Nevada', stateSlug: 'nevada', citySlug: 'las-vegas' },
  { name: 'Minneapolis', state: 'Minnesota', stateSlug: 'minnesota', citySlug: 'minneapolis' },
  { name: 'Nashville', state: 'Tennessee', stateSlug: 'tennessee', citySlug: 'nashville' },
];

const DELAY_MS = 500; // delay between requests

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function fetchPage(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

/** Extract venue links from a city page */
function parseVenueLinks(html, stateSlug, citySlug) {
  const links = new Set();
  // Match /wellness/{state}/{city}/{slug} pattern
  const regex = new RegExp(
    `/wellness/${stateSlug}/${citySlug.replace(/[-\s]/g, '%20')}[/']([a-z0-9-]+)`,
    'gi'
  );
  // Also try without URL encoding
  const regex2 = new RegExp(
    `/wellness/${stateSlug}/${citySlug}[/']([a-z0-9-]+)`,
    'gi'
  );
  let match;
  while ((match = regex.exec(html)) !== null) {
    links.add(match[1]);
  }
  while ((match = regex2.exec(html)) !== null) {
    links.add(match[1]);
  }
  return [...links];
}

/** Strip HTML comments and tags, return clean text */
function stripHtml(s) {
  return s
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/  +/g, ' ')
    .trim();
}

/** Parse a venue page to extract listing data */
function parseVenuePage(html, url) {
  const data = { source: 'plungesaunafinder.com', sourceUrl: url };

  // Name (H1)
  const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1Match) data.name = stripHtml(h1Match[1]);

  // Address (after 📍 emoji, may have HTML comments/tags)
  const addrMatch = html.match(/📍([\s\S]*?)<\/p>/i);
  if (addrMatch) {
    const addrText = stripHtml(addrMatch[1]);
    if (addrText) {
      data.address = addrText;
      const parts = addrText.match(/^(.+?),\s*(.+?),\s*([A-Z]{2}),\s*(\d{5})/);
      if (parts) {
        data.streetAddress = parts[1].trim();
        data.city = parts[2].trim();
        data.state = parts[3].trim();
        data.postalCode = parts[4].trim();
      }
    }
  }

  // Rating and reviews (after ⭐ emoji, spans across HTML elements)
  const ratingSection = html.match(/⭐[\s\S]{0,300}?reviews?\)/i);
  if (ratingSection) {
    const cleanText = stripHtml(ratingSection[0]);
    const ratingMatch = cleanText.match(/([\d.]+)\s*\(([\d,]+)\s*reviews?\)/);
    if (ratingMatch) {
      data.rating = parseFloat(ratingMatch[1]);
      data.reviewCount = parseInt(ratingMatch[2].replace(/,/g, ''), 10);
    }
  }

  // Google Maps link (extract place_id)
  const mapsMatch = html.match(/https:\/\/www\.google\.com\/maps\/place\/?\?q=place_id:([^"&\s]+)/);
  if (mapsMatch) {
    data.googlePlaceId = mapsMatch[1];
  }

  // Hours — look for day patterns in the hours section
  const hoursSection = html.match(/🕐[\s\S]*?(?=<h2|<strong>|$)/i);
  const hoursHtml = hoursSection ? hoursSection[0] : html;
  const hours = {};
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  for (const day of days) {
    const dayRegex = new RegExp(`${day}[^<]*</span>[^<]*<span[^>]*>([^<]+)</span>`, 'i');
    const dayMatch = hoursHtml.match(dayRegex);
    if (dayMatch) {
      const hoursText = stripHtml(dayMatch[1]);
      const timeMatch = hoursText.match(/([\d:]+\s*(?:AM|PM))\s*[-–]\s*([\d:]+\s*(?:AM|PM))/i);
      if (timeMatch) {
        hours[day.toLowerCase()] = { open: timeMatch[1].trim(), close: timeMatch[2].trim(), closed: false };
      } else if (/closed/i.test(hoursText)) {
        hours[day.toLowerCase()] = { closed: true };
      } else {
        hours[day.toLowerCase()] = { closed: false };
      }
    } else {
      // Fallback: try simpler pattern
      const simpleMatch = hoursHtml.match(new RegExp(`${day}:\\s*([\\d:]+\\s*(?:AM|PM))\\s*[-–]\\s*([\\d:]+\\s*(?:AM|PM))`, 'i'));
      if (simpleMatch) {
        hours[day.toLowerCase()] = { open: simpleMatch[1].trim(), close: simpleMatch[2].trim(), closed: false };
      } else {
        hours[day.toLowerCase()] = { closed: false };
      }
    }
  }
  data.hours = hours;

  // Services (after <strong>Services:</strong>)
  const servicesMatch = html.match(/Services:\s*<\/strong>([\s\S]*?)<\/p>/i);
  if (servicesMatch) {
    const servicesText = stripHtml(servicesMatch[1]);
    if (servicesText) data.services = servicesText.split(',').map(s => s.trim()).filter(Boolean);
  }

  // Amenities (after "Amenities & Features" heading)
  const amenitiesSection = html.match(/Amenities[^<]*<\/h2>([\s\S]*?)(?=<h2|<\/div><div|$)/i);
  if (amenitiesSection) {
    const chips = amenitiesSection[1].match(/<span[^>]*>([^<]+)<\/span>/gi) || [];
    data.amenities = chips.map(c => stripHtml(c)).filter(Boolean);
  }

  // About / description
  const aboutMatch = html.match(/About[^<]*<\/h2>([\s\S]*?)(?=<h2|<a href="tel:|$)/i);
  if (aboutMatch) {
    data.description = stripHtml(aboutMatch[1]);
  }

  // Phone (tel: link)
  const phoneMatch = html.match(/href="tel:([^"]+)"/);
  if (phoneMatch) {
    data.phone = phoneMatch[1].trim();
  }

  // Website — find the business website link (not Google Maps, not plungesaunafinder)
  const allLinks = [...html.matchAll(/<a[^>]*href="(https?:\/\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)];
  const websiteLink = allLinks.find(m => {
    const href = m[1];
    const text = stripHtml(m[2]).toLowerCase();
    return (text.includes('website') || text.includes('🌐')) &&
           !href.includes('google.com/maps') &&
           !href.includes('plungesaunafinder.com');
  });
  if (websiteLink) {
    data.website = websiteLink[1];
  } else {
    // Fallback: any external link that's not Google Maps or plungesaunafinder
    const extLink = allLinks.find(m => {
      const href = m[1];
      return !href.includes('google.com/maps') &&
             !href.includes('plungesaunafinder.com') &&
             !href.includes('mailto:') &&
             !href.includes('tel:');
    });
    if (extLink) data.website = extLink[1];
  }

  // Neighborhood (from "Best Of" section)
  const neighborhoodMatch = html.match(/Neighborhood:\s*([^.<\n]+)/);
  if (neighborhoodMatch) {
    data.neighborhood = neighborhoodMatch[1].trim();
  }

  // Pricing info (from "Best Of" section)
  const dayPassMatch = html.match(/Day pass:\s*(\$[\d,]+)/);
  if (dayPassMatch) data.dropInPrice = parseInt(dayPassMatch[1].replace(/[$,]/g, ''), 10);

  const membershipMatch = html.match(/Membership:\s*(\$[\d,]+)/);
  if (membershipMatch) data.membershipPrice = parseInt(membershipMatch[1].replace(/[$,]/g, ''), 10);

  return data;
}

async function scrapeCity(city) {
  const cityUrl = `${BASE_URL}/${city.stateSlug}/${city.citySlug}`;
  console.log(`\n📍 Scraping ${city.name}, ${city.state}...`);
  console.log(`   City page: ${cityUrl}`);

  let cityHtml;
  try {
    cityHtml = await fetchPage(cityUrl);
  } catch (err) {
    console.error(`   ❌ Failed to fetch city page: ${err.message}`);
    return [];
  }

  const venueSlugs = parseVenueLinks(cityHtml, city.stateSlug, city.citySlug);
  console.log(`   Found ${venueSlugs.length} venues`);

  const venues = [];
  for (let i = 0; i < venueSlugs.length; i++) {
    const slug = venueSlugs[i];
    const venueUrl = `${BASE_URL}/wellness/${city.stateSlug}/${city.citySlug}/${slug}`;
    console.log(`   [${i + 1}/${venueSlugs.length}] ${slug}`);

    try {
      await sleep(DELAY_MS);
      const venueHtml = await fetchPage(venueUrl);
      const venueData = parseVenuePage(venueHtml, venueUrl);
      venueData.cityName = city.name;
      venueData.stateName = city.state;
      venues.push(venueData);
    } catch (err) {
      console.error(`      ❌ ${err.message}`);
      venues.push({ name: slug, sourceUrl: venueUrl, error: err.message, cityName: city.name, stateName: city.state });
    }
  }

  return venues;
}

async function main() {
  // Parse --cities flag
  const args = process.argv.slice(2);
  let cities = DEFAULT_CITIES;
  const citiesIdx = args.indexOf('--cities');
  if (citiesIdx !== -1 && args[citiesIdx + 1]) {
    const cityArgs = args[citiesIdx + 1].split(',');
    cities = cityArgs.map(c => {
      const [name, stateCode] = c.split(':');
      const stateMap = {
        'TX': { name: 'Texas', slug: 'texas' },
        'CO': { name: 'Colorado', slug: 'colorado' },
        'IL': { name: 'Illinois', slug: 'illinois' },
        'CA': { name: 'California', slug: 'california' },
        'NY': { name: 'New York', slug: 'new-york' },
        'FL': { name: 'Florida', slug: 'florida' },
        'NV': { name: 'Nevada', slug: 'nevada' },
        'MN': { name: 'Minnesota', slug: 'minnesota' },
        'TN': { name: 'Tennessee', slug: 'tennessee' },
      };
      const state = stateMap[stateCode] || { name: stateCode, slug: stateCode.toLowerCase() };
      return {
        name: name.trim(),
        state: state.name,
        stateSlug: state.slug,
        citySlug: name.trim().toLowerCase().replace(/\s+/g, '-'),
      };
    });
  }

  console.log(`🔥 ContrastMap — Competitor Scraper`);
  console.log(`   Target: ${cities.length} cities on plungesaunafinder.com`);
  console.log(`   Output: ${OUTPUT_FILE}`);

  if (!existsSync(OUTPUT_DIR)) mkdirSync(OUTPUT_DIR, { recursive: true });

  const allVenues = [];
  for (const city of cities) {
    const venues = await scrapeCity(city);
    allVenues.push(...venues);
    console.log(`   ✅ ${city.name}: ${venues.length} venues scraped`);
  }

  writeFileSync(OUTPUT_FILE, JSON.stringify({
    scrapedAt: new Date().toISOString(),
    source: 'plungesaunafinder.com',
    totalVenues: allVenues.length,
    venues: allVenues,
  }, null, 2));

  console.log(`\n✅ Done! ${allVenues.length} total venues saved to ${OUTPUT_FILE}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

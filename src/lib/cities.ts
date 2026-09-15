/**
 * City slug map for the metros ContrastMap renders city pages for.
 * Single source of truth used by the search endpoint + search/home pages.
 *
 * `live` cities have real studio listings; `live: false` metros are the
 * next expansion targets from city-priority.json and render a "coming soon"
 * city page (no listings yet).
 */

export interface CityInfo {
  slug: string;
  name: string;
  state: string; // 2-letter abbreviation (e.g. "TX")
  live: boolean;
}

export const CITIES: CityInfo[] = [
  { slug: 'austin', name: 'Austin', state: 'TX', live: true },
  { slug: 'denver', name: 'Denver', state: 'CO', live: true },
  { slug: 'chicago', name: 'Chicago', state: 'IL', live: true },
  { slug: 'houston', name: 'Houston', state: 'TX', live: true },
  { slug: 'san-diego', name: 'San Diego', state: 'CA', live: true },
  { slug: 'los-angeles', name: 'Los Angeles', state: 'CA', live: true },
  { slug: 'new-york', name: 'New York', state: 'NY', live: true },
  { slug: 'tampa', name: 'Tampa', state: 'FL', live: true },
  { slug: 'las-vegas', name: 'Las Vegas', state: 'NV', live: true },
  { slug: 'minneapolis', name: 'Minneapolis', state: 'MN', live: true },
  { slug: 'nashville', name: 'Nashville', state: 'TN', live: true },
  // Coming soon (expansion targets from city-priority.json — no listings yet)
  { slug: 'dallas', name: 'Dallas', state: 'TX', live: false },
  { slug: 'seattle', name: 'Seattle', state: 'WA', live: false },
  { slug: 'salt-lake-city', name: 'Salt Lake City', state: 'UT', live: false },
  { slug: 'portland', name: 'Portland', state: 'OR', live: false },
  { slug: 'boston', name: 'Boston', state: 'MA', live: false },
  { slug: 'phoenix', name: 'Phoenix', state: 'AZ', live: false },
  { slug: 'atlanta', name: 'Atlanta', state: 'GA', live: false },
  { slug: 'miami', name: 'Miami', state: 'FL', live: false },
  { slug: 'san-francisco', name: 'San Francisco', state: 'CA', live: false },
];

/** City display name -> URL slug. */
export const CITY_SLUG_MAP: Record<string, string> = Object.fromEntries(
  CITIES.map((c) => [c.name, c.slug]),
);

export const CITY_SLUGS = CITIES.map((c) => c.slug);

export const LIVE_CITY_SLUGS = CITIES.filter((c) => c.live).map((c) => c.slug);

/** City display name -> URL slug, or undefined if the city isn't a covered metro. */
export function citySlugFor(cityName: string): string | undefined {
  return CITY_SLUG_MAP[cityName];
}

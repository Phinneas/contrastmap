/**
 * State layer for the ContrastMap city → state directory.
 * Single source of truth for state pages (/states/[state]) and the
 * state breadcrumbs used on city / amenity / listing-detail pages.
 *
 * City slugs here are kept in sync with src/lib/cities.ts. A city with
 * `live: false` renders as "coming soon" (no studio listings yet).
 */

export interface StateCity {
  slug: string;
  name: string;
  live?: boolean; // false => coming soon (no listings yet)
}

export interface StateInfo {
  name: string;   // "Texas"
  abbr: string;    // "TX"
  slug: string;   // "texas"
  cities: StateCity[];
}

export const STATES: StateInfo[] = [
  { name: 'Texas',      abbr: 'TX', slug: 'texas',      cities: [{ slug: 'austin', name: 'Austin' }, { slug: 'houston', name: 'Houston' }, { slug: 'dallas', name: 'Dallas', live: false }] },
  { name: 'California', abbr: 'CA', slug: 'california', cities: [{ slug: 'los-angeles', name: 'Los Angeles' }, { slug: 'san-diego', name: 'San Diego' }, { slug: 'san-francisco', name: 'San Francisco', live: false }] },
  { name: 'New York',   abbr: 'NY', slug: 'new-york',   cities: [{ slug: 'new-york', name: 'New York' }] },
  { name: 'Colorado',   abbr: 'CO', slug: 'colorado',   cities: [{ slug: 'denver', name: 'Denver' }] },
  { name: 'Illinois',   abbr: 'IL', slug: 'illinois',   cities: [{ slug: 'chicago', name: 'Chicago' }] },
  { name: 'Florida',    abbr: 'FL', slug: 'florida',    cities: [{ slug: 'tampa', name: 'Tampa' }, { slug: 'miami', name: 'Miami', live: false }] },
  { name: 'Nevada',     abbr: 'NV', slug: 'nevada',     cities: [{ slug: 'las-vegas', name: 'Las Vegas' }] },
  { name: 'Minnesota',  abbr: 'MN', slug: 'minnesota',  cities: [{ slug: 'minneapolis', name: 'Minneapolis' }] },
  { name: 'Tennessee',  abbr: 'TN', slug: 'tennessee',  cities: [{ slug: 'nashville', name: 'Nashville' }] },
  { name: 'Washington', abbr: 'WA', slug: 'washington', cities: [{ slug: 'seattle', name: 'Seattle', live: false }] },
  { name: 'Utah',       abbr: 'UT', slug: 'utah',       cities: [{ slug: 'salt-lake-city', name: 'Salt Lake City', live: false }] },
  { name: 'Oregon',     abbr: 'OR', slug: 'oregon',     cities: [{ slug: 'portland', name: 'Portland', live: false }] },
  { name: 'Massachusetts', abbr: 'MA', slug: 'massachusetts', cities: [{ slug: 'boston', name: 'Boston', live: false }] },
  { name: 'Arizona',    abbr: 'AZ', slug: 'arizona',    cities: [{ slug: 'phoenix', name: 'Phoenix', live: false }] },
  { name: 'Georgia',    abbr: 'GA', slug: 'georgia',    cities: [{ slug: 'atlanta', name: 'Atlanta', live: false }] },
];

export const STATE_SLUG_MAP: Record<string, StateInfo> = Object.fromEntries(
  STATES.map((s) => [s.slug, s]),
);

/** Look up a state by its 2-letter abbreviation (e.g. "TX"), as stored on listing.location.state. */
export const STATE_BY_ABBR: Record<string, StateInfo> = Object.fromEntries(
  STATES.map((s) => [s.abbr, s]),
);

/** Look up a state by one of its city slugs (e.g. "austin" -> Texas). */
export const STATE_BY_CITY_SLUG: Record<string, StateInfo> = Object.fromEntries(
  STATES.flatMap((s) => s.cities.map((c) => [c.slug, s])),
);

export const STATE_SLUGS = STATES.map((s) => s.slug);

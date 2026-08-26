/**
 * State layer for the ContrastMap city → state directory.
 * Single source of truth for state pages (/states/[state]) and the
 * state breadcrumbs used on city / amenity / listing-detail pages.
 *
 * City slugs here are kept in sync with src/lib/cities.ts and the inline
 * CITY_MAP in [city].astro (a future de-dup).
 */

export interface StateCity {
  slug: string;
  name: string;
}

export interface StateInfo {
  name: string;   // "Texas"
  abbr: string;    // "TX"
  slug: string;   // "texas"
  cities: StateCity[];
}

export const STATES: StateInfo[] = [
  { name: 'Texas',      abbr: 'TX', slug: 'texas',      cities: [{ slug: 'austin', name: 'Austin' }, { slug: 'houston', name: 'Houston' }] },
  { name: 'California', abbr: 'CA', slug: 'california', cities: [{ slug: 'los-angeles', name: 'Los Angeles' }, { slug: 'san-diego', name: 'San Diego' }] },
  { name: 'New York',   abbr: 'NY', slug: 'new-york',   cities: [{ slug: 'new-york', name: 'New York' }] },
  { name: 'Colorado',   abbr: 'CO', slug: 'colorado',   cities: [{ slug: 'denver', name: 'Denver' }] },
  { name: 'Illinois',   abbr: 'IL', slug: 'illinois',   cities: [{ slug: 'chicago', name: 'Chicago' }] },
  { name: 'Florida',    abbr: 'FL', slug: 'florida',    cities: [{ slug: 'tampa', name: 'Tampa' }] },
  { name: 'Nevada',     abbr: 'NV', slug: 'nevada',     cities: [{ slug: 'las-vegas', name: 'Las Vegas' }] },
  { name: 'Minnesota',  abbr: 'MN', slug: 'minnesota',  cities: [{ slug: 'minneapolis', name: 'Minneapolis' }] },
  { name: 'Tennessee',  abbr: 'TN', slug: 'tennessee',  cities: [{ slug: 'nashville', name: 'Nashville' }] },
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

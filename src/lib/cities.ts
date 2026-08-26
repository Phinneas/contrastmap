/**
 * City slug map for the metros ContrastMap renders city pages for.
 * Single source of truth used by the search endpoint + search/home pages.
 * Kept in sync with the inline maps in [city].astro / [amenity]/[city].astro /
 * [city]/[slug].astro (those still carry their own copies — a future de-dup).
 */
export const CITY_SLUG_MAP: Record<string, string> = {
  Austin: 'austin',
  'Los Angeles': 'los-angeles',
  'New York': 'new-york',
  Denver: 'denver',
  Chicago: 'chicago',
  'San Diego': 'san-diego',
  Houston: 'houston',
  Tampa: 'tampa',
  'Las Vegas': 'las-vegas',
  Minneapolis: 'minneapolis',
  Nashville: 'nashville',
};

export const CITY_SLUGS = Object.values(CITY_SLUG_MAP);

/** City display name -> URL slug, or undefined if the city isn't a covered metro. */
export function citySlugFor(cityName: string): string | undefined {
  return CITY_SLUG_MAP[cityName];
}

/**
 * Listing Confidence score
 * -----------------------------------------------------------------------------
 * A 0-100 per-listing score that reflects how much trustworthy, complete data
 * ContrastMap holds about a facility — NOT a customer satisfaction / quality
 * rating of the business itself. It is derived entirely from fields already
 * present in the listing data (see src/data/listing.schema.ts); no new source
 * fields are required.
 *
 * Components (weights per spec):
 *   - Verification recency   ~40  (audit.lastVerifiedDate age)
 *   - Verified flag          ~20  (editorial.verified)
 *   - Data completeness      ~40  (4 x 10: real hours, >=1 photo, phone+website,
 *                                 full address incl postalCode)
 *
 * The score is computed at build time (Astro frontmatter) and is NOT persisted
 * back into listings.json — listings.json stays pure source data and scores
 * stay fresh on every build.
 *
 * Input is a structural `ListingInput` rather than the strict `Listing`
 * interface: the real listings.json carries `null` for several fields the
 * schema declares as required strings (postalCode, phone, address2, etc. — see
 * HANDOFF.md). A structural, nullable input matches the data reality and stays
 * type-sound under strict checking.
 */

/** Per-day hours, as they actually appear in listings.json. */
interface DayHoursLike {
  open?: string | null;
  close?: string | null;
  closed: boolean;
}

/** Structural input — accepts both the strict `Listing` and the real JSON. */
export interface ListingInput {
  audit?: { lastVerifiedDate?: string | null } | null;
  editorial?: { verified?: boolean } | null;
  hours?: Record<string, DayHoursLike | null> | null;
  media?: { photos?: (string | null)[] | null } | null;
  contact?: { phone?: string | null; website?: string | null } | null;
  location?: {
    address?: string | null;
    city?: string | null;
    state?: string | null;
    postalCode?: string | null;
  } | null;
  description?: string | null;
}

/** Rounded 0-100 score with its component breakdown. */
export interface ConfidenceScore {
  total: number; // 0-100
  recency: number; // /40
  verified: number; // /20
  hours: number; // /10
  photos: number; // /10
  contact: number; // /10
  address: number; // /10
}

/** Marker regexes that indicate a `description` was scraped from another site. */
export const SCRAPE_MARKERS: RegExp[] = [
  /self\.__next_f\.push/i,
  /<\/?script/i,
  /dangerouslySetInnerHTML/i,
  /_next\/static/i,
  /PlungeSaunaFinder/i,
  /saunanearme/i,
  /©\s*\d{4}\s+[A-Z]/,
  /Own this business\?\s*Claim your listing/i,
  /__NEXT_DATA__/i,
];

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
const MS_PER_DAY = 86_400_000;

/**
 * True only if every day carries real hours data. A day counts as valid if it
 * is either explicitly closed (`closed: true`) or has both `open` and `close`
 * strings. The migration placeholder shape `{ closed: false }` with no
 * open/close is treated as "hours not verified" and fails the whole listing.
 */
export function hasRealHours(listing: ListingInput): boolean {
  const hours = listing.hours;
  if (!hours) return false;
  for (const day of DAYS) {
    const h = hours[day];
    if (!h) return false; // missing day entirely
    if (h.closed === true) continue; // legitimately closed -> valid
    if (h.open && h.close) continue; // real open/close times
    return false; // {closed:false} stub with no times
  }
  return true;
}

/**
 * Verification recency: full marks (40) within the last 30 days, linear decay
 * to 0 at 12 months (365 days), 0 beyond 12 months or if the field is
 * missing/null/unparseable.
 */
export function recencyScore(listing: ListingInput, now: Date = new Date()): number {
  const v = listing.audit?.lastVerifiedDate;
  if (!v) return 0;
  const t = Date.parse(v);
  if (Number.isNaN(t)) return 0;
  const days = (now.getTime() - t) / MS_PER_DAY;
  if (days <= 30) return 40;
  if (days >= 365) return 0;
  return 40 * (1 - (days - 30) / (365 - 30));
}

/** Compute the full 0-100 confidence score + breakdown for one listing. */
export function computeListingConfidence(listing: ListingInput, now: Date = new Date()): ConfidenceScore {
  const recency = recencyScore(listing, now);
  const verified = listing.editorial?.verified ? 20 : 0;
  const hours = hasRealHours(listing) ? 10 : 0;
  const photos = (listing.media?.photos?.length ?? 0) > 0 ? 10 : 0;
  const contact = listing.contact?.phone && listing.contact?.website ? 10 : 0;
  const address =
    listing.location?.address && listing.location?.city && listing.location?.state && listing.location?.postalCode
      ? 10
      : 0;
  const total = Math.round(recency + verified + hours + photos + contact + address);
  return { total, recency: Math.round(recency), verified, hours, photos, contact, address };
}

/**
 * Returns the sources of any scrape-marker hits in the listing description
 * (empty array if clean). Does not modify the listing — for manual review only.
 */
export function detectScrapedContent(listing: ListingInput): string[] {
  const desc = listing.description ?? '';
  const hits: string[] = [];
  for (const m of SCRAPE_MARKERS) {
    if (m.test(desc)) hits.push(m.source);
  }
  return hits;
}

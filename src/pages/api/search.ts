import type { APIRoute } from 'astro';
import listingsData from '../../data/listings.json';
import zipCentroids from '../../data/zip-centroids.json';
import { haversineMi, lookupZip, type LatLng } from '../../lib/geo';
import { computeListingConfidence } from '../../lib/confidence-score';
import { citySlugFor } from '../../lib/cities';

// On-demand Cloudflare Worker function (not prerendered): the response depends
// on the request's query string, so it cannot be built statically.
export const prerender = false;

/**
 * GET /api/search?zip=78702&radius=25&amenity=cold-plunge
 *     /api/search?lat=30.27&lng=-97.74&radius=25
 *
 * Ranks all active listings by great-circle distance from a zip-centroid (or
 * explicit lat/lng) origin and returns the nearest 30, capped to the radius
 * when at least 3 fall inside it. Server-side: the zip-centroid table (33k
 * zips) and the listing catalogue are bundled into the worker, so no extra
 * Cloudflare bindings are needed.
 */

// amenity URL slug -> listings.json amenities boolean key
const AMENITY_KEY: Record<string, string> = {
  'cold-plunge': 'coldPlunge',
  'infrared-sauna': 'infraredSauna',
  'traditional-sauna': 'traditionalSauna',
  'contrast-therapy': 'contrastTherapyMarketed',
};

const ALL_AMENITIES = Object.keys(AMENITY_KEY);

const json = (obj: unknown, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'public, max-age=3600',
    },
  });

type AnyListing = {
  slug: string;
  name: string;
  description?: string | null;
  status: string;
  location: {
    city: string;
    state: string;
    neighborhood?: string | null;
    coordinates?: { lat: number; lng: number } | null;
  };
  amenities: Record<string, boolean>;
  pricing?: { dropInPriceNote?: string | null; membershipAvailable?: boolean } | null;
  contact?: { website?: string | null } | null;
  editorial?: { rating?: number | null; reviewCount?: number | null; verified?: boolean; featured?: boolean } | null;
};

export const GET: APIRoute = ({ url }) => {
  const p = url.searchParams;
  const zip = (p.get('zip') || '').trim();
  const latRaw = p.get('lat');
  const lngRaw = p.get('lng');
  const radius = Math.min(150, Math.max(1, Number(p.get('radius')) || 25));
  const amenity = (p.get('amenity') || '').trim();

  // resolve origin: zip centroid first, then explicit lat/lng
  let origin: LatLng | null = null;
  if (zip) {
    origin = lookupZip(zip, zipCentroids as Record<string, LatLng>);
  } else if (latRaw && lngRaw) {
    const la = Number(latRaw);
    const ln = Number(lngRaw);
    if (Number.isFinite(la) && Number.isFinite(ln)) origin = [la, ln];
  }
  if (!origin) {
    return json(
      { error: 'Could not resolve a location. Send a valid 5-digit US zip, or lat + lng.' },
      400,
    );
  }

  const amenityKey = AMENITY_KEY[amenity]; // undefined -> no amenity filter (graceful)

  const all = (listingsData as { listings: AnyListing[] }).listings;
  const results = all
    .filter((l) => l.status === 'active')
    .filter((l) => !amenityKey || !!l.amenities?.[amenityKey])
    .filter(
      (l) =>
        l.location?.coordinates &&
        Number.isFinite(l.location.coordinates.lat) &&
        Number.isFinite(l.location.coordinates.lng),
    )
    .map((l) => {
      const c = l.location.coordinates!;
      const distanceMi = Math.round(haversineMi(origin!, [c.lat, c.lng]) * 10) / 10;
      const services: string[] = [];
      if (l.amenities.coldPlunge) services.push('cold-plunge');
      if (l.amenities.infraredSauna) services.push('infrared-sauna');
      if (l.amenities.traditionalSauna) services.push('traditional-sauna');
      if (l.amenities.contrastTherapyMarketed) services.push('contrast-therapy');
      const citySlug = citySlugFor(l.location.city);
      return {
        name: l.name,
        blurb: l.description
          ? l.description.length > 157
            ? l.description.slice(0, 157) + '\u2026'
            : l.description
          : null,
        slug: l.slug,
        city: l.location.city,
        state: l.location.state,
        neighborhood: l.location.neighborhood ?? null,
        services,
        priceNote: l.pricing?.dropInPriceNote ?? null,
        membershipAvailable: !!l.pricing?.membershipAvailable,
        rating: l.editorial?.rating ?? null,
        reviews: l.editorial?.reviewCount ?? null,
        verified: !!l.editorial?.verified,
        featured: !!l.editorial?.featured,
        confidence: computeListingConfidence(l as never).total,
        website: l.contact?.website ?? null,
        url: citySlug ? `/${citySlug}/${l.slug}` : null,
        lat: c.lat,
        lng: c.lng,
        distanceMi,
      };
    })
    .sort((a, b) => a.distanceMi - b.distanceMi);

  const within = results.filter((r) => r.distanceMi <= radius);
  // If the radius yields a healthy set, return those; otherwise return the
  // nearest overall so rural zips still get useful results.
  const listings = within.length >= 3 ? within.slice(0, 30) : results.slice(0, 30);

  return json({
    origin: { zip: zip || null, lat: origin[0], lng: origin[1] },
    radiusMi: radius,
    withinRadius: within.length,
    total: results.length,
    count: listings.length,
    amenities: ALL_AMENITIES,
    listings,
  });
};

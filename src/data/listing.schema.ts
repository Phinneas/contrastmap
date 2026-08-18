/**
 * ContrastMap Listing Schema
 * -----------------------------------------------------------------------------
 * The core data model for every facility listing in the directory.
 * Designed to be storage-agnostic: works as JSON files today, migrates
 * to a relational DB or D1 later without structural changes.
 *
 * Schema version: 1.0.0
 */

export type ListingStatus = 'draft' | 'active' | 'pending' | 'inactive';
export type ListingSource = 'manual' | 'csv' | 'api' | 'owner-submission' | 'seed';
export type PriceRangeTier = 1 | 2 | 3 | 4; // $, $$, $$$, $$$$

export interface DayHours {
  /** 24h format "06:00", or omitted if closed / by-appointment */
  open?: string;
  close?: string;
  closed: boolean;
}

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface ListingLocation {
  address: string;
  address2?: string;
  city: string;
  state: string; // 2-letter US state code, e.g. "TX"
  postalCode: string;
  country: string; // ISO 3166-1 alpha-2, e.g. "US"
  coordinates: Coordinates;
  neighborhood?: string;
}

/**
 * Amenity flags. The four required booleans are the core filter surface.
 * Additional flags capture services already present in the seed data and
 * are extensible: add new boolean keys here without breaking older records.
 */
export interface ListingAmenities {
  // --- Required core flags ---
  coldPlunge: boolean;
  infraredSauna: boolean;
  traditionalSauna: boolean;
  contrastTherapyMarketed: boolean; // Do they explicitly market "contrast therapy"?

  // --- Extended flags (optional, default false) ---
  redLightTherapy?: boolean;
  compressionTherapy?: boolean;
  floatTank?: boolean;
  vitaminCShower?: boolean;
  hbot?: boolean; // Hyperbaric oxygen
  ivTherapy?: boolean;
  cryotherapy?: boolean;
  pemf?: boolean;
  coldPlungeCurrented?: boolean; // Has a current/jet system (vs passive ice bath)
}

export interface ListingPricing {
  priceRange: PriceRangeTier;
  dropInPrice?: number; // Starting drop-in price in USD
  dropInPriceNote?: string; // e.g., "$29 communal hour / $49 private suite"
  membershipAvailable: boolean;
  membershipPrice?: number; // Monthly price in USD
  membershipPriceNote?: string;
}

export interface ListingContact {
  phone?: string; // E.164 format, e.g. "+15125551234"
  website?: string;
  bookingUrl?: string; // Direct booking/scheduling link
  email?: string;
  instagram?: string;
  facebook?: string;
}

export interface ListingHours {
  monday: DayHours;
  tuesday: DayHours;
  wednesday: DayHours;
  thursday: DayHours;
  friday: DayHours;
  saturday: DayHours;
  sunday: DayHours;
}

export interface ListingMedia {
  photos: string[]; // Ordered array of photo URLs
  logo?: string;
}

export interface ListingEditorial {
  rating?: number; // Aggregate rating, 0-5
  reviewCount?: number;
  featured: boolean; // Paid featured placement
  sponsored: boolean; // Sponsored (shop/gear context, rarely used for facilities)
  verified: boolean; // ContrastMap staff has verified the listing
}

export interface ListingOwnership {
  claimed: boolean;
  claimedBy?: string; // User ID of the claimant
  claimedDate?: string; // ISO 8601 date
  claimMethod?: 'domain-email' | 'phone' | 'google-business' | 'manual-review';
}

export interface ListingAudit {
  addedDate: string; // ISO 8601 date
  addedBy: string; // User ID or "system"
  source: ListingSource;
  lastVerifiedDate: string; // ISO 8601 date
  lastVerifiedBy?: string;
  lastModifiedDate: string; // ISO 8601 date
  lastModifiedBy?: string;
}

export interface Listing {
  // --- Identity ---
  id: string; // UUID v4
  slug: string; // URL-safe, unique, e.g. "contrast-austin-tx"
  name: string;
  description: string; // 1-2 sentence blurb

  // --- Lifecycle ---
  status: ListingStatus;

  // --- Location ---
  location: ListingLocation;

  // --- Amenities ---
  amenities: ListingAmenities;

  // --- Pricing ---
  pricing: ListingPricing;

  // --- Contact ---
  contact: ListingContact;

  // --- Hours ---
  hours: ListingHours;

  // --- Media ---
  media: ListingMedia;

  // --- Editorial ---
  editorial: ListingEditorial;

  // --- Ownership ---
  ownership: ListingOwnership;

  // --- Audit ---
  audit: ListingAudit;
}

/**
 * A suggested edit submitted by a site visitor or owner.
 * Goes into a review queue; does not modify the listing directly.
 */
export interface SuggestedEdit {
  id: string;
  listingId: string;
  submittedBy: string; // User ID or "anonymous"
  submittedDate: string;
  field: string; // Dotted path, e.g. "pricing.dropInPrice"
  currentValue: unknown;
  proposedValue: unknown;
  note?: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewedBy?: string;
  reviewedDate?: string;
}

/**
 * Verification log entry. Each verification event appends a record.
 */
export interface VerificationLog {
  id: string;
  listingId: string;
  verifiedDate: string;
  verifiedBy: string; // User ID or "system-automated"
  method: 'curator-visit' | 'curator-website-check' | 'owner-self-verify' | 'automated-link-check';
  notes?: string;
  fieldsChecked: string[]; // e.g. ["hours", "pricing", "amenities"]
}

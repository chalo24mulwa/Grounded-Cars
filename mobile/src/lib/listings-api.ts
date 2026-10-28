import { apiFetch } from '@/lib/api-client';

// Mirrors the shape of prisma/schema.prisma's CarListing + CarImage, as
// actually returned by src/server/services/listing-service.ts's
// getPublicListings/getPublicListingBySlug (full row, no `select` applied,
// plus a computed `isFeatured`). Decimal fields (price) serialize to
// strings over JSON — see Prisma's Decimal#toJSON.
export type Classification = 'GROUNDED' | 'SALVAGE' | 'AUCTION' | 'OLD_SCHOOL';
export type VehicleCategory = 'CARS' | 'SUV_TRUCKS' | 'LORRIES_BUSES' | 'EV_CARS' | 'EV_BIKES';

export type ListingImage = {
  id: string;
  imageUrl: string;
  displayOrder: number;
  isPrimary: boolean;
  altText: string | null;
};

export type Listing = {
  id: string;
  sellerId: string;
  slug: string;
  title: string;
  make: string;
  model: string;
  year: number;
  price: string;
  currency: string;
  mileage: number | null;
  transmission: string | null;
  fuelType: string | null;
  engineSize: string | null;
  bodyType: string | null;
  color: string | null;
  location: string | null;
  description: string | null;
  condition: string | null;
  classifications: Classification[];
  category: VehicleCategory;
  status: 'DRAFT' | 'PENDING' | 'ACTIVE' | 'SOLD' | 'ARCHIVED';
  viewCount: number;
  images: ListingImage[];
  isFeatured: boolean;
  createdAt: string;
  /** Only present on the single-listing detail fetch (getListingBySlug), not the search/list endpoint. */
  seller?: { id: string; name: string; phone: string | null };
};

export type ListingSearchFilters = Partial<{
  q: string;
  make: string;
  model: string;
  minPrice: number;
  maxPrice: number;
  minYear: number;
  maxYear: number;
  classifications: Classification[];
  category: VehicleCategory;
  location: string;
  sort: 'featured' | 'newest' | 'oldest' | 'price_asc' | 'price_desc' | 'year_desc' | 'mileage_asc';
  page: number;
}>;

export type ListingSearchResult = {
  listings: Listing[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
};

function buildQueryString(filters: ListingSearchFilters): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value == null || value === '') continue;
    if (Array.isArray(value)) {
      for (const v of value) params.append(key, String(v));
    } else {
      params.set(key, String(value));
    }
  }
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export function getListings(filters: ListingSearchFilters = {}): Promise<ListingSearchResult> {
  return apiFetch<ListingSearchResult>(`/api/mobile/listings${buildQueryString(filters)}`, { skipAuth: true });
}

export function getListingBySlug(slug: string): Promise<Listing> {
  return apiFetch<Listing>(`/api/mobile/listings/${encodeURIComponent(slug)}`, { skipAuth: true });
}

export function getRelatedListings(slug: string): Promise<Listing[]> {
  return apiFetch<Listing[]>(`/api/mobile/listings/${encodeURIComponent(slug)}/related`, { skipAuth: true });
}

export function getMakes(): Promise<{ make: string; models: string[] }[]> {
  return apiFetch(`/api/mobile/makes`, { skipAuth: true });
}

export function getLocations(): Promise<string[]> {
  return apiFetch(`/api/mobile/locations`, { skipAuth: true });
}

export function getCategories(): Promise<{
  counts: { category: VehicleCategory; count: number }[];
  labels: Record<VehicleCategory, string>;
  classifications: Classification[];
}> {
  return apiFetch(`/api/mobile/categories`, { skipAuth: true });
}

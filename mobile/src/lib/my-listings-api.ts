import { apiFetch, apiUpload } from '@/lib/api-client';
import type { Classification, Listing, ListingImage, VehicleCategory } from '@/lib/listings-api';

export type Transmission = 'MANUAL' | 'AUTOMATIC' | 'CVT' | 'SEMI_AUTOMATIC';
export type FuelType = 'PETROL' | 'DIESEL' | 'HYBRID' | 'ELECTRIC' | 'LPG';
export type Condition = 'BRAND_NEW' | 'FOREIGN_USED' | 'LOCALLY_USED';

// Same shape createListingSchema (server) validates — every field optional
// here only in the TS sense that a partial update omits it; the server is
// the single source of truth for what's actually required.
export type ListingFormInput = {
  title: string;
  make: string;
  model: string;
  year: number;
  price: number;
  mileage?: number;
  transmission?: Transmission;
  fuelType?: FuelType;
  engineSize?: string;
  bodyType?: string;
  color?: string;
  location?: string;
  description?: string;
  condition?: Condition;
  classifications: Classification[];
  category: VehicleCategory;
};

export type MyListing = Listing & { rejectionReason?: string | null };

export type SellerStats = {
  total: number;
  active: number;
  sold: number;
  draft: number;
  pending: number;
  views: number;
};

export function getMyListings(): Promise<MyListing[]> {
  return apiFetch('/api/mobile/my/listings');
}

export function getMyListingStats(): Promise<SellerStats> {
  return apiFetch('/api/mobile/my/listings/stats');
}

export function getMyListingForEdit(id: string): Promise<MyListing> {
  return apiFetch(`/api/mobile/my/listings/${id}`);
}

export function createMyListing(input: ListingFormInput): Promise<Listing> {
  return apiFetch('/api/mobile/my/listings', { method: 'POST', body: input });
}

export function updateMyListing(id: string, input: Partial<ListingFormInput>): Promise<Listing> {
  return apiFetch(`/api/mobile/my/listings/${id}`, { method: 'PATCH', body: input });
}

export function submitListingForReview(id: string): Promise<Listing> {
  return apiFetch(`/api/mobile/my/listings/${id}/submit`, { method: 'POST' });
}

export function archiveListing(id: string): Promise<Listing> {
  return apiFetch(`/api/mobile/my/listings/${id}/archive`, { method: 'POST' });
}

export function restoreListingToDraft(id: string): Promise<Listing> {
  return apiFetch(`/api/mobile/my/listings/${id}/restore-draft`, { method: 'POST' });
}

export function markListingAsSold(id: string): Promise<Listing> {
  return apiFetch(`/api/mobile/my/listings/${id}/mark-sold`, { method: 'POST' });
}

export function restoreListingToActive(id: string): Promise<Listing> {
  return apiFetch(`/api/mobile/my/listings/${id}/restore-active`, { method: 'POST' });
}

/** `photos` are React Native image-picker assets — see the RN FormData file
 * shape (`{ uri, name, type }`), different from a web `File`. */
export function uploadListingImages(
  id: string,
  photos: { uri: string; name: string; type: string }[]
): Promise<void> {
  const formData = new FormData();
  for (const photo of photos) {
    // React Native's fetch implementation accepts this object shape in
    // place of a web File/Blob — it reads the local file at `uri` itself.
    formData.append('files', photo as unknown as Blob);
  }
  return apiUpload(`/api/mobile/my/listings/${id}/images`, formData);
}

export function deleteListingImage(id: string, imageId: string): Promise<void> {
  return apiFetch(`/api/mobile/my/listings/${id}/images/${imageId}`, { method: 'DELETE' });
}

export function reorderListingImages(id: string, imageIds: string[]): Promise<void> {
  return apiFetch(`/api/mobile/my/listings/${id}/images/reorder`, { method: 'PATCH', body: { imageIds } });
}

export function setPrimaryListingImage(id: string, imageId: string): Promise<void> {
  return apiFetch(`/api/mobile/my/listings/${id}/images/${imageId}/primary`, { method: 'POST' });
}

export type { ListingImage };

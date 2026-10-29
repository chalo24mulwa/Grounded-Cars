import { apiFetch } from '@/lib/api-client';
import type { Listing } from '@/lib/listings-api';

export type Favorite = {
  id: string;
  listingId: string;
  createdAt: string;
  listing: Listing;
};

export function getMyFavorites(): Promise<Favorite[]> {
  return apiFetch('/api/mobile/favorites');
}

export function addFavorite(listingId: string): Promise<void> {
  return apiFetch(`/api/mobile/favorites/${listingId}`, { method: 'POST' });
}

export function removeFavorite(listingId: string): Promise<void> {
  return apiFetch(`/api/mobile/favorites/${listingId}`, { method: 'DELETE' });
}

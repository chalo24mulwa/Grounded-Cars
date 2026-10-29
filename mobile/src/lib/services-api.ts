import { apiFetch, ApiError } from '@/lib/api-client';

// Mirrors SERVICE_PAGE_OPTIONS in service-schema.ts — the five fixed
// website service pages (car-insurance is its own separate Insurance
// feature, not part of this catalog).
export const SERVICE_PAGES = [
  { slug: 'pre-purchase-inspection', label: 'Pre-Purchase Inspection' },
  { slug: 'car-financing', label: 'Car Financing' },
  { slug: 'car-valuation', label: 'Car Valuation' },
  { slug: 'car-tracking', label: 'Car Tracking' },
  { slug: 'home-repairs', label: 'Home Repairs' },
] as const;

export type ServiceListing = {
  id: string;
  slug: string;
  title: string;
  description: string;
  price: string;
  published: boolean;
  images: { id: string; imageUrl: string }[];
};

export function getService(slug: string): Promise<ServiceListing | null> {
  return apiFetch<ServiceListing>(`/api/mobile/services/${slug}`, { skipAuth: true }).catch((err) => {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  });
}

export function orderService(input: {
  serviceId: string;
  customerPhone: string;
  customerName?: string;
  customerEmail?: string;
  couponCode?: string;
}): Promise<{ orderId: string; free: boolean }> {
  return apiFetch('/api/mobile/services/order', { method: 'POST', body: input, skipAuth: true });
}

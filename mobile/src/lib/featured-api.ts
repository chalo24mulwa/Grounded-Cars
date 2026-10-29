import { apiFetch } from '@/lib/api-client';

export type FeaturedPlan = {
  id: string;
  name: string;
  durationDays: number;
  price: string;
  currency: string;
  active: boolean;
};

export type FeaturedSubscriptionStatus = 'PENDING' | 'ACTIVE' | 'EXPIRED' | 'CANCELLED' | 'PAYMENT_FAILED';

export type FeaturedSubscription = {
  id: string;
  status: FeaturedSubscriptionStatus;
  startedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  plan: FeaturedPlan;
  listing: { id: string; title: string; slug: string; status: string };
  payments: { id: string; status: 'PENDING' | 'SUCCESS' | 'FAILED'; amount: string; currency: string; initiatedAt: string }[];
};

export function getFeaturedPlans(): Promise<FeaturedPlan[]> {
  return apiFetch('/api/mobile/featured/plans', { skipAuth: true });
}

export function startFeatureSubscription(input: {
  listingId: string;
  planId: string;
  phoneNumber: string;
  couponCode?: string;
}): Promise<{ subscriptionId: string; paymentId: string; free: boolean }> {
  return apiFetch('/api/mobile/featured/start', { method: 'POST', body: input });
}

export function getMyFeaturedSubscriptions(): Promise<FeaturedSubscription[]> {
  return apiFetch('/api/mobile/my/featured-subscriptions');
}

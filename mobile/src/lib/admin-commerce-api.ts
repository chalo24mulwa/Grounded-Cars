import { apiFetch } from '@/lib/api-client';

// ----------------------------------------------------------------------------
// Admin commerce back-office: coupons, featured plans, subscriptions.
// Same thin-client convention as my-listings-api.ts — every function here
// maps 1:1 to a /api/mobile/admin/** route, which itself is a thin wrapper
// over an existing ADMIN-only src/server/services/*.ts function.
// ----------------------------------------------------------------------------

export type Coupon = {
  id: string;
  code: string;
  discountPercent: number;
  usageLimitPerUser: number;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CouponRedemption = {
  id: string;
  couponId: string;
  userId: string | null;
  scope: 'FEATURED_LISTING' | 'SERVICE_ORDER';
  discountPercent: number;
  originalAmount: string;
  discountedAmount: string;
  createdAt: string;
};

export type CouponRedemptionsResult = {
  coupon: Coupon;
  redemptions: CouponRedemption[];
  totalDiscountGiven: number;
  redemptionCount: number;
};

// createCouponSchema/updateCouponSchema (coupon-schema.ts) require
// discountPercent/usageLimitPerUser as STRINGS (pre-transform z.input
// shape) — the caller must String() these before sending.
export type CouponFormInput = {
  code: string;
  discountPercent: string;
  usageLimitPerUser: string;
};

export function getCoupons(): Promise<Coupon[]> {
  return apiFetch('/api/mobile/admin/coupons');
}

export function getArchivedCoupons(): Promise<Coupon[]> {
  return apiFetch('/api/mobile/admin/coupons/archived');
}

export function getCoupon(id: string): Promise<Coupon> {
  return apiFetch(`/api/mobile/admin/coupons/${id}`);
}

export function createCoupon(input: CouponFormInput): Promise<Coupon> {
  return apiFetch('/api/mobile/admin/coupons', { method: 'POST', body: input });
}

export function updateCoupon(id: string, input: CouponFormInput): Promise<Coupon> {
  return apiFetch(`/api/mobile/admin/coupons/${id}`, { method: 'PATCH', body: input });
}

export function archiveCoupon(id: string): Promise<Coupon> {
  return apiFetch(`/api/mobile/admin/coupons/${id}/archive`, { method: 'POST' });
}

export function unarchiveCoupon(id: string): Promise<Coupon> {
  return apiFetch(`/api/mobile/admin/coupons/${id}/unarchive`, { method: 'POST' });
}

export function getCouponRedemptions(id: string): Promise<CouponRedemptionsResult> {
  return apiFetch(`/api/mobile/admin/coupons/${id}/redemptions`);
}

export type FeaturedPlan = {
  id: string;
  name: string;
  durationDays: number;
  price: string;
  currency: string;
  active: boolean;
  createdAt: string;
};

export function getPlans(): Promise<FeaturedPlan[]> {
  return apiFetch('/api/mobile/admin/plans');
}

export function createPlan(input: { name: string; durationDays: number; price: number; currency: string }): Promise<FeaturedPlan> {
  return apiFetch('/api/mobile/admin/plans', { method: 'POST', body: input });
}

export function setPlanActive(id: string, active: boolean): Promise<FeaturedPlan> {
  return apiFetch(`/api/mobile/admin/plans/${id}/toggle`, { method: 'POST', body: { active } });
}

export type SubscriptionStatus = 'PENDING' | 'ACTIVE' | 'EXPIRED' | 'CANCELLED' | 'PAYMENT_FAILED';

export type AdminSubscription = {
  id: string;
  status: SubscriptionStatus;
  createdAt: string;
  startedAt: string | null;
  expiresAt: string | null;
  plan: FeaturedPlan;
  user: { id: string; name: string; email: string };
  listing: { id: string; title: string; slug: string; status: string };
  payments: { id: string; status: 'PENDING' | 'SUCCESS' | 'FAILED'; amount: string; currency: string; initiatedAt: string }[];
};

export type AdminSubscriptionsResult = {
  subscriptions: AdminSubscription[];
  totalCount: number;
  totalPages: number;
  page: number;
};

export function getSubscriptions(params: { status?: SubscriptionStatus; page?: number } = {}): Promise<AdminSubscriptionsResult> {
  const qs = new URLSearchParams();
  if (params.status) qs.set('status', params.status);
  if (params.page) qs.set('page', String(params.page));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return apiFetch(`/api/mobile/admin/subscriptions${suffix}`);
}

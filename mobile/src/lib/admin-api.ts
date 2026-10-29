import { apiFetch } from '@/lib/api-client';
import type { Listing, ListingImage } from '@/lib/listings-api';

// ----------------------------------------------------------------------------
// Admin/Moderator back-office: moderation queue, listings browser, users,
// sellers directory, moderators, audit log. Every function here is a thin
// wrapper over /api/mobile/admin/** — same role checks the website's own
// admin-service.ts already enforces server-side (ADMIN vs ADMIN+MODERATOR
// per function, not re-checked client-side).
// ----------------------------------------------------------------------------

export type UserRole = 'BUYER' | 'SELLER' | 'ADMIN' | 'MODERATOR';
export type UserStatus = 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED';
export type ListingStatus = 'DRAFT' | 'PENDING' | 'ACTIVE' | 'SOLD' | 'ARCHIVED';

export type ModerationListing = Listing & {
  images: ListingImage[];
  seller: { id: string; name: string; email: string };
};

export function getReviewQueue(): Promise<ModerationListing[]> {
  return apiFetch('/api/mobile/admin/review-queue');
}

export type AdminListingsResult = {
  listings: ModerationListing[];
  totalCount: number;
  totalPages: number;
  page: number;
};

export function getAllListingsForAdmin(filters: { status?: ListingStatus; page?: number } = {}): Promise<AdminListingsResult> {
  const params = new URLSearchParams();
  if (filters.status) params.set('status', filters.status);
  if (filters.page) params.set('page', String(filters.page));
  const qs = params.toString();
  return apiFetch(`/api/mobile/admin/listings${qs ? `?${qs}` : ''}`);
}

export function approveListing(id: string): Promise<Listing> {
  return apiFetch(`/api/mobile/admin/listings/${id}/approve`, { method: 'POST' });
}

export function rejectListing(id: string, reason: string): Promise<Listing> {
  return apiFetch(`/api/mobile/admin/listings/${id}/reject`, { method: 'POST', body: { reason } });
}

export function adminArchiveListing(id: string, reason: string): Promise<Listing> {
  return apiFetch(`/api/mobile/admin/listings/${id}/admin-archive`, { method: 'POST', body: { reason } });
}

export function deleteListingPermanently(id: string): Promise<{ id: string; title: string; filesRemoved: number }> {
  return apiFetch(`/api/mobile/admin/listings/${id}`, { method: 'DELETE' });
}

export type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
  _count: { listings: number };
};

export type AdminUsersResult = { users: AdminUser[]; totalCount: number; totalPages: number; page: number };

export function getUsersForAdmin(
  filters: { role?: UserRole; status?: UserStatus; q?: string; page?: number } = {}
): Promise<AdminUsersResult> {
  const params = new URLSearchParams();
  if (filters.role) params.set('role', filters.role);
  if (filters.status) params.set('status', filters.status);
  if (filters.q) params.set('q', filters.q);
  if (filters.page) params.set('page', String(filters.page));
  const qs = params.toString();
  return apiFetch(`/api/mobile/admin/users${qs ? `?${qs}` : ''}`);
}

export function setUserStatus(id: string, status: UserStatus, reason?: string): Promise<AdminUser> {
  return apiFetch(`/api/mobile/admin/users/${id}/status`, { method: 'POST', body: { status, reason } });
}

export type Seller = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  createdAt: string;
  _count: { listings: number };
};

export function getSellersForModerator(): Promise<Seller[]> {
  return apiFetch('/api/mobile/admin/sellers');
}

export type Moderator = {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  _count: { listings: number };
};

export function getModerators(): Promise<Moderator[]> {
  return apiFetch('/api/mobile/admin/moderators');
}

export function createModerator(input: { name: string; email: string; password: string; phone?: string }): Promise<Moderator> {
  return apiFetch('/api/mobile/admin/moderators', { method: 'POST', body: input });
}

export function deleteModerator(id: string): Promise<void> {
  return apiFetch(`/api/mobile/admin/moderators/${id}`, { method: 'DELETE' });
}

export type AuditLogEntry = {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  createdAt: string;
  actor: { name: string; email: string } | null;
};

export type AuditLogResult = { entries: AuditLogEntry[]; totalCount: number; totalPages: number; page: number };

export function getAuditLog(filters: { page?: number; pageSize?: number } = {}): Promise<AuditLogResult> {
  const params = new URLSearchParams();
  if (filters.page) params.set('page', String(filters.page));
  if (filters.pageSize) params.set('pageSize', String(filters.pageSize));
  const qs = params.toString();
  return apiFetch(`/api/mobile/admin/audit-log${qs ? `?${qs}` : ''}`);
}

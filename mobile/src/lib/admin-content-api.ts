import { apiFetch, apiUpload, apiUploadWithMethod } from '@/lib/api-client';

// Admin content-management API client: CSR initiatives, Events, Services
// catalog, and Insurance policies. Every endpoint here requires ADMIN (role
// checks happen server-side inside each service function — see
// src/app/api/mobile/admin/**/route.ts), and mirrors the website's own
// admin pages' create/edit/publish/archive/gallery actions one-for-one.

/** RN image-picker asset shape (uri/name/type), same convention as
 * my-listings-api.ts's uploadListingImages. */
export type PickedImage = { uri: string; name: string; type: string };

function appendImage(formData: FormData, field: string, image: PickedImage | undefined) {
  if (image) formData.append(field, image as unknown as Blob);
}

// ---------------------------------------------------------------------------
// CSR initiatives
// ---------------------------------------------------------------------------

export type CsrStatus = 'ACTIVE' | 'COMPLETED';

export type CsrInitiativeImage = { id: string; imageUrl: string; displayOrder: number };

export type CsrInitiativeAdmin = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  story: string;
  targetAmount: string;
  amountRaised: string;
  currency: string;
  status: CsrStatus;
  published: boolean;
  coverImageUrl: string | null;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
  images?: CsrInitiativeImage[];
};

export type CsrInitiativeFormInput = {
  title: string;
  summary: string;
  story: string;
  targetAmount: string;
  startDate?: string;
  endDate?: string;
};

export function getAllCsrInitiativesAdmin(page = 1): Promise<{
  initiatives: CsrInitiativeAdmin[];
  totalCount: number;
  totalPages: number;
  page: number;
}> {
  return apiFetch(`/api/mobile/admin/csr?page=${page}`);
}

export function getCsrInitiativeAdmin(id: string): Promise<CsrInitiativeAdmin> {
  return apiFetch(`/api/mobile/admin/csr/${id}`);
}

function csrFormData(input: CsrInitiativeFormInput, cover?: PickedImage): FormData {
  const formData = new FormData();
  formData.append('title', input.title);
  formData.append('summary', input.summary);
  formData.append('story', input.story);
  formData.append('targetAmount', input.targetAmount);
  if (input.startDate) formData.append('startDate', input.startDate);
  if (input.endDate) formData.append('endDate', input.endDate);
  appendImage(formData, 'cover', cover);
  return formData;
}

export function createCsrInitiativeAdmin(input: CsrInitiativeFormInput, cover?: PickedImage): Promise<CsrInitiativeAdmin> {
  return apiUpload('/api/mobile/admin/csr', csrFormData(input, cover));
}

export function updateCsrInitiativeAdmin(
  id: string,
  input: CsrInitiativeFormInput,
  cover?: PickedImage
): Promise<CsrInitiativeAdmin> {
  return apiUploadWithMethod(`/api/mobile/admin/csr/${id}`, csrFormData(input, cover), 'PATCH');
}

export function setCsrInitiativePublishedAdmin(id: string, published: boolean): Promise<CsrInitiativeAdmin> {
  return apiFetch(`/api/mobile/admin/csr/${id}/publish`, { method: 'POST', body: { published } });
}

export function setCsrInitiativeStatusAdmin(id: string, status: CsrStatus): Promise<CsrInitiativeAdmin> {
  return apiFetch(`/api/mobile/admin/csr/${id}/status`, { method: 'POST', body: { status } });
}

export function addCsrInitiativeImageAdmin(id: string, image: PickedImage): Promise<CsrInitiativeImage> {
  const formData = new FormData();
  formData.append('file', image as unknown as Blob);
  return apiUpload(`/api/mobile/admin/csr/${id}/images`, formData);
}

export function removeCsrInitiativeImageAdmin(id: string, imageId: string): Promise<void> {
  return apiFetch(`/api/mobile/admin/csr/${id}/images/${imageId}`, { method: 'DELETE' });
}

export type CsrDonation = {
  id: string;
  donorName: string | null;
  donorPhone: string;
  amount: string;
  status: 'PENDING' | 'SUCCESS' | 'FAILED';
  initiatedAt: string;
};

export function getCsrDonationsAdmin(id: string): Promise<{
  initiative: CsrInitiativeAdmin;
  donations: CsrDonation[];
  totalRaised: number;
  donationCount: number;
}> {
  return apiFetch(`/api/mobile/admin/csr/${id}/donations`);
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

export type EventAdmin = {
  id: string;
  title: string;
  description: string;
  location: string | null;
  eventDate: string | null;
  imageUrl: string | null;
  published: boolean;
  createdAt: string;
};

export type EventFormInput = {
  title: string;
  description: string;
  location?: string;
  eventDate?: string;
  eventTime?: string;
};

export function getAllEventsAdmin(page = 1): Promise<{
  events: EventAdmin[];
  totalCount: number;
  totalPages: number;
  page: number;
}> {
  return apiFetch(`/api/mobile/admin/events?page=${page}`);
}

export function getEventAdmin(id: string): Promise<EventAdmin> {
  return apiFetch(`/api/mobile/admin/events/${id}`);
}

function eventFormData(input: EventFormInput, image?: PickedImage): FormData {
  const formData = new FormData();
  formData.append('title', input.title);
  formData.append('description', input.description);
  if (input.location) formData.append('location', input.location);
  if (input.eventDate) formData.append('eventDate', input.eventDate);
  if (input.eventTime) formData.append('eventTime', input.eventTime);
  appendImage(formData, 'image', image);
  return formData;
}

export function createEventAdmin(input: EventFormInput, image?: PickedImage): Promise<EventAdmin> {
  return apiUpload('/api/mobile/admin/events', eventFormData(input, image));
}

export function updateEventAdmin(id: string, input: EventFormInput, image?: PickedImage): Promise<EventAdmin> {
  return apiUploadWithMethod(`/api/mobile/admin/events/${id}`, eventFormData(input, image), 'PATCH');
}

export function setEventPublishedAdmin(id: string, published: boolean): Promise<EventAdmin> {
  return apiFetch(`/api/mobile/admin/events/${id}/publish`, { method: 'POST', body: { published } });
}

// ---------------------------------------------------------------------------
// Services catalog (the 5 fixed /services/* pages)
// ---------------------------------------------------------------------------

export const SERVICE_PAGE_OPTIONS = [
  { slug: 'pre-purchase-inspection', label: 'Pre-Purchase Inspection' },
  { slug: 'car-financing', label: 'Car Financing' },
  { slug: 'car-valuation', label: 'Car Valuation' },
  { slug: 'car-tracking', label: 'Car Tracking' },
  { slug: 'home-repairs', label: 'Home Repairs' },
] as const;

export type ServiceSlug = (typeof SERVICE_PAGE_OPTIONS)[number]['slug'];

export type ServiceImage = { id: string; imageUrl: string; displayOrder: number };

export type ServiceAdmin = {
  id: string;
  slug: string;
  title: string;
  description: string;
  price: string;
  currency: string;
  published: boolean;
  createdAt: string;
  images?: ServiceImage[];
};

export function getAllServicesAdmin(): Promise<ServiceAdmin[]> {
  return apiFetch('/api/mobile/admin/services');
}

export function getServiceAdmin(id: string): Promise<ServiceAdmin> {
  return apiFetch(`/api/mobile/admin/services/${id}`);
}

// price is sent as a STRING — createServiceSchema/updateServiceSchema use a
// raw-form-string-to-number transform, same convention as coupons/CSR.
export function createServiceAdmin(input: { slug: ServiceSlug; title: string; description: string; price: string }): Promise<ServiceAdmin> {
  return apiFetch('/api/mobile/admin/services', { method: 'POST', body: input });
}

export function updateServiceAdmin(
  id: string,
  input: { title: string; description: string; price: string }
): Promise<ServiceAdmin> {
  return apiFetch(`/api/mobile/admin/services/${id}`, { method: 'PATCH', body: input });
}

export function setServicePublishedAdmin(id: string, published: boolean): Promise<ServiceAdmin> {
  return apiFetch(`/api/mobile/admin/services/${id}/publish`, { method: 'POST', body: { published } });
}

export function addServiceImageAdmin(id: string, image: PickedImage): Promise<ServiceImage> {
  const formData = new FormData();
  formData.append('file', image as unknown as Blob);
  return apiUpload(`/api/mobile/admin/services/${id}/images`, formData);
}

export function removeServiceImageAdmin(id: string, imageId: string): Promise<void> {
  return apiFetch(`/api/mobile/admin/services/${id}/images/${imageId}`, { method: 'DELETE' });
}

export type ServiceOrder = {
  id: string;
  customerName: string | null;
  customerPhone: string;
  amount: string;
  status: 'PENDING' | 'SUCCESS' | 'FAILED';
  initiatedAt: string;
};

export function getServiceOrdersAdmin(id: string): Promise<{
  service: ServiceAdmin;
  orders: ServiceOrder[];
  totalRevenue: number;
  orderCount: number;
}> {
  return apiFetch(`/api/mobile/admin/services/${id}/orders`);
}

// ---------------------------------------------------------------------------
// Insurance policies
// ---------------------------------------------------------------------------

export type InsurancePolicyAdmin = {
  id: string;
  title: string;
  description: string;
  startingPrice: string;
  currency: string;
  imageUrl: string | null;
  published: boolean;
  archived: boolean;
  createdAt: string;
};

export type InsurancePolicyFormInput = { title: string; description: string; startingPrice: string };

export function getAllInsurancePoliciesAdmin(page = 1): Promise<{
  policies: InsurancePolicyAdmin[];
  totalCount: number;
  totalPages: number;
  page: number;
}> {
  return apiFetch(`/api/mobile/admin/insurance?page=${page}`);
}

export function getArchivedInsurancePoliciesAdmin(): Promise<InsurancePolicyAdmin[]> {
  return apiFetch('/api/mobile/admin/insurance/archived');
}

export function getInsurancePolicyAdmin(id: string): Promise<InsurancePolicyAdmin> {
  return apiFetch(`/api/mobile/admin/insurance/${id}`);
}

function insuranceFormData(input: InsurancePolicyFormInput, image?: PickedImage): FormData {
  const formData = new FormData();
  formData.append('title', input.title);
  formData.append('description', input.description);
  formData.append('startingPrice', input.startingPrice);
  appendImage(formData, 'image', image);
  return formData;
}

export function createInsurancePolicyAdmin(input: InsurancePolicyFormInput, image?: PickedImage): Promise<InsurancePolicyAdmin> {
  return apiUpload('/api/mobile/admin/insurance', insuranceFormData(input, image));
}

export function updateInsurancePolicyAdmin(
  id: string,
  input: InsurancePolicyFormInput,
  image?: PickedImage
): Promise<InsurancePolicyAdmin> {
  return apiUploadWithMethod(`/api/mobile/admin/insurance/${id}`, insuranceFormData(input, image), 'PATCH');
}

export function setInsurancePolicyPublishedAdmin(id: string, published: boolean): Promise<InsurancePolicyAdmin> {
  return apiFetch(`/api/mobile/admin/insurance/${id}/publish`, { method: 'POST', body: { published } });
}

export function archiveInsurancePolicyAdmin(id: string): Promise<InsurancePolicyAdmin> {
  return apiFetch(`/api/mobile/admin/insurance/${id}/archive`, { method: 'POST' });
}

export function unarchiveInsurancePolicyAdmin(id: string): Promise<InsurancePolicyAdmin> {
  return apiFetch(`/api/mobile/admin/insurance/${id}/unarchive`, { method: 'POST' });
}

export type InsurancePurchase = {
  id: string;
  customerName: string | null;
  customerPhone: string;
  amount: string;
  status: 'PENDING' | 'SUCCESS' | 'FAILED';
  initiatedAt: string;
};

export function getInsurancePurchasesAdmin(id: string): Promise<{
  policy: InsurancePolicyAdmin;
  purchases: InsurancePurchase[];
  totalRevenue: number;
  purchaseCount: number;
}> {
  return apiFetch(`/api/mobile/admin/insurance/${id}/purchases`);
}

import { apiFetch } from '@/lib/api-client';

export type InquiryStatus = 'NEW' | 'READ' | 'REPLIED' | 'CLOSED';

export type Inquiry = {
  id: string;
  listingId: string;
  name: string;
  email: string;
  phone: string | null;
  message: string;
  status: InquiryStatus;
  createdAt: string;
  listing: { id: string; title: string; slug: string; status: string };
};

export function sendInquiry(input: { listingId: string; message: string }): Promise<void> {
  return apiFetch('/api/mobile/inquiries', { method: 'POST', body: input });
}

export function getMyReceivedInquiries(): Promise<Inquiry[]> {
  return apiFetch('/api/mobile/my/inquiries');
}

export function updateInquiryStatus(id: string, status: InquiryStatus): Promise<Inquiry> {
  return apiFetch(`/api/mobile/my/inquiries/${id}`, { method: 'PATCH', body: { status } });
}

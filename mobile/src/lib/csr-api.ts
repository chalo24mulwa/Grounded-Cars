import { apiFetch } from '@/lib/api-client';

export type CsrInitiative = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  story: string;
  targetAmount: string;
  amountRaised: string;
  startDate: string | null;
  endDate: string | null;
  status: 'ACTIVE' | 'COMPLETED';
  published: boolean;
  coverImageUrl: string | null;
  images: { id: string; imageUrl: string }[];
};

export function getCsrInitiatives(): Promise<CsrInitiative[]> {
  return apiFetch('/api/mobile/csr', { skipAuth: true });
}

export function getCsrInitiative(slug: string): Promise<CsrInitiative> {
  return apiFetch(`/api/mobile/csr/${slug}`, { skipAuth: true });
}

export function donateToCsrInitiative(input: {
  initiativeId: string;
  amount: number;
  donorPhone: string;
  donorName?: string;
  donorEmail?: string;
}): Promise<{ donationId: string }> {
  return apiFetch('/api/mobile/csr/donate', { method: 'POST', body: input, skipAuth: true });
}

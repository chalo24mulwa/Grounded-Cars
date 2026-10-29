import { apiFetch } from '@/lib/api-client';

export type InsurancePolicy = {
  id: string;
  title: string;
  description: string;
  startingPrice: string;
  imageUrl: string | null;
  published: boolean;
};

export function getInsurancePolicies(): Promise<InsurancePolicy[]> {
  return apiFetch('/api/mobile/insurance', { skipAuth: true });
}

export function getInsurancePolicy(id: string): Promise<InsurancePolicy> {
  return apiFetch(`/api/mobile/insurance/${id}`, { skipAuth: true });
}

export function purchaseInsurancePolicy(input: {
  policyId: string;
  customerPhone: string;
  customerName?: string;
  customerEmail?: string;
}): Promise<{ purchaseId: string }> {
  return apiFetch('/api/mobile/insurance/purchase', { method: 'POST', body: input, skipAuth: true });
}

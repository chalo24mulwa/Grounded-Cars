import { apiFetch } from '@/lib/api-client';
import type { AccessTokenPayload } from '@/lib/jwt';

export type Profile = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: AccessTokenPayload['role'];
  status: 'ACTIVE' | 'SUSPENDED';
  createdAt: string;
};

export function getProfile(): Promise<Profile> {
  return apiFetch('/api/mobile/account/me');
}

export function updateProfile(input: { name: string; phone?: string }): Promise<Profile> {
  return apiFetch('/api/mobile/account/me', { method: 'PATCH', body: input });
}

export function changePassword(input: {
  currentPassword: string;
  newPassword: string;
  confirmNewPassword: string;
}): Promise<void> {
  return apiFetch('/api/mobile/account/change-password', { method: 'POST', body: input });
}

export function becomeSeller(): Promise<{ id: string; role: string }> {
  return apiFetch('/api/mobile/account/become-seller', { method: 'POST' });
}

export function requestPasswordReset(email: string): Promise<void> {
  return apiFetch('/api/mobile/auth/password-reset/request', {
    method: 'POST',
    body: { email },
    skipAuth: true,
  });
}

export function confirmPasswordReset(input: {
  token: string;
  newPassword: string;
  confirmNewPassword: string;
}): Promise<void> {
  return apiFetch('/api/mobile/auth/password-reset/confirm', {
    method: 'POST',
    body: input,
    skipAuth: true,
  });
}

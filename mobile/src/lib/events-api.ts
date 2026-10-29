import { apiFetch } from '@/lib/api-client';

export type MobileEvent = {
  id: string;
  title: string;
  description: string;
  location: string | null;
  eventDate: string | null;
  imageUrl: string | null;
  published: boolean;
  createdAt: string;
};

export function getEvents(): Promise<MobileEvent[]> {
  return apiFetch('/api/mobile/events', { skipAuth: true });
}

export function getEvent(id: string): Promise<MobileEvent> {
  return apiFetch(`/api/mobile/events/${id}`, { skipAuth: true });
}

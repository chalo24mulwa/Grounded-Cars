import { Redirect, Stack } from 'expo-router';
import { useAuth } from '@/lib/auth-context';

// Entry gate for the whole admin/moderator back-office: ADMIN or MODERATOR
// only. Individual screens still get their own 403 from the backend for
// ADMIN-only actions a MODERATOR attempts (e.g. coupons, users) — this
// layout only keeps BUYER/SELLER accounts out, same as my-listings/_layout.tsx
// does for the seller dashboard.
export default function AdminLayout() {
  const { status, user } = useAuth();

  if (status === 'unauthenticated') return <Redirect href="/login" />;
  if (status === 'authenticated' && user && user.role !== 'ADMIN' && user.role !== 'MODERATOR') {
    return <Redirect href="/" />;
  }

  return <Stack screenOptions={{ headerShown: true }} />;
}

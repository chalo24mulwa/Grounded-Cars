import { Redirect, Stack } from 'expo-router';
import { useAuth } from '@/lib/auth-context';

// Same role gate as the website's (seller) route group — a signed-out
// visitor goes to login, a signed-in BUYER (who hasn't become a seller yet)
// goes home rather than seeing an empty/broken seller dashboard.
export default function MyListingsLayout() {
  const { status, user } = useAuth();

  if (status === 'unauthenticated') return <Redirect href="/login" />;
  if (status === 'authenticated' && user && user.role === 'BUYER') return <Redirect href="/" />;

  return <Stack screenOptions={{ headerShown: true }} />;
}

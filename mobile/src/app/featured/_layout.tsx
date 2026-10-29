import { Redirect, Stack } from 'expo-router';
import { useAuth } from '@/lib/auth-context';

export default function FeaturedLayout() {
  const { status, user } = useAuth();

  if (status === 'unauthenticated') return <Redirect href="/login" />;
  if (status === 'authenticated' && user && user.role === 'BUYER') return <Redirect href="/" />;

  return <Stack screenOptions={{ headerShown: true }} />;
}

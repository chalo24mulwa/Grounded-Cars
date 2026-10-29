import { useEffect } from 'react';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/query-client';
import { AuthProvider, useAuth } from '@/lib/auth-context';

SplashScreen.preventAutoHideAsync();

// Waits for AuthProvider's silent-refresh-on-boot attempt (see
// auth-context.tsx) to settle before revealing any route — otherwise the
// (auth) and (tabs) group guards below would redirect to the login screen
// for a split second on every cold start, even for an already-logged-in
// user, while the stored refresh token is still being exchanged.
function AppContent() {
  const { status } = useAuth();

  useEffect(() => {
    if (status !== 'loading') void SplashScreen.hideAsync();
  }, [status]);

  if (status === 'loading') return null;
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="listing/[slug]" options={{ headerShown: true, title: 'Listing' }} />
      <Stack.Screen name="contact" options={{ headerShown: true, title: 'Contact Us' }} />
      <Stack.Screen name="account/edit" options={{ headerShown: true, title: 'Edit Account' }} />
      <Stack.Screen name="favorites" options={{ headerShown: true, title: 'Favorites' }} />
      <Stack.Screen name="events/index" options={{ headerShown: true, title: 'Events' }} />
      <Stack.Screen name="events/[id]" options={{ headerShown: true, title: 'Event' }} />
      <Stack.Screen name="csr/index" options={{ headerShown: true, title: 'CSR Initiatives' }} />
      <Stack.Screen name="csr/[slug]" options={{ headerShown: true, title: 'Initiative' }} />
      <Stack.Screen name="services/index" options={{ headerShown: true, title: 'Services' }} />
      <Stack.Screen name="services/[slug]" options={{ headerShown: true, title: 'Service' }} />
      <Stack.Screen name="insurance/index" options={{ headerShown: true, title: 'Insurance' }} />
      <Stack.Screen name="insurance/[id]" options={{ headerShown: true, title: 'Policy' }} />
    </Stack>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

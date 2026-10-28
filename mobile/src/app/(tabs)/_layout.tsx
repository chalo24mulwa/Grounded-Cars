import { Tabs } from 'expo-router';
import { useTheme } from '@/hooks/use-theme';

// Browse/search/listing-detail are public, same as the website's /cars —
// anonymous visitors must be able to shop without an account. Only the
// Account tab (and, later, My Listings/Add Car) requires being signed in;
// see account.tsx's own unauthenticated prompt rather than a blanket
// redirect here.
export default function TabsLayout() {
  const theme = useTheme();

  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: theme.brand }}>
      <Tabs.Screen name="index" options={{ title: 'Browse' }} />
      <Tabs.Screen name="account" options={{ title: 'Account' }} />
    </Tabs>
  );
}

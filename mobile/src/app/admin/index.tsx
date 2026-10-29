import { Pressable, ScrollView, StyleSheet } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth-context';
import { Spacing } from '@/constants/theme';

type MenuItem = { label: string; path: string; adminOnly?: boolean };

const SECTIONS: { title: string; items: MenuItem[] }[] = [
  {
    title: 'Moderation',
    items: [
      { label: 'Listing review queue', path: '/admin/review-listings' },
      { label: 'Sellers directory', path: '/admin/sellers' },
    ],
  },
  {
    title: 'People',
    items: [
      { label: 'Users', path: '/admin/users', adminOnly: true },
      { label: 'Moderators', path: '/admin/moderators', adminOnly: true },
      { label: 'Audit log', path: '/admin/audit-log', adminOnly: true },
    ],
  },
  {
    title: 'Commerce',
    items: [
      { label: 'Coupons', path: '/admin/coupons', adminOnly: true },
      { label: 'Featured plans', path: '/admin/plans', adminOnly: true },
      { label: 'Subscriptions', path: '/admin/subscriptions', adminOnly: true },
    ],
  },
  {
    title: 'Content',
    items: [
      { label: 'CSR initiatives', path: '/admin/csr', adminOnly: true },
      { label: 'Events', path: '/admin/events', adminOnly: true },
      { label: 'Services catalog', path: '/admin/services', adminOnly: true },
      { label: 'Insurance policies', path: '/admin/insurance', adminOnly: true },
    ],
  },
];

export default function AdminHomeScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  return (
    <ThemedView style={{ flex: 1 }}>
      <Stack.Screen options={{ title: 'Admin' }} />
      <ScrollView contentContainerStyle={styles.container}>
        {SECTIONS.map((section) => {
          const items = section.items.filter((item) => !item.adminOnly || isAdmin);
          if (items.length === 0) return null;
          return (
            <ThemedView key={section.title} style={styles.section}>
              <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionTitle}>
                {section.title.toUpperCase()}
              </ThemedText>
              {items.map((item) => (
                <Pressable
                  key={item.path}
                  onPress={() => router.push(item.path as never)}
                  style={[styles.row, { borderColor: theme.backgroundSelected, backgroundColor: theme.backgroundElement }]}
                >
                  <ThemedText>{item.label}</ThemedText>
                  <ThemedText themeColor="textSecondary">{'›'}</ThemedText>
                </Pressable>
              ))}
            </ThemedView>
          );
        })}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { padding: Spacing.four },
  section: { marginBottom: Spacing.five },
  sectionTitle: { marginBottom: Spacing.two },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
    marginBottom: Spacing.two,
  },
});

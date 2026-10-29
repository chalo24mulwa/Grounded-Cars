import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/constants/theme';
import { getAllServicesAdmin, SERVICE_PAGE_OPTIONS } from '@/lib/admin-content-api';

// Services attach to one of 5 fixed /services/* pages — this screen is a
// fixed 5-row list (not a FlatList of arbitrary records), each row either
// showing the existing catalog entry or an "add" prompt for that page.
export default function AdminServicesListScreen() {
  const theme = useTheme();
  const router = useRouter();

  const { data: services, isLoading, error } = useQuery({
    queryKey: ['admin-services'],
    queryFn: getAllServicesAdmin,
  });

  return (
    <ThemedView style={{ flex: 1 }}>
      <Stack.Screen options={{ title: 'Services Catalog' }} />
      {isLoading ? (
        <ActivityIndicator style={styles.spinner} color={theme.brand} />
      ) : error ? (
        <ThemedText style={styles.error}>Failed to load services.</ThemedText>
      ) : (
        <ScrollView contentContainerStyle={styles.container}>
          {SERVICE_PAGE_OPTIONS.map((option) => {
            const existing = services?.find((s) => s.slug === option.slug);
            return (
              <Pressable
                key={option.slug}
                onPress={() =>
                  existing ? router.push(`/admin/services/${existing.id}`) : router.push(`/admin/services/new?slug=${option.slug}`)
                }
                style={[styles.row, { borderColor: theme.backgroundSelected, backgroundColor: theme.backgroundElement }]}
              >
                <View style={{ flex: 1 }}>
                  <ThemedText type="smallBold">{option.label}</ThemedText>
                  <ThemedText themeColor="textSecondary" type="small">
                    {existing ? existing.title : 'Not created yet'}
                  </ThemedText>
                </View>
                {existing ? (
                  <View style={[styles.badge, { backgroundColor: existing.published ? '#2E7D4F' : '#94A3B8' }]}>
                    <ThemedText style={styles.badgeText}>{existing.published ? 'Published' : 'Draft'}</ThemedText>
                  </View>
                ) : (
                  <ThemedText themeColor="brand">+ Create</ThemedText>
                )}
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { padding: Spacing.three },
  spinner: { marginTop: Spacing.six },
  error: { textAlign: 'center', marginTop: Spacing.six, color: '#D14343' },
  row: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 10, padding: Spacing.three, marginBottom: Spacing.two, gap: Spacing.two },
  badge: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  badgeText: { color: '#fff', fontSize: 9, fontWeight: '700' },
});

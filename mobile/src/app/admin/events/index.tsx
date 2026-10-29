import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/constants/theme';
import { getAllEventsAdmin } from '@/lib/admin-content-api';

export default function AdminEventsListScreen() {
  const theme = useTheme();
  const router = useRouter();

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['admin-events'],
    queryFn: () => getAllEventsAdmin(1),
  });

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: 'Events' }} />
      <Pressable style={[styles.addButton, { backgroundColor: theme.brand }]} onPress={() => router.push('/admin/events/new')}>
        <ThemedText style={styles.addButtonText}>+ New Event</ThemedText>
      </Pressable>

      {isLoading ? (
        <ActivityIndicator style={styles.spinner} color={theme.brand} />
      ) : error ? (
        <ThemedText style={styles.error}>Failed to load events.</ThemedText>
      ) : (
        <FlatList
          data={data?.events ?? []}
          keyExtractor={(item) => item.id}
          refreshing={isFetching}
          onRefresh={refetch}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<ThemedText style={styles.empty}>No events yet.</ThemedText>}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push(`/admin/events/${item.id}`)}
              style={[styles.row, { borderColor: theme.backgroundSelected, backgroundColor: theme.backgroundElement }]}
            >
              <View style={{ flex: 1 }}>
                <ThemedText type="smallBold" numberOfLines={1}>
                  {item.title}
                </ThemedText>
                <ThemedText themeColor="textSecondary" type="small">
                  {item.eventDate ? new Date(item.eventDate).toLocaleDateString() : 'No date set'}
                  {item.location ? ` · ${item.location}` : ''}
                </ThemedText>
              </View>
              <View style={[styles.badge, { backgroundColor: item.published ? '#2E7D4F' : '#94A3B8' }]}>
                <ThemedText style={styles.badgeText}>{item.published ? 'Published' : 'Draft'}</ThemedText>
              </View>
            </Pressable>
          )}
        />
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: Spacing.three, paddingTop: Spacing.three },
  addButton: { borderRadius: 10, paddingVertical: Spacing.three, alignItems: 'center', marginBottom: Spacing.three },
  addButtonText: { color: '#fff', fontWeight: '700' },
  spinner: { marginTop: Spacing.six },
  error: { textAlign: 'center', marginTop: Spacing.six, color: '#D14343' },
  empty: { textAlign: 'center', marginTop: Spacing.six },
  list: { paddingBottom: Spacing.six },
  row: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 10, padding: Spacing.three, marginBottom: Spacing.two, gap: Spacing.two },
  badge: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  badgeText: { color: '#fff', fontSize: 9, fontWeight: '700' },
});

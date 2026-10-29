import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/constants/theme';
import { getAllCsrInitiativesAdmin } from '@/lib/admin-content-api';

export default function AdminCsrListScreen() {
  const theme = useTheme();
  const router = useRouter();

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['admin-csr'],
    queryFn: () => getAllCsrInitiativesAdmin(1),
  });

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: 'CSR Initiatives' }} />
      <Pressable style={[styles.addButton, { backgroundColor: theme.brand }]} onPress={() => router.push('/admin/csr/new')}>
        <ThemedText style={styles.addButtonText}>+ New Initiative</ThemedText>
      </Pressable>

      {isLoading ? (
        <ActivityIndicator style={styles.spinner} color={theme.brand} />
      ) : error ? (
        <ThemedText style={styles.error}>Failed to load initiatives.</ThemedText>
      ) : (
        <FlatList
          data={data?.initiatives ?? []}
          keyExtractor={(item) => item.id}
          refreshing={isFetching}
          onRefresh={refetch}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<ThemedText style={styles.empty}>No CSR initiatives yet.</ThemedText>}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push(`/admin/csr/${item.id}`)}
              style={[styles.row, { borderColor: theme.backgroundSelected, backgroundColor: theme.backgroundElement }]}
            >
              <View style={{ flex: 1 }}>
                <ThemedText type="smallBold" numberOfLines={1}>
                  {item.title}
                </ThemedText>
                <ThemedText themeColor="textSecondary" type="small">
                  {item.currency} {Math.round(Number(item.amountRaised)).toLocaleString()} / {Math.round(Number(item.targetAmount)).toLocaleString()}
                </ThemedText>
              </View>
              <View style={styles.badges}>
                <View style={[styles.badge, { backgroundColor: item.status === 'ACTIVE' ? theme.brand : '#64748B' }]}>
                  <ThemedText style={styles.badgeText}>{item.status}</ThemedText>
                </View>
                <View style={[styles.badge, { backgroundColor: item.published ? '#2E7D4F' : '#94A3B8' }]}>
                  <ThemedText style={styles.badgeText}>{item.published ? 'Published' : 'Draft'}</ThemedText>
                </View>
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
  badges: { gap: 4, alignItems: 'flex-end' },
  badge: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  badgeText: { color: '#fff', fontSize: 9, fontWeight: '700' },
});

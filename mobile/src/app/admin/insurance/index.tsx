import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/constants/theme';
import { getAllInsurancePoliciesAdmin, getArchivedInsurancePoliciesAdmin } from '@/lib/admin-content-api';

export default function AdminInsuranceListScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [showArchived, setShowArchived] = useState(false);

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: showArchived ? ['admin-insurance-archived'] : ['admin-insurance'],
    queryFn: () => (showArchived ? getArchivedInsurancePoliciesAdmin() : getAllInsurancePoliciesAdmin(1).then((r) => r.policies)),
  });

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: 'Insurance Policies' }} />
      <View style={styles.headerRow}>
        <Pressable style={[styles.addButton, { backgroundColor: theme.brand }]} onPress={() => router.push('/admin/insurance/new')}>
          <ThemedText style={styles.addButtonText}>+ New Policy</ThemedText>
        </Pressable>
        <Pressable style={[styles.archiveToggle, { borderColor: theme.brand }]} onPress={() => setShowArchived((v) => !v)}>
          <ThemedText themeColor="brand" type="small">
            {showArchived ? 'Show active' : 'Show archived'}
          </ThemedText>
        </Pressable>
      </View>

      {isLoading ? (
        <ActivityIndicator style={styles.spinner} color={theme.brand} />
      ) : error ? (
        <ThemedText style={styles.error}>Failed to load policies.</ThemedText>
      ) : (
        <FlatList
          data={data ?? []}
          keyExtractor={(item) => item.id}
          refreshing={isFetching}
          onRefresh={refetch}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<ThemedText style={styles.empty}>{showArchived ? 'No archived policies.' : 'No policies yet.'}</ThemedText>}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push(`/admin/insurance/${item.id}`)}
              style={[styles.row, { borderColor: theme.backgroundSelected, backgroundColor: theme.backgroundElement }]}
            >
              <View style={{ flex: 1 }}>
                <ThemedText type="smallBold" numberOfLines={1}>
                  {item.title}
                </ThemedText>
                <ThemedText themeColor="textSecondary" type="small">
                  From {item.currency} {Math.round(Number(item.startingPrice)).toLocaleString()}
                </ThemedText>
              </View>
              <View style={[styles.badge, { backgroundColor: item.published ? '#2E7D4F' : '#94A3B8' }]}>
                <ThemedText style={styles.badgeText}>{item.archived ? 'Archived' : item.published ? 'Published' : 'Draft'}</ThemedText>
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
  headerRow: { flexDirection: 'row', gap: Spacing.two, marginBottom: Spacing.three },
  addButton: { flex: 1, borderRadius: 10, paddingVertical: Spacing.three, alignItems: 'center' },
  addButtonText: { color: '#fff', fontWeight: '700' },
  archiveToggle: { borderWidth: 1, borderRadius: 10, paddingVertical: Spacing.three, paddingHorizontal: Spacing.three, justifyContent: 'center' },
  spinner: { marginTop: Spacing.six },
  error: { textAlign: 'center', marginTop: Spacing.six, color: '#D14343' },
  empty: { textAlign: 'center', marginTop: Spacing.six },
  list: { paddingBottom: Spacing.six },
  row: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 10, padding: Spacing.three, marginBottom: Spacing.two, gap: Spacing.two },
  badge: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  badgeText: { color: '#fff', fontSize: 9, fontWeight: '700' },
});

import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { Stack } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/constants/theme';
import { getAuditLog } from '@/lib/admin-api';

// ADMIN only, read-only, append-only feed — newest first.
export default function AdminAuditLogScreen() {
  const theme = useTheme();
  const [page, setPage] = useState(1);
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['admin-audit-log', page],
    queryFn: () => getAuditLog({ page }),
  });

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: 'Audit Log' }} />
      {isLoading ? (
        <ActivityIndicator style={styles.spinner} color={theme.brand} />
      ) : error ? (
        <ThemedText style={styles.error}>{error instanceof Error ? error.message : 'Failed to load the audit log.'}</ThemedText>
      ) : (
        <FlatList
          data={data?.entries ?? []}
          keyExtractor={(item) => item.id}
          refreshing={isFetching}
          onRefresh={refetch}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<ThemedText style={styles.empty}>No audit entries yet.</ThemedText>}
          renderItem={({ item }) => (
            <View style={[styles.card, { borderColor: theme.backgroundSelected, backgroundColor: theme.backgroundElement }]}>
              <ThemedText type="smallBold">{item.action.replace(/_/g, ' ')}</ThemedText>
              <ThemedText themeColor="textSecondary" type="small">
                {item.actor ? `${item.actor.name} (${item.actor.email})` : 'System'} · {item.entityType}
              </ThemedText>
              <ThemedText themeColor="textSecondary" type="small">
                {new Date(item.createdAt).toLocaleString()}
              </ThemedText>
            </View>
          )}
          ListFooterComponent={
            data && data.totalPages > page ? (
              <Pressable style={[styles.loadMore, { borderColor: theme.brand }]} onPress={() => setPage((p) => p + 1)}>
                <ThemedText themeColor="brand">Load more</ThemedText>
              </Pressable>
            ) : undefined
          }
        />
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: Spacing.three, paddingTop: Spacing.three },
  spinner: { marginTop: Spacing.six },
  error: { textAlign: 'center', marginTop: Spacing.six, color: '#D14343' },
  empty: { textAlign: 'center', marginTop: Spacing.six },
  list: { paddingBottom: Spacing.six },
  card: { borderWidth: 1, borderRadius: 12, padding: Spacing.three, marginBottom: Spacing.two },
  loadMore: { borderWidth: 1, borderRadius: 10, paddingVertical: Spacing.three, alignItems: 'center', marginTop: Spacing.two },
});

import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { Stack } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/constants/theme';
import { getSubscriptions, type SubscriptionStatus } from '@/lib/admin-commerce-api';

const STATUS_FILTERS: { value: SubscriptionStatus | undefined; label: string }[] = [
  { value: undefined, label: 'All' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'EXPIRED', label: 'Expired' },
  { value: 'CANCELLED', label: 'Cancelled' },
  { value: 'PAYMENT_FAILED', label: 'Payment Failed' },
];

const STATUS_COLORS: Record<SubscriptionStatus, string> = {
  PENDING: '#B45309',
  ACTIVE: '#2E7D4F',
  EXPIRED: '#64748B',
  CANCELLED: '#94A3B8',
  PAYMENT_FAILED: '#D14343',
};

// View-only — no edit/delete action exists for subscriptions anywhere,
// website included (see featured-service.ts: payment records are never
// hand-edited).
export default function SubscriptionsScreen() {
  const theme = useTheme();
  const [status, setStatus] = useState<SubscriptionStatus | undefined>(undefined);
  const [page, setPage] = useState(1);

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-subscriptions', status, page],
    queryFn: () => getSubscriptions({ status, page }),
  });

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: 'Subscriptions' }} />

      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={STATUS_FILTERS}
        keyExtractor={(item) => item.label}
        style={styles.filterRow}
        renderItem={({ item }) => {
          const active = item.value === status;
          return (
            <Pressable
              onPress={() => {
                setStatus(item.value);
                setPage(1);
              }}
              style={[styles.chip, { borderColor: theme.brand }, active && { backgroundColor: theme.brand }]}
            >
              <ThemedText type="small" style={active ? styles.chipTextActive : { color: theme.brand }}>
                {item.label}
              </ThemedText>
            </Pressable>
          );
        }}
      />

      {isLoading ? (
        <ActivityIndicator style={styles.spinner} color={theme.brand} />
      ) : error ? (
        <ThemedText style={styles.error}>{error instanceof Error ? error.message : 'Failed to load subscriptions.'}</ThemedText>
      ) : (
        <FlatList
          data={data?.subscriptions ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<ThemedText style={styles.empty}>No subscriptions found.</ThemedText>}
          renderItem={({ item }) => (
            <View style={[styles.row, { borderColor: theme.backgroundSelected, backgroundColor: theme.backgroundElement }]}>
              <View style={styles.rowTop}>
                <ThemedText type="smallBold" numberOfLines={1} style={{ flex: 1 }}>
                  {item.listing.title}
                </ThemedText>
                <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[item.status] }]}>
                  <ThemedText style={styles.statusText}>{item.status.replace('_', ' ')}</ThemedText>
                </View>
              </View>
              <ThemedText themeColor="textSecondary" type="small">
                {item.user.name} ({item.user.email})
              </ThemedText>
              <ThemedText themeColor="textSecondary" type="small">
                {item.plan.name} · {item.plan.currency} {Number(item.plan.price).toLocaleString()}
              </ThemedText>
              {item.payments[0] ? (
                <ThemedText themeColor="textSecondary" type="small">
                  Last payment: {item.payments[0].status}
                </ThemedText>
              ) : null}
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
  filterRow: { marginBottom: Spacing.three, flexGrow: 0 },
  chip: { borderWidth: 1, borderRadius: 16, paddingHorizontal: Spacing.three, paddingVertical: Spacing.one, marginRight: Spacing.two },
  chipTextActive: { color: '#fff' },
  spinner: { marginTop: Spacing.six },
  error: { textAlign: 'center', marginTop: Spacing.six, color: '#D14343' },
  empty: { textAlign: 'center', marginTop: Spacing.six },
  list: { paddingBottom: Spacing.six },
  row: { borderWidth: 1, borderRadius: 10, padding: Spacing.three, marginBottom: Spacing.two, gap: 2 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  statusBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  statusText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  loadMore: { borderWidth: 1, borderRadius: 10, paddingVertical: Spacing.three, alignItems: 'center', marginTop: Spacing.two },
});

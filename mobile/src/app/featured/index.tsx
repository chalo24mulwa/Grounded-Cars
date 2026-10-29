import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/constants/theme';
import { getMyFeaturedSubscriptions, type FeaturedSubscription, type FeaturedSubscriptionStatus } from '@/lib/featured-api';

const STATUS_LABELS: Record<FeaturedSubscriptionStatus, string> = {
  PENDING: 'Payment pending',
  ACTIVE: 'Active',
  EXPIRED: 'Expired',
  CANCELLED: 'Cancelled',
  PAYMENT_FAILED: 'Payment failed',
};

const STATUS_COLORS: Record<FeaturedSubscriptionStatus, string> = {
  PENDING: '#B45309',
  ACTIVE: '#2E7D4F',
  EXPIRED: '#64748B',
  CANCELLED: '#64748B',
  PAYMENT_FAILED: '#D14343',
};

function formatPrice(price: string, currency: string): string {
  return `${currency} ${Math.round(Number(price)).toLocaleString()}`;
}

// The website has no dedicated payment-status endpoint — it re-fetches the
// whole subscription list every 4s while anything is PENDING (see
// SubscriptionHistory.tsx), relying on the M-Pesa webhook to flip a row to
// ACTIVE/PAYMENT_FAILED in the background. Same approach here via TanStack
// Query's refetchInterval, which is the exact native equivalent.
export default function FeaturedSubscriptionsScreen() {
  const theme = useTheme();
  const router = useRouter();

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['my-featured-subscriptions'],
    queryFn: getMyFeaturedSubscriptions,
    refetchInterval: (query) => (query.state.data?.some((s) => s.status === 'PENDING') ? 4000 : false),
  });

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: 'Featured Listings' }} />

      <Pressable style={[styles.newButton, { backgroundColor: theme.brand }]} onPress={() => router.push('/featured/new')}>
        <ThemedText style={styles.newButtonText}>+ Feature a listing</ThemedText>
      </Pressable>

      {isLoading ? (
        <ActivityIndicator style={styles.spinner} color={theme.brand} />
      ) : error ? (
        <ThemedText style={styles.error}>{error instanceof Error ? error.message : 'Failed to load subscriptions.'}</ThemedText>
      ) : (
        <FlatList
          data={data ?? []}
          keyExtractor={(item) => item.id}
          refreshing={isFetching}
          onRefresh={refetch}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<ThemedText style={styles.empty}>No featured listings yet.</ThemedText>}
          renderItem={({ item }) => <SubscriptionCard subscription={item} />}
        />
      )}
    </ThemedView>
  );
}

function SubscriptionCard({ subscription }: { subscription: FeaturedSubscription }) {
  const theme = useTheme();
  return (
    <View style={[styles.card, { borderColor: theme.backgroundSelected, backgroundColor: theme.backgroundElement }]}>
      <View style={styles.cardTop}>
        <ThemedText type="smallBold" numberOfLines={1} style={{ flex: 1 }}>
          {subscription.listing.title}
        </ThemedText>
        <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[subscription.status] }]}>
          <ThemedText style={styles.statusText}>{STATUS_LABELS[subscription.status]}</ThemedText>
        </View>
      </View>
      <ThemedText themeColor="textSecondary" type="small">
        {subscription.plan.name} · {formatPrice(subscription.plan.price, subscription.plan.currency)}
      </ThemedText>
      {subscription.status === 'ACTIVE' && subscription.expiresAt ? (
        <ThemedText type="small" themeColor="textSecondary">
          Expires {new Date(subscription.expiresAt).toLocaleDateString()}
        </ThemedText>
      ) : null}
      {subscription.status === 'PENDING' ? (
        <ThemedText type="small" style={{ color: '#B45309', marginTop: 2 }}>
          Check your phone to approve the M-Pesa payment — this updates automatically.
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: Spacing.three, paddingTop: Spacing.three },
  newButton: { borderRadius: 10, paddingVertical: Spacing.three, alignItems: 'center', marginBottom: Spacing.three },
  newButtonText: { color: '#fff', fontWeight: '700' },
  spinner: { marginTop: Spacing.six },
  error: { textAlign: 'center', marginTop: Spacing.six, color: '#D14343' },
  empty: { textAlign: 'center', marginTop: Spacing.six },
  list: { paddingBottom: Spacing.six },
  card: { borderWidth: 1, borderRadius: 12, padding: Spacing.three, marginBottom: Spacing.three, gap: 2 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  statusBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  statusText: { color: '#fff', fontSize: 10, fontWeight: '700' },
});

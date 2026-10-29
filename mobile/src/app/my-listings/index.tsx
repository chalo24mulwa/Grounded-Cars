import { useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, Pressable, StyleSheet, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/constants/theme';
import {
  getMyListings,
  submitListingForReview,
  archiveListing,
  restoreListingToDraft,
  markListingAsSold,
  restoreListingToActive,
  type MyListing,
} from '@/lib/my-listings-api';
import { ApiError } from '@/lib/api-client';

const STATUS_LABELS: Record<MyListing['status'], string> = {
  DRAFT: 'Draft',
  PENDING: 'Pending review',
  ACTIVE: 'Active',
  SOLD: 'Sold',
  ARCHIVED: 'Archived',
};

const STATUS_COLORS: Record<MyListing['status'], string> = {
  DRAFT: '#64748B',
  PENDING: '#B45309',
  ACTIVE: '#2E7D4F',
  SOLD: '#475569',
  ARCHIVED: '#94A3B8',
};

function formatPrice(price: string, currency: string): string {
  return `${currency} ${Math.round(Number(price)).toLocaleString()}`;
}

// Same five status-transition actions as SellerListingCard.tsx (the
// website's "My Cars" card) — one button set per status, mirrored exactly
// (minus "Feature this car," which is M-Pesa-backed and out of scope for
// this phase).
export default function MyListingsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [actingOn, setActingOn] = useState<string | null>(null);

  const { data: listings, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['my-listings'],
    queryFn: getMyListings,
  });

  async function runAction(id: string, action: (id: string) => Promise<unknown>) {
    setActingOn(id);
    try {
      await action(id);
      await queryClient.invalidateQueries({ queryKey: ['my-listings'] });
    } catch (err) {
      Alert.alert('Something went wrong', err instanceof ApiError ? err.message : 'Please try again.');
    } finally {
      setActingOn(null);
    }
  }

  function confirmMarkSold(listing: MyListing) {
    Alert.alert(
      'Has this vehicle been sold?',
      'Once marked as sold, buyers will clearly see it is no longer available. You can restore it later if the sale is cancelled.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Yes, mark as sold', onPress: () => runAction(listing.id, markListingAsSold) },
      ]
    );
  }

  function confirmRestoreActive(listing: MyListing) {
    Alert.alert(
      'Restore this listing to active?',
      'This vehicle will be marked available again and shown to buyers. Use this only if the sale fell through.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Yes, restore listing', onPress: () => runAction(listing.id, restoreListingToActive) },
      ]
    );
  }

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: 'My Listings' }} />

      <Pressable style={[styles.addButton, { backgroundColor: theme.brand }]} onPress={() => router.push('/my-listings/new')}>
        <ThemedText style={styles.addButtonText}>+ Add New Car</ThemedText>
      </Pressable>

      {isLoading ? (
        <ActivityIndicator style={styles.spinner} color={theme.brand} />
      ) : error ? (
        <ThemedText style={styles.error}>{error instanceof Error ? error.message : 'Failed to load your listings.'}</ThemedText>
      ) : (
        <FlatList
          data={listings ?? []}
          keyExtractor={(item) => item.id}
          refreshing={isFetching}
          onRefresh={refetch}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<ThemedText style={styles.empty}>You haven&apos;t listed any cars yet.</ThemedText>}
          renderItem={({ item }) => {
            const primaryImage = item.images.find((img) => img.isPrimary) ?? item.images[0];
            const busy = actingOn === item.id;
            return (
              <View style={[styles.card, { borderColor: theme.backgroundSelected, backgroundColor: theme.backgroundElement }]}>
                <View style={styles.cardTop}>
                  {primaryImage ? (
                    <Image source={{ uri: primaryImage.imageUrl }} style={styles.cardImage} resizeMode="cover" />
                  ) : (
                    <View style={[styles.cardImage, { backgroundColor: theme.backgroundSelected }]} />
                  )}
                  <View style={styles.cardInfo}>
                    <ThemedText type="smallBold" numberOfLines={1}>
                      {item.title}
                    </ThemedText>
                    <ThemedText themeColor="textSecondary" type="small">
                      {item.year} · {item.make} {item.model}
                    </ThemedText>
                    <ThemedText themeColor="brand" style={styles.price}>
                      {formatPrice(item.price, item.currency)}
                    </ThemedText>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[item.status] }]}>
                    <ThemedText style={styles.statusText}>{STATUS_LABELS[item.status]}</ThemedText>
                  </View>
                </View>

                {item.rejectionReason ? (
                  <ThemedText style={styles.rejection}>Rejected: {item.rejectionReason}</ThemedText>
                ) : null}

                <View style={styles.actions}>
                  <Pressable
                    style={[styles.actionButton, { borderColor: theme.backgroundSelected }]}
                    onPress={() => router.push(`/my-listings/${item.id}/edit`)}
                  >
                    <ThemedText type="small">Edit</ThemedText>
                  </Pressable>

                  {item.status === 'DRAFT' && (
                    <>
                      <Pressable
                        style={[styles.actionButton, { backgroundColor: theme.brand, borderColor: theme.brand }]}
                        onPress={() => runAction(item.id, submitListingForReview)}
                        disabled={busy}
                      >
                        <ThemedText style={styles.actionButtonTextPrimary}>Submit for review</ThemedText>
                      </Pressable>
                      <Pressable
                        style={[styles.actionButton, { borderColor: theme.backgroundSelected }]}
                        onPress={() => runAction(item.id, archiveListing)}
                        disabled={busy}
                      >
                        <ThemedText type="small">Archive</ThemedText>
                      </Pressable>
                    </>
                  )}

                  {item.status === 'PENDING' && (
                    <ThemedText themeColor="textSecondary" type="small" style={styles.pendingNote}>
                      Awaiting admin approval
                    </ThemedText>
                  )}

                  {item.status === 'ACTIVE' && (
                    <>
                      <Pressable style={[styles.actionButton, { borderColor: theme.backgroundSelected }]} onPress={() => confirmMarkSold(item)} disabled={busy}>
                        <ThemedText type="small">Mark as Sold</ThemedText>
                      </Pressable>
                      <Pressable style={[styles.actionButton, { borderColor: theme.backgroundSelected }]} onPress={() => runAction(item.id, archiveListing)} disabled={busy}>
                        <ThemedText type="small">Archive</ThemedText>
                      </Pressable>
                    </>
                  )}

                  {item.status === 'SOLD' && (
                    <Pressable style={[styles.actionButton, { borderColor: theme.brand }]} onPress={() => confirmRestoreActive(item)} disabled={busy}>
                      <ThemedText themeColor="brand" type="small">
                        Restore to Active
                      </ThemedText>
                    </Pressable>
                  )}

                  {item.status === 'ARCHIVED' && (
                    <Pressable style={[styles.actionButton, { backgroundColor: theme.brand, borderColor: theme.brand }]} onPress={() => runAction(item.id, restoreListingToDraft)} disabled={busy}>
                      <ThemedText style={styles.actionButtonTextPrimary}>Move to Draft</ThemedText>
                    </Pressable>
                  )}

                  {busy ? <ActivityIndicator color={theme.brand} /> : null}
                </View>
              </View>
            );
          }}
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
  card: { borderWidth: 1, borderRadius: 12, padding: Spacing.three, marginBottom: Spacing.three },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  cardImage: { width: 64, height: 64, borderRadius: 8 },
  cardInfo: { flex: 1, gap: 2 },
  price: { fontWeight: '700' },
  statusBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start' },
  statusText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  rejection: { color: '#D14343', marginTop: Spacing.two, fontSize: 13 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, marginTop: Spacing.three, alignItems: 'center' },
  actionButton: { borderWidth: 1, borderRadius: 8, paddingHorizontal: Spacing.three, paddingVertical: Spacing.one + 2 },
  actionButtonTextPrimary: { color: '#fff', fontWeight: '700', fontSize: 13 },
  pendingNote: { fontStyle: 'italic' },
});

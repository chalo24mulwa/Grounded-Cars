import { useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/constants/theme';
import {
  getAllListingsForAdmin,
  adminArchiveListing,
  deleteListingPermanently,
  type ListingStatus,
} from '@/lib/admin-api';
import { ApiError } from '@/lib/api-client';

const STATUS_FILTERS: { value: ListingStatus | undefined; label: string }[] = [
  { value: undefined, label: 'All' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'SOLD', label: 'Sold' },
  { value: 'ARCHIVED', label: 'Archived' },
];

// ADMIN only — every listing regardless of status, distinct from the
// PENDING-only review queue.
export default function AdminListingsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<ListingStatus | undefined>(undefined);
  const [page, setPage] = useState(1);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [archivingId, setArchivingId] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['admin-listings', status, page],
    queryFn: () => getAllListingsForAdmin({ status, page }),
  });

  function invalidate() {
    return queryClient.invalidateQueries({ queryKey: ['admin-listings'] });
  }

  async function onArchiveConfirm(id: string) {
    if (reason.trim().length === 0) {
      Alert.alert('Reason required', 'Please explain why this listing is being archived.');
      return;
    }
    setBusyId(id);
    try {
      await adminArchiveListing(id, reason.trim());
      setArchivingId(null);
      await invalidate();
    } catch (err) {
      Alert.alert('Could not archive', err instanceof ApiError ? err.message : 'Please try again.');
    } finally {
      setBusyId(null);
    }
  }

  function onDeletePermanently(id: string, title: string) {
    Alert.alert(
      'Delete this listing permanently?',
      `"${title}" and every one of its photos will be permanently deleted. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete permanently',
          style: 'destructive',
          onPress: () => {
            Alert.alert('Are you absolutely sure?', 'This is your last chance to cancel.', [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Yes, delete forever',
                style: 'destructive',
                onPress: async () => {
                  setBusyId(id);
                  try {
                    await deleteListingPermanently(id);
                    await invalidate();
                  } catch (err) {
                    Alert.alert('Could not delete', err instanceof ApiError ? err.message : 'Please try again.');
                  } finally {
                    setBusyId(null);
                  }
                },
              },
            ]);
          },
        },
      ]
    );
  }

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: 'All Listings' }} />

      <View style={styles.chipsRow}>
        {STATUS_FILTERS.map(({ value, label }) => {
          const active = status === value;
          return (
            <Pressable
              key={label}
              onPress={() => {
                setStatus(value);
                setPage(1);
              }}
              style={[styles.chip, { borderColor: theme.brand }, active && { backgroundColor: theme.brand }]}
            >
              <ThemedText style={active ? { color: '#fff' } : { color: theme.brand }}>{label}</ThemedText>
            </Pressable>
          );
        })}
      </View>

      {isLoading ? (
        <ActivityIndicator style={styles.spinner} color={theme.brand} />
      ) : error ? (
        <ThemedText style={styles.error}>{error instanceof Error ? error.message : 'Failed to load listings.'}</ThemedText>
      ) : (
        <FlatList
          data={data?.listings ?? []}
          keyExtractor={(item) => item.id}
          refreshing={isFetching}
          onRefresh={refetch}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<ThemedText style={styles.empty}>No listings match this filter.</ThemedText>}
          renderItem={({ item }) => {
            const image = item.images[0];
            const busy = busyId === item.id;
            const isArchiving = archivingId === item.id;
            return (
              <View style={[styles.card, { borderColor: theme.backgroundSelected, backgroundColor: theme.backgroundElement }]}>
                <Pressable style={styles.cardTop} onPress={() => router.push(`/listing/${item.slug}` as never)}>
                  {image ? (
                    <Image source={{ uri: image.imageUrl }} style={styles.cardImage} />
                  ) : (
                    <View style={[styles.cardImage, { backgroundColor: theme.backgroundSelected }]} />
                  )}
                  <View style={styles.cardInfo}>
                    <ThemedText type="smallBold" numberOfLines={1}>{item.title}</ThemedText>
                    <ThemedText themeColor="textSecondary" type="small">{item.status} · {item.seller.name}</ThemedText>
                  </View>
                </Pressable>

                {isArchiving ? (
                  <View style={styles.rejectForm}>
                    <TextInput
                      style={[styles.reasonInput, { color: theme.text, borderColor: theme.backgroundSelected }]}
                      placeholder="Reason for archiving…"
                      placeholderTextColor={theme.textSecondary}
                      value={reason}
                      onChangeText={setReason}
                      multiline
                    />
                    <View style={styles.actions}>
                      <Pressable style={[styles.actionButton, { borderColor: theme.backgroundSelected }]} onPress={() => setArchivingId(null)}>
                        <ThemedText type="small">Cancel</ThemedText>
                      </Pressable>
                      <Pressable style={[styles.actionButton, { backgroundColor: theme.brand, borderColor: theme.brand }]} onPress={() => onArchiveConfirm(item.id)} disabled={busy}>
                        {busy ? <ActivityIndicator color="#fff" /> : <ThemedText style={styles.actionButtonTextPrimary}>Confirm archive</ThemedText>}
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  <View style={styles.actions}>
                    <Pressable
                      style={[styles.actionButton, { borderColor: theme.backgroundSelected }]}
                      onPress={() => {
                        setArchivingId(item.id);
                        setReason('');
                      }}
                      disabled={busy}
                    >
                      <ThemedText type="small">Archive</ThemedText>
                    </Pressable>
                    <Pressable style={[styles.actionButton, { borderColor: '#D14343' }]} onPress={() => onDeletePermanently(item.id, item.title)} disabled={busy}>
                      {busy ? <ActivityIndicator color="#D14343" /> : <ThemedText style={{ color: '#D14343', fontWeight: '700', fontSize: 13 }}>Delete permanently</ThemedText>}
                    </Pressable>
                  </View>
                )}
              </View>
            );
          }}
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
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, marginBottom: Spacing.three },
  chip: { borderWidth: 1, borderRadius: 16, paddingHorizontal: Spacing.three, paddingVertical: Spacing.one },
  spinner: { marginTop: Spacing.six },
  error: { textAlign: 'center', marginTop: Spacing.six, color: '#D14343' },
  empty: { textAlign: 'center', marginTop: Spacing.six },
  list: { paddingBottom: Spacing.six },
  card: { borderWidth: 1, borderRadius: 12, padding: Spacing.three, marginBottom: Spacing.three },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  cardImage: { width: 64, height: 64, borderRadius: 8 },
  cardInfo: { flex: 1, gap: 2 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, marginTop: Spacing.three },
  actionButton: { borderWidth: 1, borderRadius: 8, paddingHorizontal: Spacing.three, paddingVertical: Spacing.one + 2 },
  actionButtonTextPrimary: { color: '#fff', fontWeight: '700', fontSize: 13 },
  rejectForm: { marginTop: Spacing.three },
  reasonInput: { borderWidth: 1, borderRadius: 8, padding: Spacing.two, minHeight: 60, textAlignVertical: 'top', fontSize: 14 },
  loadMore: { borderWidth: 1, borderRadius: 10, paddingVertical: Spacing.three, alignItems: 'center', marginTop: Spacing.two },
});

import { useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/constants/theme';
import { getReviewQueue, approveListing, rejectListing } from '@/lib/admin-api';
import { ApiError } from '@/lib/api-client';

// ADMIN+MODERATOR — PENDING listings awaiting first-publish approval, oldest
// submission first (matches getPendingListingsForModeration's own order).
export default function ReviewListingsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [actingOn, setActingOn] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  const { data: listings, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['admin-review-queue'],
    queryFn: getReviewQueue,
  });

  function invalidate() {
    return queryClient.invalidateQueries({ queryKey: ['admin-review-queue'] });
  }

  async function onApprove(id: string) {
    setActingOn(id);
    try {
      await approveListing(id);
      await invalidate();
    } catch (err) {
      Alert.alert('Could not approve', err instanceof ApiError ? err.message : 'Please try again.');
    } finally {
      setActingOn(null);
    }
  }

  function startReject(id: string) {
    setRejectingId(id);
    setReason('');
  }

  async function confirmReject() {
    if (!rejectingId) return;
    if (reason.trim().length < 10) {
      Alert.alert('Reason too short', 'Please explain why in at least 10 characters.');
      return;
    }
    setActingOn(rejectingId);
    try {
      await rejectListing(rejectingId, reason.trim());
      setRejectingId(null);
      await invalidate();
    } catch (err) {
      Alert.alert('Could not reject', err instanceof ApiError ? err.message : 'Please try again.');
    } finally {
      setActingOn(null);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: 'Review Listings' }} />

      {isLoading ? (
        <ActivityIndicator style={styles.spinner} color={theme.brand} />
      ) : error ? (
        <ThemedText style={styles.error}>{error instanceof Error ? error.message : 'Failed to load the review queue.'}</ThemedText>
      ) : (
        <FlatList
          data={listings ?? []}
          keyExtractor={(item) => item.id}
          refreshing={isFetching}
          onRefresh={refetch}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<ThemedText style={styles.empty}>Nothing waiting for review.</ThemedText>}
          renderItem={({ item }) => {
            const image = item.images[0];
            const busy = actingOn === item.id;
            const isRejecting = rejectingId === item.id;
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
                    <ThemedText themeColor="textSecondary" type="small">{item.seller.name} · {item.seller.email}</ThemedText>
                  </View>
                </Pressable>

                {isRejecting ? (
                  <View style={styles.rejectForm}>
                    <TextInput
                      style={[styles.reasonInput, { color: theme.text, borderColor: theme.backgroundSelected }]}
                      placeholder="Reason for rejection (min 10 characters)…"
                      placeholderTextColor={theme.textSecondary}
                      value={reason}
                      onChangeText={setReason}
                      multiline
                    />
                    <View style={styles.actions}>
                      <Pressable style={[styles.actionButton, { borderColor: theme.backgroundSelected }]} onPress={() => setRejectingId(null)}>
                        <ThemedText type="small">Cancel</ThemedText>
                      </Pressable>
                      <Pressable style={[styles.actionButton, { backgroundColor: '#D14343', borderColor: '#D14343' }]} onPress={confirmReject} disabled={busy}>
                        {busy ? <ActivityIndicator color="#fff" /> : <ThemedText style={styles.actionButtonTextPrimary}>Confirm reject</ThemedText>}
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  <View style={styles.actions}>
                    <Pressable style={[styles.actionButton, { backgroundColor: theme.brand, borderColor: theme.brand }]} onPress={() => onApprove(item.id)} disabled={busy}>
                      {busy ? <ActivityIndicator color="#fff" /> : <ThemedText style={styles.actionButtonTextPrimary}>Approve</ThemedText>}
                    </Pressable>
                    <Pressable style={[styles.actionButton, { borderColor: '#D14343' }]} onPress={() => startReject(item.id)} disabled={busy}>
                      <ThemedText style={{ color: '#D14343', fontWeight: '700', fontSize: 13 }}>Reject</ThemedText>
                    </Pressable>
                  </View>
                )}
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
});

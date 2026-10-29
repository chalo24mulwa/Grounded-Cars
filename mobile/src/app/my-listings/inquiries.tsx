import { ActivityIndicator, FlatList, Linking, Pressable, StyleSheet, View } from 'react-native';
import { Stack } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/constants/theme';
import { getMyReceivedInquiries, updateInquiryStatus, type Inquiry, type InquiryStatus } from '@/lib/inquiries-api';

const STATUS_LABELS: Record<InquiryStatus, string> = {
  NEW: 'New',
  READ: 'Read',
  REPLIED: 'Replied',
  CLOSED: 'Closed',
};

const STATUS_COLORS: Record<InquiryStatus, string> = {
  NEW: '#B45309',
  READ: '#2563EB',
  REPLIED: '#2E7D4F',
  CLOSED: '#64748B',
};

// Same getMyReceivedInquiries()/updateInquiryStatus() the website's
// /dashboard/inquiries page uses.
export default function InquiriesScreen() {
  const theme = useTheme();
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['my-inquiries'],
    queryFn: getMyReceivedInquiries,
  });

  async function markStatus(inquiry: Inquiry, status: InquiryStatus) {
    try {
      await updateInquiryStatus(inquiry.id, status);
      await queryClient.invalidateQueries({ queryKey: ['my-inquiries'] });
    } catch {
      // Best-effort — the list stays as-is and the user can retry.
    }
  }

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: 'Inquiries' }} />
      {isLoading ? (
        <ActivityIndicator style={styles.spinner} color={theme.brand} />
      ) : error ? (
        <ThemedText style={styles.error}>{error instanceof Error ? error.message : 'Failed to load inquiries.'}</ThemedText>
      ) : (
        <FlatList
          data={data ?? []}
          keyExtractor={(item) => item.id}
          refreshing={isFetching}
          onRefresh={refetch}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<ThemedText style={styles.empty}>No inquiries yet.</ThemedText>}
          renderItem={({ item }) => {
            // Opening one marks it read, matching the website's behavior.
            if (item.status === 'NEW') void markStatus(item, 'READ');
            return (
              <View style={[styles.card, { borderColor: theme.backgroundSelected, backgroundColor: theme.backgroundElement }]}>
                <View style={styles.cardTop}>
                  <ThemedText type="smallBold" numberOfLines={1} style={{ flex: 1 }}>
                    {item.listing.title}
                  </ThemedText>
                  <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[item.status] }]}>
                    <ThemedText style={styles.statusText}>{STATUS_LABELS[item.status]}</ThemedText>
                  </View>
                </View>
                <ThemedText themeColor="textSecondary" type="small">
                  {item.name} · {item.email}
                  {item.phone ? ` · ${item.phone}` : ''}
                </ThemedText>
                <ThemedText style={styles.message}>{item.message}</ThemedText>
                <View style={styles.actions}>
                  {item.phone ? (
                    <Pressable style={[styles.actionButton, { backgroundColor: theme.brand, borderColor: theme.brand }]} onPress={() => Linking.openURL(`tel:${item.phone}`)}>
                      <ThemedText style={styles.actionButtonTextPrimary}>Call</ThemedText>
                    </Pressable>
                  ) : null}
                  {item.status !== 'REPLIED' ? (
                    <Pressable style={[styles.actionButton, { borderColor: theme.backgroundSelected }]} onPress={() => markStatus(item, 'REPLIED')}>
                      <ThemedText type="small">Mark replied</ThemedText>
                    </Pressable>
                  ) : null}
                  {item.status !== 'CLOSED' ? (
                    <Pressable style={[styles.actionButton, { borderColor: theme.backgroundSelected }]} onPress={() => markStatus(item, 'CLOSED')}>
                      <ThemedText type="small">Close</ThemedText>
                    </Pressable>
                  ) : null}
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
  spinner: { marginTop: Spacing.six },
  error: { textAlign: 'center', marginTop: Spacing.six, color: '#D14343' },
  empty: { textAlign: 'center', marginTop: Spacing.six },
  list: { paddingBottom: Spacing.six },
  card: { borderWidth: 1, borderRadius: 12, padding: Spacing.three, marginBottom: Spacing.three, gap: 4 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  statusBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  statusText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  message: { marginTop: Spacing.one },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, marginTop: Spacing.two },
  actionButton: { borderWidth: 1, borderRadius: 8, paddingHorizontal: Spacing.three, paddingVertical: Spacing.one + 2 },
  actionButtonTextPrimary: { color: '#fff', fontWeight: '700', fontSize: 13 },
});

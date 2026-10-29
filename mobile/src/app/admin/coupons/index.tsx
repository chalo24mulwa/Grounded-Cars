import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/constants/theme';
import { getCoupons, getArchivedCoupons } from '@/lib/admin-commerce-api';

export default function CouponsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [showArchived, setShowArchived] = useState(false);

  const { data: coupons, isLoading, error } = useQuery({
    queryKey: ['admin-coupons', showArchived],
    queryFn: () => (showArchived ? getArchivedCoupons() : getCoupons()),
  });

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: 'Coupons' }} />

      <View style={styles.tabRow}>
        <Pressable
          onPress={() => setShowArchived(false)}
          style={[styles.tab, { borderColor: theme.brand }, !showArchived && { backgroundColor: theme.brand }]}
        >
          <ThemedText style={!showArchived ? styles.tabTextActive : { color: theme.brand }}>Active</ThemedText>
        </Pressable>
        <Pressable
          onPress={() => setShowArchived(true)}
          style={[styles.tab, { borderColor: theme.brand }, showArchived && { backgroundColor: theme.brand }]}
        >
          <ThemedText style={showArchived ? styles.tabTextActive : { color: theme.brand }}>Archived</ThemedText>
        </Pressable>
      </View>

      {!showArchived && (
        <Pressable style={[styles.addButton, { backgroundColor: theme.brand }]} onPress={() => router.push('/admin/coupons/new')}>
          <ThemedText style={styles.addButtonText}>+ New coupon</ThemedText>
        </Pressable>
      )}

      {isLoading ? (
        <ActivityIndicator style={styles.spinner} color={theme.brand} />
      ) : error ? (
        <ThemedText style={styles.error}>{error instanceof Error ? error.message : 'Failed to load coupons.'}</ThemedText>
      ) : (
        <FlatList
          data={coupons ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <ThemedText style={styles.empty}>{showArchived ? 'No archived coupons.' : 'No coupons yet.'}</ThemedText>
          }
          renderItem={({ item }) => (
            <Pressable
              style={[styles.row, { borderColor: theme.backgroundSelected, backgroundColor: theme.backgroundElement }]}
              onPress={() => router.push(`/admin/coupons/${item.id}`)}
            >
              <View>
                <ThemedText type="smallBold">{item.code}</ThemedText>
                <ThemedText themeColor="textSecondary" type="small">
                  {item.discountPercent}% off · limit {item.usageLimitPerUser} per user
                </ThemedText>
              </View>
              <ThemedText themeColor="textSecondary">{'›'}</ThemedText>
            </Pressable>
          )}
        />
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: Spacing.three, paddingTop: Spacing.three },
  tabRow: { flexDirection: 'row', gap: Spacing.two, marginBottom: Spacing.three },
  tab: { flex: 1, borderWidth: 1, borderRadius: 10, paddingVertical: Spacing.two, alignItems: 'center' },
  tabTextActive: { color: '#fff', fontWeight: '700' },
  addButton: { borderRadius: 10, paddingVertical: Spacing.three, alignItems: 'center', marginBottom: Spacing.three },
  addButtonText: { color: '#fff', fontWeight: '700' },
  spinner: { marginTop: Spacing.six },
  error: { textAlign: 'center', marginTop: Spacing.six, color: '#D14343' },
  empty: { textAlign: 'center', marginTop: Spacing.six },
  list: { paddingBottom: Spacing.six },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 10,
    padding: Spacing.three,
    marginBottom: Spacing.two,
  },
});

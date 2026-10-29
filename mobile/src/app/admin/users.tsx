import { useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Stack } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/constants/theme';
import { getUsersForAdmin, setUserStatus, type UserStatus } from '@/lib/admin-api';
import { ApiError } from '@/lib/api-client';

const STATUS_COLORS: Record<UserStatus, string> = {
  ACTIVE: '#2E7D4F',
  SUSPENDED: '#B45309',
  DEACTIVATED: '#64748B',
};

// ADMIN only — list/search/filter every account, change status. Role
// filter chips mirror the website's admin users page.
export default function AdminUsersScreen() {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const [searchInput, setSearchInput] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [busyId, setBusyId] = useState<string | null>(null);

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['admin-users', q, page],
    queryFn: () => getUsersForAdmin({ q: q || undefined, page }),
  });

  function invalidate() {
    return queryClient.invalidateQueries({ queryKey: ['admin-users'] });
  }

  function onSearchSubmit() {
    setQ(searchInput.trim());
    setPage(1);
  }

  function confirmStatusChange(id: string, name: string, nextStatus: UserStatus) {
    const verb = nextStatus === 'ACTIVE' ? 'reactivate' : nextStatus === 'SUSPENDED' ? 'suspend' : 'deactivate';
    Alert.alert(`${verb.charAt(0).toUpperCase() + verb.slice(1)} ${name}?`, undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: `Yes, ${verb}`,
        style: nextStatus === 'ACTIVE' ? 'default' : 'destructive',
        onPress: async () => {
          setBusyId(id);
          try {
            await setUserStatus(id, nextStatus);
            await invalidate();
          } catch (err) {
            Alert.alert('Could not update status', err instanceof ApiError ? err.message : 'Please try again.');
          } finally {
            setBusyId(null);
          }
        },
      },
    ]);
  }

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: 'Users' }} />

      <TextInput
        style={[styles.search, { color: theme.text, borderColor: theme.backgroundSelected, backgroundColor: theme.backgroundElement }]}
        placeholder="Search name or email…"
        placeholderTextColor={theme.textSecondary}
        value={searchInput}
        onChangeText={setSearchInput}
        onSubmitEditing={onSearchSubmit}
        returnKeyType="search"
      />

      {isLoading ? (
        <ActivityIndicator style={styles.spinner} color={theme.brand} />
      ) : error ? (
        <ThemedText style={styles.error}>{error instanceof Error ? error.message : 'Failed to load users.'}</ThemedText>
      ) : (
        <FlatList
          data={data?.users ?? []}
          keyExtractor={(item) => item.id}
          refreshing={isFetching}
          onRefresh={refetch}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<ThemedText style={styles.empty}>No users match.</ThemedText>}
          renderItem={({ item }) => {
            const busy = busyId === item.id;
            return (
              <View style={[styles.card, { borderColor: theme.backgroundSelected, backgroundColor: theme.backgroundElement }]}>
                <View style={styles.cardTop}>
                  <View style={{ flex: 1 }}>
                    <ThemedText type="smallBold">{item.name}</ThemedText>
                    <ThemedText themeColor="textSecondary" type="small">{item.email}</ThemedText>
                    <ThemedText themeColor="textSecondary" type="small">{item.role} · {item._count.listings} listings</ThemedText>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[item.status] }]}>
                    <ThemedText style={styles.statusText}>{item.status}</ThemedText>
                  </View>
                </View>
                <View style={styles.actions}>
                  {busy ? (
                    <ActivityIndicator color={theme.brand} />
                  ) : item.status === 'ACTIVE' ? (
                    <Pressable style={[styles.actionButton, { borderColor: '#B45309' }]} onPress={() => confirmStatusChange(item.id, item.name, 'SUSPENDED')}>
                      <ThemedText style={{ color: '#B45309', fontWeight: '700', fontSize: 13 }}>Suspend</ThemedText>
                    </Pressable>
                  ) : (
                    <Pressable style={[styles.actionButton, { backgroundColor: theme.brand, borderColor: theme.brand }]} onPress={() => confirmStatusChange(item.id, item.name, 'ACTIVE')}>
                      <ThemedText style={styles.actionButtonTextPrimary}>Reactivate</ThemedText>
                    </Pressable>
                  )}
                  {item.status !== 'DEACTIVATED' ? (
                    <Pressable style={[styles.actionButton, { borderColor: '#D14343' }]} onPress={() => confirmStatusChange(item.id, item.name, 'DEACTIVATED')} disabled={busy}>
                      <ThemedText style={{ color: '#D14343', fontWeight: '700', fontSize: 13 }}>Deactivate</ThemedText>
                    </Pressable>
                  ) : null}
                </View>
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
  search: { borderWidth: 1, borderRadius: 10, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, fontSize: 16, marginBottom: Spacing.three },
  spinner: { marginTop: Spacing.six },
  error: { textAlign: 'center', marginTop: Spacing.six, color: '#D14343' },
  empty: { textAlign: 'center', marginTop: Spacing.six },
  list: { paddingBottom: Spacing.six },
  card: { borderWidth: 1, borderRadius: 12, padding: Spacing.three, marginBottom: Spacing.three },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two },
  statusBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  statusText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, marginTop: Spacing.three },
  actionButton: { borderWidth: 1, borderRadius: 8, paddingHorizontal: Spacing.three, paddingVertical: Spacing.one + 2 },
  actionButtonTextPrimary: { color: '#fff', fontWeight: '700', fontSize: 13 },
  loadMore: { borderWidth: 1, borderRadius: 10, paddingVertical: Spacing.three, alignItems: 'center', marginTop: Spacing.two },
});

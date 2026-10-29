import { ActivityIndicator, FlatList, StyleSheet, View } from 'react-native';
import { Stack } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/constants/theme';
import { getSellersForModerator } from '@/lib/admin-api';

// ADMIN+MODERATOR, read-only directory — no status field or action here by
// design (see getSellersForModerator()'s own comment).
export default function AdminSellersScreen() {
  const theme = useTheme();
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['admin-sellers'],
    queryFn: getSellersForModerator,
  });

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: 'Sellers' }} />
      {isLoading ? (
        <ActivityIndicator style={styles.spinner} color={theme.brand} />
      ) : error ? (
        <ThemedText style={styles.error}>{error instanceof Error ? error.message : 'Failed to load sellers.'}</ThemedText>
      ) : (
        <FlatList
          data={data ?? []}
          keyExtractor={(item) => item.id}
          refreshing={isFetching}
          onRefresh={refetch}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<ThemedText style={styles.empty}>No sellers yet.</ThemedText>}
          renderItem={({ item }) => (
            <View style={[styles.card, { borderColor: theme.backgroundSelected, backgroundColor: theme.backgroundElement }]}>
              <ThemedText type="smallBold">{item.name}</ThemedText>
              <ThemedText themeColor="textSecondary" type="small">{item.email}</ThemedText>
              {item.phone ? <ThemedText themeColor="textSecondary" type="small">{item.phone}</ThemedText> : null}
              <ThemedText themeColor="brand" type="small" style={{ marginTop: 4 }}>
                {item._count.listings} listing{item._count.listings === 1 ? '' : 's'}
              </ThemedText>
            </View>
          )}
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
});

import { ActivityIndicator, FlatList, Image, Pressable, StyleSheet, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/constants/theme';
import { getCsrInitiatives, type CsrInitiative } from '@/lib/csr-api';

function formatMoney(amount: string): string {
  return `KES ${Math.round(Number(amount)).toLocaleString()}`;
}

export default function CsrListScreen() {
  const theme = useTheme();
  const router = useRouter();

  const { data, isLoading, error } = useQuery({ queryKey: ['csr'], queryFn: getCsrInitiatives });

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: 'CSR Initiatives' }} />
      {isLoading ? (
        <ActivityIndicator style={styles.spinner} color={theme.brand} />
      ) : error ? (
        <ThemedText style={styles.error}>{error instanceof Error ? error.message : 'Failed to load initiatives.'}</ThemedText>
      ) : (
        <FlatList
          data={data ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<ThemedText style={styles.empty}>No active initiatives right now.</ThemedText>}
          renderItem={({ item }) => <InitiativeCard initiative={item} onPress={() => router.push(`/csr/${item.slug}`)} />}
        />
      )}
    </ThemedView>
  );
}

function InitiativeCard({ initiative, onPress }: { initiative: CsrInitiative; onPress: () => void }) {
  const theme = useTheme();
  const progress = Math.min(1, Number(initiative.amountRaised) / Math.max(1, Number(initiative.targetAmount)));

  return (
    <Pressable
      onPress={onPress}
      style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected }]}
    >
      {initiative.coverImageUrl ? (
        <Image source={{ uri: initiative.coverImageUrl }} style={styles.cardImage} resizeMode="cover" />
      ) : (
        <View style={[styles.cardImage, { backgroundColor: theme.backgroundSelected }]} />
      )}
      <View style={styles.cardBody}>
        {initiative.status === 'COMPLETED' ? (
          <View style={[styles.completedBadge, { backgroundColor: theme.backgroundSelected }]}>
            <ThemedText type="small">Completed</ThemedText>
          </View>
        ) : null}
        <ThemedText type="smallBold" numberOfLines={1}>
          {initiative.title}
        </ThemedText>
        <ThemedText themeColor="textSecondary" type="small" numberOfLines={2}>
          {initiative.summary}
        </ThemedText>
        <View style={[styles.progressTrack, { backgroundColor: theme.backgroundSelected }]}>
          <View style={[styles.progressFill, { backgroundColor: theme.brand, width: `${progress * 100}%` }]} />
        </View>
        <ThemedText type="small" themeColor="textSecondary">
          {formatMoney(initiative.amountRaised)} raised of {formatMoney(initiative.targetAmount)}
        </ThemedText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: Spacing.three, paddingTop: Spacing.three },
  spinner: { marginTop: Spacing.six },
  error: { textAlign: 'center', marginTop: Spacing.six, color: '#D14343' },
  empty: { textAlign: 'center', marginTop: Spacing.six },
  list: { paddingBottom: Spacing.six },
  card: { borderWidth: 1, borderRadius: 12, marginBottom: Spacing.three, overflow: 'hidden' },
  cardImage: { width: '100%', height: 130 },
  cardBody: { padding: Spacing.three, gap: 4 },
  completedBadge: { alignSelf: 'flex-start', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  progressTrack: { height: 6, borderRadius: 3, overflow: 'hidden', marginTop: Spacing.one },
  progressFill: { height: '100%' },
});

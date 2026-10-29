import { ActivityIndicator, FlatList, Image, Pressable, StyleSheet, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/constants/theme';
import { getInsurancePolicies, type InsurancePolicy } from '@/lib/insurance-api';

export default function InsuranceListScreen() {
  const theme = useTheme();
  const router = useRouter();

  const { data, isLoading, error } = useQuery({ queryKey: ['insurance'], queryFn: getInsurancePolicies });

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: 'Insurance' }} />
      {isLoading ? (
        <ActivityIndicator style={styles.spinner} color={theme.brand} />
      ) : error ? (
        <ThemedText style={styles.error}>{error instanceof Error ? error.message : 'Failed to load policies.'}</ThemedText>
      ) : (
        <FlatList
          data={data ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<ThemedText style={styles.empty}>No insurance policies available yet.</ThemedText>}
          renderItem={({ item }) => <PolicyCard policy={item} onPress={() => router.push(`/insurance/${item.id}`)} />}
        />
      )}
    </ThemedView>
  );
}

function PolicyCard({ policy, onPress }: { policy: InsurancePolicy; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected }]}
    >
      {policy.imageUrl ? (
        <Image source={{ uri: policy.imageUrl }} style={styles.cardImage} resizeMode="cover" />
      ) : (
        <View style={[styles.cardImage, { backgroundColor: theme.backgroundSelected }]} />
      )}
      <View style={styles.cardBody}>
        <ThemedText type="smallBold" numberOfLines={1}>
          {policy.title}
        </ThemedText>
        <ThemedText themeColor="textSecondary" type="small" numberOfLines={2}>
          {policy.description}
        </ThemedText>
        <ThemedText themeColor="brand" style={styles.price}>
          From KES {Math.round(Number(policy.startingPrice)).toLocaleString()}
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
  card: { flexDirection: 'row', borderWidth: 1, borderRadius: 12, marginBottom: Spacing.three, overflow: 'hidden' },
  cardImage: { width: 100, height: 90 },
  cardBody: { flex: 1, padding: Spacing.three, gap: 2 },
  price: { fontWeight: '700', marginTop: 2 },
});

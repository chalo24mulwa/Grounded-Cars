import { ActivityIndicator, FlatList, Image, Pressable, StyleSheet, View } from 'react-native';
import { Redirect, Stack, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { FavoriteButtonOverlay } from '@/components/favorite-button';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth-context';
import { Spacing } from '@/constants/theme';
import { getMyFavorites, type Favorite } from '@/lib/favorites-api';

function formatPrice(price: string, currency: string): string {
  return `${currency} ${Math.round(Number(price)).toLocaleString()}`;
}

// Same getMyFavorites() the website's /account/favorites page uses — a
// favorited listing that's no longer ACTIVE/SOLD still shows here (unlike
// the website, which filters those out into a separate count), so a buyer
// can see exactly what happened to a car they were tracking rather than it
// silently vanishing.
export default function FavoritesScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { status } = useAuth();

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['favorites'],
    queryFn: getMyFavorites,
    enabled: status === 'authenticated',
  });

  if (status === 'unauthenticated') return <Redirect href="/login" />;

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: 'Favorites' }} />
      {isLoading ? (
        <ActivityIndicator style={styles.spinner} color={theme.brand} />
      ) : error ? (
        <ThemedText style={styles.error}>{error instanceof Error ? error.message : 'Failed to load favorites.'}</ThemedText>
      ) : (
        <FlatList
          data={data ?? []}
          keyExtractor={(item) => item.id}
          refreshing={isFetching}
          onRefresh={refetch}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<ThemedText style={styles.empty}>You haven&apos;t saved any cars yet.</ThemedText>}
          renderItem={({ item }) => <FavoriteCard favorite={item} onPress={() => router.push(`/listing/${item.listing.slug}`)} />}
        />
      )}
    </ThemedView>
  );
}

function FavoriteCard({ favorite, onPress }: { favorite: Favorite; onPress: () => void }) {
  const theme = useTheme();
  const { listing } = favorite;
  const primaryImage = listing.images.find((img) => img.isPrimary) ?? listing.images[0];
  const unavailable = listing.status !== 'ACTIVE' && listing.status !== 'SOLD';

  return (
    <Pressable
      onPress={onPress}
      style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected }]}
    >
      <View style={{ position: 'relative' }}>
        {primaryImage ? (
          <Image source={{ uri: primaryImage.imageUrl }} style={styles.cardImage} resizeMode="cover" />
        ) : (
          <View style={[styles.cardImage, { backgroundColor: theme.backgroundSelected }]} />
        )}
      </View>
      <View style={styles.cardBody}>
        <ThemedText type="smallBold" numberOfLines={1}>
          {listing.title}
        </ThemedText>
        <ThemedText themeColor="brand" style={styles.price}>
          {formatPrice(listing.price, listing.currency)}
        </ThemedText>
        {unavailable ? (
          <ThemedText type="small" style={styles.unavailable}>
            No longer available
          </ThemedText>
        ) : listing.status === 'SOLD' ? (
          <ThemedText type="small" themeColor="textSecondary">
            Sold
          </ThemedText>
        ) : null}
      </View>
      <FavoriteButtonOverlay listingId={listing.id} favorited />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: Spacing.three, paddingTop: Spacing.three },
  spinner: { marginTop: Spacing.six },
  error: { textAlign: 'center', marginTop: Spacing.six, color: '#D14343' },
  empty: { textAlign: 'center', marginTop: Spacing.six },
  list: { paddingBottom: Spacing.six },
  card: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 12, marginBottom: Spacing.three, padding: Spacing.two, gap: Spacing.three },
  cardImage: { width: 72, height: 72, borderRadius: 8 },
  cardBody: { flex: 1, gap: 2 },
  price: { fontWeight: '700' },
  unavailable: { color: '#D14343' },
});

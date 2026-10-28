import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/constants/theme';
import { getListings, type Classification, type Listing } from '@/lib/listings-api';

const CLASSIFICATIONS: { value: Classification; label: string }[] = [
  { value: 'GROUNDED', label: 'Grounded' },
  { value: 'SALVAGE', label: 'Salvage' },
  { value: 'AUCTION', label: 'Auction' },
  { value: 'OLD_SCHOOL', label: 'Old School' },
];

function formatPrice(price: string, currency: string): string {
  const amount = Number(price);
  return `${currency} ${Math.round(amount).toLocaleString()}`;
}

export default function BrowseScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [searchInput, setSearchInput] = useState('');
  const [q, setQ] = useState('');
  const [classifications, setClassifications] = useState<Classification[]>([]);
  const [page, setPage] = useState(1);

  // Debounced free-text search — avoids a request per keystroke, same
  // reasoning the website's own search box uses.
  useEffect(() => {
    const timer = setTimeout(() => {
      setQ(searchInput.trim());
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const filters = useMemo(() => ({ q: q || undefined, classifications, page }), [q, classifications, page]);

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ['listings', filters],
    queryFn: () => getListings(filters),
  });

  function toggleClassification(value: Classification) {
    setPage(1);
    setClassifications((prev) => (prev.includes(value) ? prev.filter((c) => c !== value) : [...prev, value]));
  }

  return (
    <ThemedView style={styles.container}>
      <TextInput
        style={[styles.search, { color: theme.text, borderColor: theme.backgroundSelected, backgroundColor: theme.backgroundElement }]}
        placeholder="Search make, model, title…"
        placeholderTextColor={theme.textSecondary}
        value={searchInput}
        onChangeText={setSearchInput}
      />

      <View style={styles.chipsRow}>
        {CLASSIFICATIONS.map(({ value, label }) => {
          const active = classifications.includes(value);
          return (
            <Pressable
              key={value}
              onPress={() => toggleClassification(value)}
              style={[
                styles.chip,
                { borderColor: theme.brand },
                active ? { backgroundColor: theme.brand } : null,
              ]}
            >
              <ThemedText style={active ? styles.chipTextActive : { color: theme.brand }}>{label}</ThemedText>
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
          ListEmptyComponent={<ThemedText style={styles.empty}>No vehicles match your search.</ThemedText>}
          renderItem={({ item }) => <ListingCard listing={item} onPress={() => router.push(`/listing/${item.slug}`)} />}
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

function ListingCard({ listing, onPress }: { listing: Listing; onPress: () => void }) {
  const theme = useTheme();
  const primaryImage = listing.images.find((img) => img.isPrimary) ?? listing.images[0];

  return (
    <Pressable
      onPress={onPress}
      style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected }]}
    >
      {primaryImage ? (
        <Image source={{ uri: primaryImage.imageUrl }} style={styles.cardImage} resizeMode="cover" />
      ) : (
        <View style={[styles.cardImage, styles.cardImagePlaceholder, { backgroundColor: theme.backgroundSelected }]} />
      )}
      <View style={styles.cardBody}>
        <ThemedText type="smallBold" numberOfLines={1}>
          {listing.title}
        </ThemedText>
        <ThemedText themeColor="brand" style={styles.price}>
          {formatPrice(listing.price, listing.currency)}
        </ThemedText>
        <ThemedText themeColor="textSecondary" type="small">
          {listing.year} · {listing.mileage ? `${listing.mileage.toLocaleString()} km` : '—'}
          {listing.location ? ` · ${listing.location}` : ''}
        </ThemedText>
        {listing.classifications.length > 0 ? (
          <View style={styles.badgeRow}>
            {listing.classifications.map((c) => (
              <View key={c} style={[styles.badge, { backgroundColor: theme.brand }]}>
                <ThemedText style={styles.badgeText}>{c.replace('_', ' ')}</ThemedText>
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: Spacing.three, paddingTop: Spacing.three },
  search: { borderWidth: 1, borderRadius: 10, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, fontSize: 16 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, marginTop: Spacing.three, marginBottom: Spacing.two },
  chip: { borderWidth: 1, borderRadius: 16, paddingHorizontal: Spacing.three, paddingVertical: Spacing.one },
  chipTextActive: { color: '#fff' },
  spinner: { marginTop: Spacing.six },
  error: { textAlign: 'center', marginTop: Spacing.six, color: '#D14343' },
  empty: { textAlign: 'center', marginTop: Spacing.six },
  list: { paddingBottom: Spacing.six },
  card: { flexDirection: 'row', borderWidth: 1, borderRadius: 12, marginBottom: Spacing.three, overflow: 'hidden' },
  cardImage: { width: 110, height: 100 },
  cardImagePlaceholder: {},
  cardBody: { flex: 1, padding: Spacing.three, gap: 2 },
  price: { fontWeight: '700' },
  badgeRow: { flexDirection: 'row', gap: 4, marginTop: Spacing.one, flexWrap: 'wrap' },
  badge: { borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  loadMore: { borderWidth: 1, borderRadius: 10, paddingVertical: Spacing.three, alignItems: 'center', marginTop: Spacing.two },
});

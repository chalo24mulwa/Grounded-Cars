import { useState } from 'react';
import { ActivityIndicator, Image, Linking, Pressable, ScrollView, StyleSheet, TextInput, View, useWindowDimensions } from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { FavoriteButtonOverlay } from '@/components/favorite-button';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth-context';
import { Spacing } from '@/constants/theme';
import { getListingBySlug } from '@/lib/listings-api';
import { getMyFavorites } from '@/lib/favorites-api';
import { sendInquiry } from '@/lib/inquiries-api';
import { ApiError } from '@/lib/api-client';

function formatPrice(price: string, currency: string): string {
  return `${currency} ${Math.round(Number(price)).toLocaleString()}`;
}

const SPEC_LABELS: Record<string, string> = {
  year: 'Year',
  mileage: 'Mileage',
  transmission: 'Transmission',
  fuelType: 'Fuel type',
  engineSize: 'Engine size',
  bodyType: 'Body type',
  color: 'Color',
  condition: 'Condition',
};

export default function ListingDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const { status } = useAuth();
  const queryClient = useQueryClient();
  const [activeImage, setActiveImage] = useState(0);
  const [inquiryOpen, setInquiryOpen] = useState(false);
  const [inquiryMessage, setInquiryMessage] = useState('');
  const [sendingInquiry, setSendingInquiry] = useState(false);
  const [inquiryError, setInquiryError] = useState<string | null>(null);
  const [inquirySent, setInquirySent] = useState(false);

  const { data: listing, isLoading, error } = useQuery({
    queryKey: ['listing', slug],
    queryFn: () => getListingBySlug(slug),
    enabled: Boolean(slug),
  });

  const { data: favorites } = useQuery({
    queryKey: ['favorites'],
    queryFn: getMyFavorites,
    enabled: status === 'authenticated',
  });
  const favorited = Boolean(listing && (favorites ?? []).some((f) => f.listingId === listing.id));

  async function onSendInquiry() {
    if (!listing) return;
    setInquiryError(null);
    setSendingInquiry(true);
    try {
      await sendInquiry({ listingId: listing.id, message: inquiryMessage.trim() });
      setInquirySent(true);
      void queryClient.invalidateQueries({ queryKey: ['my-inquiries'] });
    } catch (err) {
      setInquiryError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSendingInquiry(false);
    }
  }

  if (isLoading) {
    return (
      <ThemedView style={styles.centered}>
        <ActivityIndicator color={theme.brand} />
      </ThemedView>
    );
  }

  if (error || !listing) {
    return (
      <ThemedView style={styles.centered}>
        <ThemedText>This listing couldn&apos;t be found.</ThemedText>
      </ThemedView>
    );
  }

  const specs = [
    { key: 'year', value: String(listing.year) },
    { key: 'mileage', value: listing.mileage ? `${listing.mileage.toLocaleString()} km` : null },
    { key: 'transmission', value: listing.transmission },
    { key: 'fuelType', value: listing.fuelType },
    { key: 'engineSize', value: listing.engineSize },
    { key: 'bodyType', value: listing.bodyType },
    { key: 'color', value: listing.color },
    { key: 'condition', value: listing.condition },
  ].filter((s) => s.value);

  return (
    <ThemedView style={{ flex: 1 }}>
      <Stack.Screen options={{ title: listing.title }} />
      <ScrollView>
        <View style={{ position: 'relative' }}>
          {listing.images.length > 0 ? (
            <>
              <ScrollView
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={(e) => setActiveImage(Math.round(e.nativeEvent.contentOffset.x / width))}
              >
                {listing.images.map((img) => (
                  <Image key={img.id} source={{ uri: img.imageUrl }} style={{ width, height: 260 }} resizeMode="cover" />
                ))}
              </ScrollView>
              <View style={styles.dots}>
                {listing.images.map((img, i) => (
                  <View
                    key={img.id}
                    style={[styles.dot, { backgroundColor: i === activeImage ? theme.brand : theme.backgroundSelected }]}
                  />
                ))}
              </View>
            </>
          ) : (
            <View style={[{ width, height: 260 }, { backgroundColor: theme.backgroundElement }]} />
          )}

          {status === 'authenticated' ? (
            <View style={styles.favoriteOverlay}>
              <FavoriteButtonOverlay listingId={listing.id} favorited={favorited} size="large" />
            </View>
          ) : null}
        </View>

        <View style={styles.content}>
          {listing.classifications.length > 0 ? (
            <View style={styles.badgeRow}>
              {listing.classifications.map((c) => (
                <View key={c} style={[styles.badge, { backgroundColor: theme.brand }]}>
                  <ThemedText style={styles.badgeText}>{c.replace('_', ' ')}</ThemedText>
                </View>
              ))}
              {listing.status === 'SOLD' ? (
                <View style={[styles.badge, { backgroundColor: '#D14343' }]}>
                  <ThemedText style={styles.badgeText}>SOLD</ThemedText>
                </View>
              ) : null}
            </View>
          ) : null}

          <ThemedText type="subtitle" style={styles.title}>
            {listing.title}
          </ThemedText>
          <ThemedText themeColor="brand" style={styles.price}>
            {formatPrice(listing.price, listing.currency)}
          </ThemedText>
          {listing.location ? <ThemedText themeColor="textSecondary">{listing.location}</ThemedText> : null}

          <View style={[styles.specsGrid, { borderColor: theme.backgroundSelected }]}>
            {specs.map((spec) => (
              <View key={spec.key} style={styles.specItem}>
                <ThemedText themeColor="textSecondary" type="small">
                  {SPEC_LABELS[spec.key]}
                </ThemedText>
                <ThemedText type="smallBold">{spec.value}</ThemedText>
              </View>
            ))}
          </View>

          {listing.description ? (
            <>
              <ThemedText type="smallBold" style={styles.sectionTitle}>
                Description
              </ThemedText>
              <ThemedText>{listing.description}</ThemedText>
            </>
          ) : null}

          {listing.status === 'ACTIVE' && status === 'authenticated' ? (
            <View style={styles.inquirySection}>
              {inquirySent ? (
                <ThemedText style={styles.success}>Message sent — the seller has been notified.</ThemedText>
              ) : inquiryOpen ? (
                <>
                  <ThemedText type="smallBold" style={styles.sectionTitle}>
                    Message the seller
                  </ThemedText>
                  <TextInput
                    style={[styles.inquiryInput, { color: theme.text, borderColor: theme.backgroundSelected }]}
                    placeholder="Hi, is this still available?"
                    placeholderTextColor={theme.textSecondary}
                    value={inquiryMessage}
                    onChangeText={setInquiryMessage}
                    multiline
                    numberOfLines={4}
                  />
                  {inquiryError ? <ThemedText style={styles.errorText}>{inquiryError}</ThemedText> : null}
                  <Pressable
                    style={[styles.sendInquiryButton, { backgroundColor: theme.brand }, (sendingInquiry || !inquiryMessage.trim()) && styles.disabled]}
                    onPress={onSendInquiry}
                    disabled={sendingInquiry || !inquiryMessage.trim()}
                  >
                    {sendingInquiry ? <ActivityIndicator color="#fff" /> : <ThemedText style={styles.sendInquiryButtonText}>Send message</ThemedText>}
                  </Pressable>
                </>
              ) : (
                <Pressable style={[styles.messageButton, { borderColor: theme.brand }]} onPress={() => setInquiryOpen(true)}>
                  <ThemedText themeColor="brand" style={{ fontWeight: '700' }}>
                    Message seller
                  </ThemedText>
                </Pressable>
              )}
            </View>
          ) : null}
        </View>
      </ScrollView>

      {listing.status === 'ACTIVE' && listing.seller?.phone ? (
        <View style={[styles.footer, { borderTopColor: theme.backgroundSelected, backgroundColor: theme.background }]}>
          <Pressable
            style={[styles.callButton, { backgroundColor: theme.brand }]}
            onPress={() => Linking.openURL(`tel:${listing.seller!.phone}`)}
          >
            <ThemedText style={styles.callButtonText}>Call {listing.seller.name}</ThemedText>
          </Pressable>
        </View>
      ) : null}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: Spacing.two },
  dot: { width: 6, height: 6, borderRadius: 3 },
  content: { padding: Spacing.four },
  badgeRow: { flexDirection: 'row', gap: 6, marginBottom: Spacing.two, flexWrap: 'wrap' },
  badge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  title: { marginBottom: Spacing.one },
  price: { fontSize: 22, fontWeight: '700', marginBottom: Spacing.one },
  specsGrid: { flexDirection: 'row', flexWrap: 'wrap', borderTopWidth: 1, marginTop: Spacing.four, paddingTop: Spacing.three, gap: Spacing.four },
  specItem: { minWidth: '40%' },
  sectionTitle: { marginTop: Spacing.four, marginBottom: Spacing.one },
  footer: { borderTopWidth: 1, padding: Spacing.three },
  callButton: { borderRadius: 10, paddingVertical: Spacing.three, alignItems: 'center' },
  callButtonText: { color: '#fff', fontWeight: '700' },
  favoriteOverlay: { position: 'absolute', top: Spacing.three, right: Spacing.three },
  inquirySection: { marginTop: Spacing.five },
  messageButton: { borderWidth: 1, borderRadius: 10, paddingVertical: Spacing.three, alignItems: 'center' },
  inquiryInput: { borderWidth: 1, borderRadius: 10, padding: Spacing.three, minHeight: 90, textAlignVertical: 'top', fontSize: 15 },
  errorText: { color: '#D14343', marginTop: Spacing.two },
  success: { color: '#2E7D4F' },
  sendInquiryButton: { borderRadius: 10, paddingVertical: Spacing.three, alignItems: 'center', marginTop: Spacing.two },
  sendInquiryButtonText: { color: '#fff', fontWeight: '700' },
  disabled: { opacity: 0.6 },
});

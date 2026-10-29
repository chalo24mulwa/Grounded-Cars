import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/constants/theme';
import { getFeaturedPlans, startFeatureSubscription } from '@/lib/featured-api';
import { getMyListings } from '@/lib/my-listings-api';
import { ApiError } from '@/lib/api-client';

function formatPrice(price: string, currency: string): string {
  return `${currency} ${Math.round(Number(price)).toLocaleString()}`;
}

export default function NewFeaturedSubscriptionScreen() {
  const theme = useTheme();
  const router = useRouter();

  const { data: listings } = useQuery({ queryKey: ['my-listings'], queryFn: getMyListings });
  const { data: plans } = useQuery({ queryKey: ['featured-plans'], queryFn: getFeaturedPlans });
  const activeListings = (listings ?? []).filter((l) => l.status === 'ACTIVE');

  const [listingId, setListingId] = useState<string | null>(null);
  const [planId, setPlanId] = useState<string | null>(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ free: boolean } | null>(null);

  async function onSubmit() {
    if (!listingId || !planId || !phoneNumber) return;
    setError(null);
    setSubmitting(true);
    try {
      const res = await startFeatureSubscription({
        listingId,
        planId,
        phoneNumber: phoneNumber.trim(),
        couponCode: couponCode.trim() || undefined,
      });
      setResult({ free: res.free });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    return (
      <ThemedView style={styles.centered}>
        <Stack.Screen options={{ title: 'Feature a Listing' }} />
        <ThemedText type="title" style={styles.resultTitle}>
          {result.free ? 'Featured!' : 'Check your phone'}
        </ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.resultSubtitle}>
          {result.free
            ? 'Your coupon covered the full cost — this listing is now featured.'
            : "We sent an M-Pesa payment prompt to your phone. Once you approve it, this listing's featured status updates automatically — no need to refresh."}
        </ThemedText>
        <Pressable style={[styles.doneButton, { backgroundColor: theme.brand }]} onPress={() => router.replace('/featured')}>
          <ThemedText style={styles.doneButtonText}>View my subscriptions</ThemedText>
        </Pressable>
      </ThemedView>
    );
  }

  if (activeListings.length === 0) {
    return (
      <ThemedView style={styles.centered}>
        <Stack.Screen options={{ title: 'Feature a Listing' }} />
        <ThemedText style={{ textAlign: 'center' }}>
          You need at least one active listing before you can feature it. List a car first, then
          come back here once it&apos;s approved.
        </ThemedText>
      </ThemedView>
    );
  }

  const inputStyle = [styles.input, { color: theme.text, borderColor: theme.backgroundSelected }];

  return (
    <ThemedView style={{ flex: 1 }}>
      <Stack.Screen options={{ title: 'Feature a Listing' }} />
      <ScrollView contentContainerStyle={styles.container}>
        <ThemedText type="smallBold" style={styles.sectionTitle}>
          Choose a listing
        </ThemedText>
        {activeListings.map((listing) => (
          <Pressable
            key={listing.id}
            onPress={() => setListingId(listing.id)}
            style={[
              styles.option,
              { borderColor: listingId === listing.id ? theme.brand : theme.backgroundSelected },
              listingId === listing.id && { backgroundColor: theme.backgroundElement },
            ]}
          >
            <ThemedText numberOfLines={1}>{listing.title}</ThemedText>
          </Pressable>
        ))}

        <ThemedText type="smallBold" style={styles.sectionTitle}>
          Choose a plan
        </ThemedText>
        {(plans ?? []).map((plan) => (
          <Pressable
            key={plan.id}
            onPress={() => setPlanId(plan.id)}
            style={[
              styles.option,
              { borderColor: planId === plan.id ? theme.brand : theme.backgroundSelected },
              planId === plan.id && { backgroundColor: theme.backgroundElement },
            ]}
          >
            <View style={styles.planRow}>
              <ThemedText>{plan.name}</ThemedText>
              <ThemedText themeColor="brand" style={{ fontWeight: '700' }}>
                {formatPrice(plan.price, plan.currency)}
              </ThemedText>
            </View>
            <ThemedText type="small" themeColor="textSecondary">
              {plan.durationDays} days
            </ThemedText>
          </Pressable>
        ))}

        <ThemedText type="smallBold" style={styles.sectionTitle}>
          M-Pesa phone number
        </ThemedText>
        <TextInput
          style={inputStyle}
          placeholder="07XX XXX XXX"
          placeholderTextColor={theme.textSecondary}
          keyboardType="phone-pad"
          value={phoneNumber}
          onChangeText={setPhoneNumber}
        />

        <ThemedText type="smallBold" style={styles.sectionTitle}>
          Coupon code (optional)
        </ThemedText>
        <TextInput
          style={inputStyle}
          placeholder="e.g. SAVE20"
          placeholderTextColor={theme.textSecondary}
          autoCapitalize="characters"
          value={couponCode}
          onChangeText={setCouponCode}
        />

        {error ? <ThemedText style={styles.error}>{error}</ThemedText> : null}

        <Pressable
          style={[
            styles.submitButton,
            { backgroundColor: theme.brand },
            (submitting || !listingId || !planId || !phoneNumber) && styles.disabled,
          ]}
          onPress={onSubmit}
          disabled={submitting || !listingId || !planId || !phoneNumber}
        >
          {submitting ? <ActivityIndicator color="#fff" /> : <ThemedText style={styles.submitButtonText}>Pay with M-Pesa</ThemedText>}
        </Pressable>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.five },
  container: { padding: Spacing.four },
  sectionTitle: { marginTop: Spacing.four, marginBottom: Spacing.two },
  option: { borderWidth: 1, borderRadius: 10, padding: Spacing.three, marginBottom: Spacing.two },
  planRow: { flexDirection: 'row', justifyContent: 'space-between' },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: Spacing.three, paddingVertical: Spacing.three, fontSize: 16 },
  error: { color: '#D14343', marginTop: Spacing.three },
  submitButton: { borderRadius: 10, paddingVertical: Spacing.three, alignItems: 'center', marginTop: Spacing.five },
  disabled: { opacity: 0.6 },
  submitButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  resultTitle: { fontSize: 26, marginBottom: Spacing.two, textAlign: 'center' },
  resultSubtitle: { textAlign: 'center', marginBottom: Spacing.five },
  doneButton: { borderRadius: 10, paddingVertical: Spacing.three, paddingHorizontal: Spacing.five, alignItems: 'center' },
  doneButtonText: { color: '#fff', fontWeight: '700' },
});

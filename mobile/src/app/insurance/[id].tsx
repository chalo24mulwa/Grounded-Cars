import { useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, TextInput, View, useWindowDimensions } from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/constants/theme';
import { getInsurancePolicy, purchaseInsurancePolicy } from '@/lib/insurance-api';
import { ApiError } from '@/lib/api-client';

// Public, no account required. Amount is always server-derived from the
// policy's own startingPrice — no coupon support either (matches the
// website: insurance-service.ts never imports coupon-service.ts).
export default function InsuranceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const { width } = useWindowDimensions();

  const { data: policy, isLoading, error } = useQuery({
    queryKey: ['insurance', id],
    queryFn: () => getInsurancePolicy(id),
    enabled: Boolean(id),
  });

  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [purchased, setPurchased] = useState(false);

  if (isLoading) {
    return (
      <ThemedView style={styles.centered}>
        <ActivityIndicator color={theme.brand} />
      </ThemedView>
    );
  }
  if (error || !policy) {
    return (
      <ThemedView style={styles.centered}>
        <ThemedText>This policy couldn&apos;t be found.</ThemedText>
      </ThemedView>
    );
  }

  async function onPurchase() {
    if (!policy || !phone) return;
    setPurchaseError(null);
    setSubmitting(true);
    try {
      await purchaseInsurancePolicy({
        policyId: policy.id,
        customerPhone: phone.trim(),
        customerName: name.trim() || undefined,
        customerEmail: email.trim() || undefined,
      });
      setPurchased(true);
    } catch (err) {
      setPurchaseError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const inputStyle = [styles.input, { color: theme.text, borderColor: theme.backgroundSelected }];

  return (
    <ThemedView style={{ flex: 1 }}>
      <Stack.Screen options={{ title: policy.title }} />
      <ScrollView>
        {policy.imageUrl ? (
          <Image source={{ uri: policy.imageUrl }} style={{ width, height: 200 }} resizeMode="cover" />
        ) : (
          <View style={[{ width, height: 200 }, { backgroundColor: theme.backgroundElement }]} />
        )}
        <View style={styles.content}>
          <ThemedText type="subtitle">{policy.title}</ThemedText>
          <ThemedText themeColor="brand" style={styles.price}>
            From KES {Math.round(Number(policy.startingPrice)).toLocaleString()}
          </ThemedText>
          <ThemedText style={styles.description}>{policy.description}</ThemedText>

          {purchased ? (
            <View style={[styles.thanksBox, { backgroundColor: theme.backgroundElement }]}>
              <ThemedText type="smallBold">Check your phone</ThemedText>
              <ThemedText themeColor="textSecondary" type="small">
                We sent an M-Pesa payment prompt to {phone}. Once you approve it, your purchase is
                confirmed automatically.
              </ThemedText>
            </View>
          ) : (
            <View>
              <ThemedText type="smallBold" style={styles.sectionTitle}>
                Buy this policy
              </ThemedText>
              <TextInput style={inputStyle} placeholder="M-Pesa phone number" placeholderTextColor={theme.textSecondary} keyboardType="phone-pad" value={phone} onChangeText={setPhone} />
              <TextInput style={[inputStyle, styles.fieldSpacing]} placeholder="Your name (optional)" placeholderTextColor={theme.textSecondary} value={name} onChangeText={setName} />
              <TextInput style={[inputStyle, styles.fieldSpacing]} placeholder="Email (optional)" placeholderTextColor={theme.textSecondary} autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />

              {purchaseError ? <ThemedText style={styles.error}>{purchaseError}</ThemedText> : null}

              <Pressable
                style={[styles.purchaseButton, { backgroundColor: theme.brand }, (submitting || !phone) && styles.disabled]}
                onPress={onPurchase}
                disabled={submitting || !phone}
              >
                {submitting ? <ActivityIndicator color="#fff" /> : <ThemedText style={styles.purchaseButtonText}>Buy via M-Pesa</ThemedText>}
              </Pressable>
            </View>
          )}
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: Spacing.four },
  price: { fontSize: 20, fontWeight: '700', marginTop: Spacing.one, marginBottom: Spacing.three },
  description: { lineHeight: 22, marginBottom: Spacing.four },
  thanksBox: { borderRadius: 12, padding: Spacing.four },
  sectionTitle: { marginBottom: Spacing.two },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: Spacing.three, paddingVertical: Spacing.three, fontSize: 16 },
  fieldSpacing: { marginTop: Spacing.two },
  error: { color: '#D14343', marginTop: Spacing.three },
  purchaseButton: { borderRadius: 10, paddingVertical: Spacing.three, alignItems: 'center', marginTop: Spacing.four },
  disabled: { opacity: 0.6 },
  purchaseButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});

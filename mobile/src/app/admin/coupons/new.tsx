import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/constants/theme';
import { createCoupon } from '@/lib/admin-commerce-api';
import { ApiError } from '@/lib/api-client';

export default function NewCouponScreen() {
  const theme = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [code, setCode] = useState('');
  const [discountPercent, setDiscountPercent] = useState('');
  const [usageLimitPerUser, setUsageLimitPerUser] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isValid = code.trim().length >= 3 && discountPercent !== '' && usageLimitPerUser !== '';

  async function onSubmit() {
    setError(null);
    setSubmitting(true);
    try {
      // discountPercent/usageLimitPerUser must be sent as strings — see
      // admin-commerce-api.ts's CouponFormInput comment.
      await createCoupon({
        code: code.trim().toUpperCase(),
        discountPercent: String(Number(discountPercent)),
        usageLimitPerUser: String(Number(usageLimitPerUser)),
      });
      await queryClient.invalidateQueries({ queryKey: ['admin-coupons'] });
      router.back();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
      setSubmitting(false);
    }
  }

  const inputStyle = [styles.input, { color: theme.text, borderColor: theme.backgroundSelected }];

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: 'New Coupon' }} />

      <ThemedText type="small" themeColor="textSecondary" style={styles.label}>
        Code (letters, numbers, hyphens)
      </ThemedText>
      <TextInput
        style={inputStyle}
        placeholder="SAVE20"
        placeholderTextColor={theme.textSecondary}
        autoCapitalize="characters"
        value={code}
        onChangeText={setCode}
      />

      <ThemedText type="small" themeColor="textSecondary" style={styles.label}>
        Discount percent (5-100)
      </ThemedText>
      <TextInput
        style={inputStyle}
        placeholder="20"
        placeholderTextColor={theme.textSecondary}
        keyboardType="number-pad"
        value={discountPercent}
        onChangeText={setDiscountPercent}
      />

      <ThemedText type="small" themeColor="textSecondary" style={styles.label}>
        Usage limit per user (1-1000)
      </ThemedText>
      <TextInput
        style={inputStyle}
        placeholder="1"
        placeholderTextColor={theme.textSecondary}
        keyboardType="number-pad"
        value={usageLimitPerUser}
        onChangeText={setUsageLimitPerUser}
      />

      {error ? <ThemedText style={styles.error}>{error}</ThemedText> : null}

      <Pressable
        style={[styles.button, { backgroundColor: theme.brand }, (submitting || !isValid) && styles.disabled]}
        onPress={onSubmit}
        disabled={submitting || !isValid}
      >
        {submitting ? <ActivityIndicator color="#fff" /> : <ThemedText style={styles.buttonText}>Create coupon</ThemedText>}
      </Pressable>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: Spacing.four },
  label: { marginBottom: Spacing.one, marginTop: Spacing.three },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: Spacing.three, paddingVertical: Spacing.three, fontSize: 16 },
  error: { color: '#D14343', marginTop: Spacing.three },
  button: { borderRadius: 10, paddingVertical: Spacing.three, alignItems: 'center', marginTop: Spacing.five },
  disabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});

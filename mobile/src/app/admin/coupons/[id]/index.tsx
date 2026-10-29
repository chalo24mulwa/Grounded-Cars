import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/constants/theme';
import {
  getCoupon,
  updateCoupon,
  archiveCoupon,
  unarchiveCoupon,
  getCouponRedemptions,
  type Coupon,
  type CouponRedemptionsResult,
} from '@/lib/admin-commerce-api';
import { ApiError } from '@/lib/api-client';

export default function CouponDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();

  const { data: coupon, isLoading } = useQuery({
    queryKey: ['admin-coupon', id],
    queryFn: () => getCoupon(id),
    enabled: Boolean(id),
  });
  const { data: redemptions } = useQuery({
    queryKey: ['admin-coupon-redemptions', id],
    queryFn: () => getCouponRedemptions(id),
    enabled: Boolean(id),
  });

  if (isLoading || !coupon) {
    return (
      <ThemedView style={styles.centered}>
        <ActivityIndicator color={theme.brand} />
      </ThemedView>
    );
  }

  // Keyed by coupon.id: a fresh CouponEditor instance per coupon, so its
  // local form state is initialized once (lazily, from `coupon`, already
  // guaranteed non-null here) rather than synced in via an effect.
  return <CouponEditor key={coupon.id} id={id} coupon={coupon} redemptions={redemptions} />;
}

function CouponEditor({
  id,
  coupon,
  redemptions,
}: {
  id: string;
  coupon: Coupon;
  redemptions: CouponRedemptionsResult | undefined;
}) {
  const theme = useTheme();
  const queryClient = useQueryClient();

  const [code, setCode] = useState(coupon.code);
  const [discountPercent, setDiscountPercent] = useState(String(coupon.discountPercent));
  const [usageLimitPerUser, setUsageLimitPerUser] = useState(String(coupon.usageLimitPerUser));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [archiving, setArchiving] = useState(false);

  function invalidate() {
    return Promise.all([
      queryClient.invalidateQueries({ queryKey: ['admin-coupon', id] }),
      queryClient.invalidateQueries({ queryKey: ['admin-coupons'] }),
    ]);
  }

  async function onSave() {
    setSaveError(null);
    setSaving(true);
    try {
      await updateCoupon(id, {
        code: code.trim().toUpperCase(),
        discountPercent: String(Number(discountPercent)),
        usageLimitPerUser: String(Number(usageLimitPerUser)),
      });
      await invalidate();
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function onToggleArchive() {
    setArchiving(true);
    try {
      if (coupon.archivedAt) {
        await unarchiveCoupon(id);
      } else {
        await archiveCoupon(id);
      }
      await invalidate();
    } catch (err) {
      Alert.alert('Could not update coupon', err instanceof ApiError ? err.message : 'Please try again.');
    } finally {
      setArchiving(false);
    }
  }

  const inputStyle = [styles.input, { color: theme.text, borderColor: theme.backgroundSelected }];

  return (
    <ThemedView style={{ flex: 1 }}>
      <Stack.Screen options={{ title: coupon.code }} />
      <ScrollView contentContainerStyle={styles.container}>
        <ThemedText type="small" themeColor="textSecondary" style={styles.label}>
          Code
        </ThemedText>
        <TextInput style={inputStyle} autoCapitalize="characters" value={code} onChangeText={setCode} />

        <ThemedText type="small" themeColor="textSecondary" style={styles.label}>
          Discount percent
        </ThemedText>
        <TextInput style={inputStyle} keyboardType="number-pad" value={discountPercent} onChangeText={setDiscountPercent} />

        <ThemedText type="small" themeColor="textSecondary" style={styles.label}>
          Usage limit per user
        </ThemedText>
        <TextInput style={inputStyle} keyboardType="number-pad" value={usageLimitPerUser} onChangeText={setUsageLimitPerUser} />

        {saveError ? <ThemedText style={styles.error}>{saveError}</ThemedText> : null}

        <Pressable style={[styles.button, { backgroundColor: theme.brand }, saving && styles.disabled]} onPress={onSave} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" /> : <ThemedText style={styles.buttonText}>Save changes</ThemedText>}
        </Pressable>

        <Pressable
          style={[styles.outlineButton, { borderColor: coupon.archivedAt ? theme.brand : '#D14343' }, archiving && styles.disabled]}
          onPress={onToggleArchive}
          disabled={archiving}
        >
          {archiving ? (
            <ActivityIndicator color={coupon.archivedAt ? theme.brand : '#D14343'} />
          ) : (
            <ThemedText style={{ color: coupon.archivedAt ? theme.brand : '#D14343', fontWeight: '700' }}>
              {coupon.archivedAt ? 'Unarchive coupon' : 'Archive coupon'}
            </ThemedText>
          )}
        </Pressable>

        <View style={[styles.divider, { backgroundColor: theme.backgroundSelected }]} />

        <ThemedText type="smallBold" style={styles.sectionTitle}>
          Redemptions
        </ThemedText>
        {redemptions ? (
          <>
            <ThemedText themeColor="textSecondary" style={styles.redemptionSummary}>
              {redemptions.redemptionCount} redemption{redemptions.redemptionCount === 1 ? '' : 's'} · KES{' '}
              {redemptions.totalDiscountGiven.toLocaleString()} total discount given
            </ThemedText>
            {redemptions.redemptions.map((r) => (
              <View key={r.id} style={[styles.redemptionRow, { borderColor: theme.backgroundSelected }]}>
                <ThemedText type="small">{r.scope === 'FEATURED_LISTING' ? 'Featured listing' : 'Service order'}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  -{r.discountPercent}% (KES {Number(r.discountedAmount).toLocaleString()})
                </ThemedText>
              </View>
            ))}
            {redemptions.redemptions.length === 0 ? (
              <ThemedText themeColor="textSecondary" type="small">
                No redemptions yet.
              </ThemedText>
            ) : null}
          </>
        ) : (
          <ActivityIndicator color={theme.brand} />
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container: { padding: Spacing.four },
  label: { marginBottom: Spacing.one, marginTop: Spacing.three },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: Spacing.three, paddingVertical: Spacing.three, fontSize: 16 },
  error: { color: '#D14343', marginTop: Spacing.three },
  button: { borderRadius: 10, paddingVertical: Spacing.three, alignItems: 'center', marginTop: Spacing.five },
  outlineButton: { borderWidth: 1, borderRadius: 10, paddingVertical: Spacing.three, alignItems: 'center', marginTop: Spacing.three },
  disabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  divider: { height: 1, marginVertical: Spacing.five },
  sectionTitle: { marginBottom: Spacing.two },
  redemptionSummary: { marginBottom: Spacing.three },
  redemptionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    paddingVertical: Spacing.two,
  },
});

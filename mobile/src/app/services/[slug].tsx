import { useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, TextInput, View, useWindowDimensions } from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/constants/theme';
import { getService, orderService } from '@/lib/services-api';
import { ApiError } from '@/lib/api-client';

// Public, no account required — same anonymous order flow as the
// website's ServiceOrderPanel. No status-polling endpoint exists (same as
// CSR/Insurance); this just shows a static confirmation after the STK push
// is sent.
export default function ServiceDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const theme = useTheme();
  const { width } = useWindowDimensions();

  const { data: service, isLoading, error } = useQuery({
    queryKey: ['service', slug],
    queryFn: () => getService(slug),
    enabled: Boolean(slug),
  });

  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [ordered, setOrdered] = useState(false);

  if (isLoading) {
    return (
      <ThemedView style={styles.centered}>
        <ActivityIndicator color={theme.brand} />
      </ThemedView>
    );
  }
  if (error || !service) {
    return (
      <ThemedView style={styles.centered}>
        <ThemedText>This service isn&apos;t available yet.</ThemedText>
      </ThemedView>
    );
  }

  async function onOrder() {
    if (!service || !phone) return;
    setOrderError(null);
    setSubmitting(true);
    try {
      await orderService({
        serviceId: service.id,
        customerPhone: phone.trim(),
        customerName: name.trim() || undefined,
        customerEmail: email.trim() || undefined,
        couponCode: couponCode.trim() || undefined,
      });
      setOrdered(true);
    } catch (err) {
      setOrderError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const cover = service.images[0]?.imageUrl;
  const inputStyle = [styles.input, { color: theme.text, borderColor: theme.backgroundSelected }];

  return (
    <ThemedView style={{ flex: 1 }}>
      <Stack.Screen options={{ title: service.title }} />
      <ScrollView>
        {cover ? (
          <Image source={{ uri: cover }} style={{ width, height: 200 }} resizeMode="cover" />
        ) : (
          <View style={[{ width, height: 200 }, { backgroundColor: theme.backgroundElement }]} />
        )}
        <View style={styles.content}>
          <ThemedText type="subtitle">{service.title}</ThemedText>
          <ThemedText themeColor="brand" style={styles.price}>
            KES {Math.round(Number(service.price)).toLocaleString()}
          </ThemedText>
          <ThemedText style={styles.description}>{service.description}</ThemedText>

          {ordered ? (
            <View style={[styles.thanksBox, { backgroundColor: theme.backgroundElement }]}>
              <ThemedText type="smallBold">Check your phone</ThemedText>
              <ThemedText themeColor="textSecondary" type="small">
                We sent an M-Pesa payment prompt to {phone}. Once you approve it, your order is
                confirmed automatically.
              </ThemedText>
            </View>
          ) : (
            <View style={styles.orderSection}>
              <ThemedText type="smallBold" style={styles.sectionTitle}>
                Order this service
              </ThemedText>
              <TextInput style={inputStyle} placeholder="M-Pesa phone number" placeholderTextColor={theme.textSecondary} keyboardType="phone-pad" value={phone} onChangeText={setPhone} />
              <TextInput style={[inputStyle, styles.fieldSpacing]} placeholder="Your name (optional)" placeholderTextColor={theme.textSecondary} value={name} onChangeText={setName} />
              <TextInput style={[inputStyle, styles.fieldSpacing]} placeholder="Email (optional)" placeholderTextColor={theme.textSecondary} autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
              <TextInput style={[inputStyle, styles.fieldSpacing]} placeholder="Coupon code (optional)" placeholderTextColor={theme.textSecondary} autoCapitalize="characters" value={couponCode} onChangeText={setCouponCode} />

              {orderError ? <ThemedText style={styles.error}>{orderError}</ThemedText> : null}

              <Pressable
                style={[styles.orderButton, { backgroundColor: theme.brand }, (submitting || !phone) && styles.disabled]}
                onPress={onOrder}
                disabled={submitting || !phone}
              >
                {submitting ? <ActivityIndicator color="#fff" /> : <ThemedText style={styles.orderButtonText}>Order via M-Pesa</ThemedText>}
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
  orderSection: {},
  sectionTitle: { marginBottom: Spacing.two },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: Spacing.three, paddingVertical: Spacing.three, fontSize: 16 },
  fieldSpacing: { marginTop: Spacing.two },
  error: { color: '#D14343', marginTop: Spacing.three },
  orderButton: { borderRadius: 10, paddingVertical: Spacing.three, alignItems: 'center', marginTop: Spacing.four },
  disabled: { opacity: 0.6 },
  orderButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});

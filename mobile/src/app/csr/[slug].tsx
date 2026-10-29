import { useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, TextInput, View, useWindowDimensions } from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/constants/theme';
import { getCsrInitiative, donateToCsrInitiative } from '@/lib/csr-api';
import { ApiError } from '@/lib/api-client';

const QUICK_AMOUNTS = [500, 1000, 2500, 5000, 10000];

function formatMoney(amount: string | number): string {
  return `KES ${Math.round(Number(amount)).toLocaleString()}`;
}

// Public, no account required — same anonymous donate flow as the website's
// CsrDonateForm. An STK push is sent on submit; there is no status-polling
// endpoint (same as the website), so this just shows a static confirmation
// and the progress bar updates whenever the page is next viewed.
export default function CsrDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const theme = useTheme();
  const { width } = useWindowDimensions();

  const { data: initiative, isLoading, error } = useQuery({
    queryKey: ['csr', slug],
    queryFn: () => getCsrInitiative(slug),
    enabled: Boolean(slug),
  });

  const [amount, setAmount] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState('');
  const [donorPhone, setDonorPhone] = useState('');
  const [donorName, setDonorName] = useState('');
  const [donorEmail, setDonorEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [donateError, setDonateError] = useState<string | null>(null);
  const [donated, setDonated] = useState(false);

  if (isLoading) {
    return (
      <ThemedView style={styles.centered}>
        <ActivityIndicator color={theme.brand} />
      </ThemedView>
    );
  }
  if (error || !initiative) {
    return (
      <ThemedView style={styles.centered}>
        <ThemedText>This initiative couldn&apos;t be found.</ThemedText>
      </ThemedView>
    );
  }

  const finalAmount = amount ?? Number(customAmount);
  const progress = Math.min(1, Number(initiative.amountRaised) / Math.max(1, Number(initiative.targetAmount)));

  async function onDonate() {
    if (!initiative || !finalAmount || !donorPhone) return;
    setDonateError(null);
    setSubmitting(true);
    try {
      await donateToCsrInitiative({
        initiativeId: initiative.id,
        amount: finalAmount,
        donorPhone: donorPhone.trim(),
        donorName: donorName.trim() || undefined,
        donorEmail: donorEmail.trim() || undefined,
      });
      setDonated(true);
    } catch (err) {
      setDonateError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const inputStyle = [styles.input, { color: theme.text, borderColor: theme.backgroundSelected }];

  return (
    <ThemedView style={{ flex: 1 }}>
      <Stack.Screen options={{ title: initiative.title }} />
      <ScrollView>
        {initiative.coverImageUrl ? (
          <Image source={{ uri: initiative.coverImageUrl }} style={{ width, height: 220 }} resizeMode="cover" />
        ) : (
          <View style={[{ width, height: 220 }, { backgroundColor: theme.backgroundElement }]} />
        )}
        <View style={styles.content}>
          <ThemedText type="subtitle" style={styles.title}>
            {initiative.title}
          </ThemedText>

          <View style={[styles.progressTrack, { backgroundColor: theme.backgroundSelected }]}>
            <View style={[styles.progressFill, { backgroundColor: theme.brand, width: `${progress * 100}%` }]} />
          </View>
          <ThemedText themeColor="textSecondary" type="small" style={{ marginBottom: Spacing.four }}>
            {formatMoney(initiative.amountRaised)} raised of {formatMoney(initiative.targetAmount)}
          </ThemedText>

          <ThemedText style={styles.story}>{initiative.story}</ThemedText>

          {initiative.status === 'COMPLETED' ? (
            <View style={[styles.thanksBox, { backgroundColor: theme.backgroundElement }]}>
              <ThemedText type="smallBold">Thank you!</ThemedText>
              <ThemedText themeColor="textSecondary" type="small">
                This initiative has been completed thanks to everyone who donated.
              </ThemedText>
            </View>
          ) : donated ? (
            <View style={[styles.thanksBox, { backgroundColor: theme.backgroundElement }]}>
              <ThemedText type="smallBold">Check your phone</ThemedText>
              <ThemedText themeColor="textSecondary" type="small">
                We sent an M-Pesa payment prompt to {donorPhone}. Once you approve it, your donation
                is recorded automatically.
              </ThemedText>
            </View>
          ) : (
            <View style={styles.donateSection}>
              <ThemedText type="smallBold" style={styles.sectionTitle}>
                Donate
              </ThemedText>
              <View style={styles.amountRow}>
                {QUICK_AMOUNTS.map((value) => (
                  <Pressable
                    key={value}
                    onPress={() => {
                      setAmount(value);
                      setCustomAmount('');
                    }}
                    style={[styles.amountChip, { borderColor: theme.brand }, amount === value && { backgroundColor: theme.brand }]}
                  >
                    <ThemedText style={amount === value ? { color: '#fff' } : { color: theme.brand }}>
                      {value.toLocaleString()}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>
              <TextInput
                style={inputStyle}
                placeholder="Other amount (KES)"
                placeholderTextColor={theme.textSecondary}
                keyboardType="number-pad"
                value={customAmount}
                onChangeText={(v) => {
                  setCustomAmount(v);
                  setAmount(null);
                }}
              />
              <TextInput
                style={[inputStyle, styles.fieldSpacing]}
                placeholder="M-Pesa phone number"
                placeholderTextColor={theme.textSecondary}
                keyboardType="phone-pad"
                value={donorPhone}
                onChangeText={setDonorPhone}
              />
              <TextInput
                style={[inputStyle, styles.fieldSpacing]}
                placeholder="Your name (optional)"
                placeholderTextColor={theme.textSecondary}
                value={donorName}
                onChangeText={setDonorName}
              />
              <TextInput
                style={[inputStyle, styles.fieldSpacing]}
                placeholder="Email (optional)"
                placeholderTextColor={theme.textSecondary}
                autoCapitalize="none"
                keyboardType="email-address"
                value={donorEmail}
                onChangeText={setDonorEmail}
              />

              {donateError ? <ThemedText style={styles.error}>{donateError}</ThemedText> : null}

              <Pressable
                style={[styles.donateButton, { backgroundColor: theme.brand }, (submitting || !finalAmount || !donorPhone) && styles.disabled]}
                onPress={onDonate}
                disabled={submitting || !finalAmount || !donorPhone}
              >
                {submitting ? <ActivityIndicator color="#fff" /> : <ThemedText style={styles.donateButtonText}>Donate via M-Pesa</ThemedText>}
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
  title: { marginBottom: Spacing.three },
  progressTrack: { height: 8, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%' },
  story: { lineHeight: 22, marginBottom: Spacing.four },
  thanksBox: { borderRadius: 12, padding: Spacing.four },
  donateSection: { marginTop: Spacing.two },
  sectionTitle: { marginBottom: Spacing.two },
  amountRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, marginBottom: Spacing.three },
  amountChip: { borderWidth: 1, borderRadius: 16, paddingHorizontal: Spacing.three, paddingVertical: Spacing.one },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: Spacing.three, paddingVertical: Spacing.three, fontSize: 16 },
  fieldSpacing: { marginTop: Spacing.two },
  error: { color: '#D14343', marginTop: Spacing.three },
  donateButton: { borderRadius: 10, paddingVertical: Spacing.three, alignItems: 'center', marginTop: Spacing.four },
  disabled: { opacity: 0.6 },
  donateButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});

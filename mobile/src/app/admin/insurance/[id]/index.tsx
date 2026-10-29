import { useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/constants/theme';
import {
  getInsurancePolicyAdmin,
  updateInsurancePolicyAdmin,
  setInsurancePolicyPublishedAdmin,
  archiveInsurancePolicyAdmin,
  unarchiveInsurancePolicyAdmin,
  getInsurancePurchasesAdmin,
  type InsurancePolicyAdmin,
  type PickedImage,
} from '@/lib/admin-content-api';
import { ApiError } from '@/lib/api-client';

export default function EditInsurancePolicyScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();

  const { data: policy, isLoading } = useQuery({
    queryKey: ['admin-insurance', id],
    queryFn: () => getInsurancePolicyAdmin(id),
    enabled: Boolean(id),
  });

  if (isLoading || !policy) {
    return (
      <ThemedView style={styles.centered}>
        <ActivityIndicator color={theme.brand} />
      </ThemedView>
    );
  }

  // Keyed by policy.id so the form's lazily-initialized state is seeded
  // fresh from the loaded record with no useEffect sync needed — same
  // pattern ListingForm (listing-form.tsx) already uses.
  return <PolicyDetail key={policy.id} id={id} policy={policy} />;
}

function PolicyDetail({ id, policy }: { id: string; policy: InsurancePolicyAdmin }) {
  const theme = useTheme();
  const queryClient = useQueryClient();

  const { data: purchasesData } = useQuery({
    queryKey: ['admin-insurance-purchases', id],
    queryFn: () => getInsurancePurchasesAdmin(id),
  });

  const [title, setTitle] = useState(policy.title);
  const [description, setDescription] = useState(policy.description);
  const [startingPrice, setStartingPrice] = useState(policy.startingPrice);
  const [newImage, setNewImage] = useState<PickedImage | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function invalidate() {
    return Promise.all([
      queryClient.invalidateQueries({ queryKey: ['admin-insurance', id] }),
      queryClient.invalidateQueries({ queryKey: ['admin-insurance'] }),
      queryClient.invalidateQueries({ queryKey: ['admin-insurance-archived'] }),
    ]);
  }

  async function onSave() {
    setError(null);
    setSaved(false);
    setSaving(true);
    try {
      await updateInsurancePolicyAdmin(id, { title, description, startingPrice }, newImage ?? undefined);
      setNewImage(null);
      await invalidate();
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function onTogglePublished() {
    setBusy(true);
    try {
      await setInsurancePolicyPublishedAdmin(id, !policy.published);
      await invalidate();
    } finally {
      setBusy(false);
    }
  }

  async function onToggleArchived() {
    setBusy(true);
    try {
      if (policy.archived) await unarchiveInsurancePolicyAdmin(id);
      else await archiveInsurancePolicyAdmin(id);
      await invalidate();
    } finally {
      setBusy(false);
    }
  }

  async function onPickImage() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (result.canceled || result.assets.length === 0) return;
    const asset = result.assets[0]!;
    setNewImage({ uri: asset.uri, name: asset.fileName ?? `policy-${Date.now()}.jpg`, type: asset.mimeType ?? 'image/jpeg' });
  }

  const inputStyle = [styles.input, { color: theme.text, borderColor: theme.backgroundSelected }];

  return (
    <ThemedView style={{ flex: 1 }}>
      <Stack.Screen options={{ title: policy.title }} />
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.statusRow}>
          <Pressable
            style={[styles.toggleButton, { backgroundColor: policy.published ? '#2E7D4F' : theme.backgroundSelected }]}
            onPress={onTogglePublished}
            disabled={busy || policy.archived}
          >
            <ThemedText style={styles.toggleButtonText}>{policy.published ? 'Published — tap to unpublish' : 'Draft — tap to publish'}</ThemedText>
          </Pressable>
          <Pressable
            style={[styles.toggleButton, { backgroundColor: policy.archived ? '#64748B' : '#D14343' }]}
            onPress={onToggleArchived}
            disabled={busy}
          >
            <ThemedText style={styles.toggleButtonText}>{policy.archived ? 'Archived — tap to restore' : 'Tap to archive'}</ThemedText>
          </Pressable>
        </View>

        <Pressable style={[styles.imagePicker, { borderColor: theme.brand }]} onPress={onPickImage}>
          {newImage ? (
            <Image source={{ uri: newImage.uri }} style={styles.image} />
          ) : policy.imageUrl ? (
            <Image source={{ uri: policy.imageUrl }} style={styles.image} />
          ) : (
            <ThemedText themeColor="brand">Choose photo</ThemedText>
          )}
        </Pressable>

        <TextInput style={inputStyle} placeholder="Title" placeholderTextColor={theme.textSecondary} value={title} onChangeText={setTitle} />
        <TextInput
          style={[inputStyle, styles.textArea]}
          placeholder="Description"
          placeholderTextColor={theme.textSecondary}
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={5}
        />
        <TextInput
          style={inputStyle}
          placeholder="Starting price (KES)"
          placeholderTextColor={theme.textSecondary}
          keyboardType="number-pad"
          value={startingPrice}
          onChangeText={setStartingPrice}
        />

        {error ? <ThemedText style={styles.error}>{error}</ThemedText> : null}
        {saved ? <ThemedText style={styles.success}>Saved.</ThemedText> : null}
        <Pressable style={[styles.submitButton, { backgroundColor: theme.brand }, saving && styles.disabled]} onPress={onSave} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" /> : <ThemedText style={styles.submitButtonText}>Save changes</ThemedText>}
        </Pressable>

        <View style={[styles.divider, { backgroundColor: theme.backgroundSelected }]} />

        <ThemedText type="smallBold" style={styles.sectionTitle}>
          Purchases
        </ThemedText>
        {purchasesData ? (
          <>
            <ThemedText themeColor="textSecondary" style={styles.purchaseSummary}>
              {purchasesData.purchaseCount} successful · {policy.currency} {Math.round(purchasesData.totalRevenue).toLocaleString()} revenue
            </ThemedText>
            {purchasesData.purchases.slice(0, 20).map((p) => (
              <View key={p.id} style={[styles.purchaseRow, { borderColor: theme.backgroundSelected }]}>
                <ThemedText type="small">{p.customerName || 'Anonymous'}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {policy.currency} {Math.round(Number(p.amount)).toLocaleString()} · {p.status}
                </ThemedText>
              </View>
            ))}
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
  statusRow: { gap: Spacing.two, marginBottom: Spacing.four },
  toggleButton: { borderRadius: 10, paddingVertical: Spacing.three, alignItems: 'center' },
  toggleButtonText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  imagePicker: { borderWidth: 1, borderStyle: 'dashed', borderRadius: 10, padding: Spacing.two, alignItems: 'center', marginBottom: Spacing.three },
  image: { width: '100%', height: 140, borderRadius: 8 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: Spacing.three, paddingVertical: Spacing.three, marginBottom: Spacing.three, fontSize: 16 },
  textArea: { minHeight: 100, textAlignVertical: 'top' },
  error: { color: '#D14343', marginBottom: Spacing.three },
  success: { color: '#2E7D4F', marginBottom: Spacing.three },
  submitButton: { borderRadius: 10, paddingVertical: Spacing.three, alignItems: 'center' },
  disabled: { opacity: 0.6 },
  submitButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  divider: { height: 1, marginVertical: Spacing.five },
  sectionTitle: { marginBottom: Spacing.three },
  purchaseSummary: { marginBottom: Spacing.two },
  purchaseRow: { flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, paddingVertical: Spacing.two },
});

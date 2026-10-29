import { useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/constants/theme';
import {
  getCsrInitiativeAdmin,
  updateCsrInitiativeAdmin,
  setCsrInitiativePublishedAdmin,
  setCsrInitiativeStatusAdmin,
  addCsrInitiativeImageAdmin,
  removeCsrInitiativeImageAdmin,
  getCsrDonationsAdmin,
  type CsrInitiativeAdmin,
  type PickedImage,
} from '@/lib/admin-content-api';
import { ApiError } from '@/lib/api-client';

export default function CsrInitiativeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();

  const { data: initiative, isLoading } = useQuery({
    queryKey: ['admin-csr', id],
    queryFn: () => getCsrInitiativeAdmin(id),
    enabled: Boolean(id),
  });

  if (isLoading || !initiative) {
    return (
      <ThemedView style={styles.centered}>
        <ActivityIndicator color={theme.brand} />
      </ThemedView>
    );
  }

  // Keyed by initiative.id so the form's lazily-initialized state is seeded
  // fresh from the loaded record with no useEffect sync needed — same
  // pattern ListingForm (listing-form.tsx) already uses.
  return <InitiativeDetail key={initiative.id} id={id} initiative={initiative} />;
}

function InitiativeDetail({ id, initiative }: { id: string; initiative: CsrInitiativeAdmin }) {
  const theme = useTheme();
  const queryClient = useQueryClient();

  const { data: donationsData } = useQuery({
    queryKey: ['admin-csr-donations', id],
    queryFn: () => getCsrDonationsAdmin(id),
  });

  const [title, setTitle] = useState(initiative.title);
  const [summary, setSummary] = useState(initiative.summary);
  const [story, setStory] = useState(initiative.story);
  const [targetAmount, setTargetAmount] = useState(initiative.targetAmount);
  const [startDate, setStartDate] = useState(initiative.startDate ? initiative.startDate.slice(0, 10) : '');
  const [endDate, setEndDate] = useState(initiative.endDate ? initiative.endDate.slice(0, 10) : '');
  const [newCover, setNewCover] = useState<PickedImage | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploadingGallery, setUploadingGallery] = useState(false);

  function invalidate() {
    return Promise.all([
      queryClient.invalidateQueries({ queryKey: ['admin-csr', id] }),
      queryClient.invalidateQueries({ queryKey: ['admin-csr'] }),
    ]);
  }

  async function onSave() {
    setError(null);
    setSaved(false);
    setSaving(true);
    try {
      await updateCsrInitiativeAdmin(
        id,
        { title, summary, story, targetAmount, startDate: startDate || undefined, endDate: endDate || undefined },
        newCover ?? undefined
      );
      setNewCover(null);
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
      await setCsrInitiativePublishedAdmin(id, !initiative.published);
      await invalidate();
    } catch (err) {
      Alert.alert('Error', err instanceof ApiError ? err.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function onToggleStatus() {
    setBusy(true);
    try {
      await setCsrInitiativeStatusAdmin(id, initiative.status === 'ACTIVE' ? 'COMPLETED' : 'ACTIVE');
      await invalidate();
    } catch (err) {
      Alert.alert('Error', err instanceof ApiError ? err.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function onPickGalleryPhoto() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (result.canceled || result.assets.length === 0) return;
    const asset = result.assets[0]!;
    setUploadingGallery(true);
    try {
      await addCsrInitiativeImageAdmin(id, {
        uri: asset.uri,
        name: asset.fileName ?? `photo-${Date.now()}.jpg`,
        type: asset.mimeType ?? 'image/jpeg',
      });
      await invalidate();
    } catch (err) {
      Alert.alert('Could not add photo', err instanceof ApiError ? err.message : 'Please try again.');
    } finally {
      setUploadingGallery(false);
    }
  }

  async function onRemoveGalleryPhoto(imageId: string) {
    try {
      await removeCsrInitiativeImageAdmin(id, imageId);
      await invalidate();
    } catch (err) {
      Alert.alert('Could not remove photo', err instanceof ApiError ? err.message : 'Please try again.');
    }
  }

  async function onPickNewCover() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (result.canceled || result.assets.length === 0) return;
    const asset = result.assets[0]!;
    setNewCover({ uri: asset.uri, name: asset.fileName ?? `cover-${Date.now()}.jpg`, type: asset.mimeType ?? 'image/jpeg' });
  }

  const inputStyle = [styles.input, { color: theme.text, borderColor: theme.backgroundSelected }];

  return (
    <ThemedView style={{ flex: 1 }}>
      <Stack.Screen options={{ title: 'Edit Initiative' }} />
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.statusRow}>
          <Pressable
            style={[styles.toggleButton, { backgroundColor: initiative.published ? '#2E7D4F' : theme.backgroundSelected }]}
            onPress={onTogglePublished}
            disabled={busy}
          >
            <ThemedText style={styles.toggleButtonText}>{initiative.published ? 'Published — tap to unpublish' : 'Draft — tap to publish'}</ThemedText>
          </Pressable>
          <Pressable
            style={[styles.toggleButton, { backgroundColor: initiative.status === 'ACTIVE' ? theme.brand : '#64748B' }]}
            onPress={onToggleStatus}
            disabled={busy}
          >
            <ThemedText style={styles.toggleButtonText}>{initiative.status === 'ACTIVE' ? 'Active — tap to complete' : 'Completed — tap to reactivate'}</ThemedText>
          </Pressable>
        </View>

        <Pressable style={[styles.coverPicker, { borderColor: theme.brand }]} onPress={onPickNewCover}>
          {newCover ? (
            <Image source={{ uri: newCover.uri }} style={styles.coverImage} />
          ) : initiative.coverImageUrl ? (
            <Image source={{ uri: initiative.coverImageUrl }} style={styles.coverImage} />
          ) : (
            <ThemedText themeColor="brand">Choose cover photo</ThemedText>
          )}
        </Pressable>

        <TextInput style={inputStyle} placeholder="Title" placeholderTextColor={theme.textSecondary} value={title} onChangeText={setTitle} />
        <TextInput style={inputStyle} placeholder="Summary" placeholderTextColor={theme.textSecondary} value={summary} onChangeText={setSummary} />
        <TextInput
          style={[inputStyle, styles.textArea]}
          placeholder="Full story"
          placeholderTextColor={theme.textSecondary}
          value={story}
          onChangeText={setStory}
          multiline
          numberOfLines={6}
        />
        <TextInput
          style={inputStyle}
          placeholder="Target amount (KES)"
          placeholderTextColor={theme.textSecondary}
          keyboardType="number-pad"
          value={targetAmount}
          onChangeText={setTargetAmount}
        />
        <View style={styles.row}>
          <TextInput style={[inputStyle, styles.half]} placeholder="Start date (YYYY-MM-DD)" placeholderTextColor={theme.textSecondary} value={startDate} onChangeText={setStartDate} />
          <TextInput style={[inputStyle, styles.half]} placeholder="End date (YYYY-MM-DD)" placeholderTextColor={theme.textSecondary} value={endDate} onChangeText={setEndDate} />
        </View>

        {error ? <ThemedText style={styles.error}>{error}</ThemedText> : null}
        {saved ? <ThemedText style={styles.success}>Saved.</ThemedText> : null}
        <Pressable style={[styles.submitButton, { backgroundColor: theme.brand }, saving && styles.disabled]} onPress={onSave} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" /> : <ThemedText style={styles.submitButtonText}>Save changes</ThemedText>}
        </Pressable>

        <View style={[styles.divider, { backgroundColor: theme.backgroundSelected }]} />

        <ThemedText type="smallBold" style={styles.sectionTitle}>
          Gallery
        </ThemedText>
        <View style={styles.photoGrid}>
          {(initiative.images ?? []).map((img) => (
            <View key={img.id} style={styles.photoItem}>
              <Image source={{ uri: img.imageUrl }} style={styles.photoThumb} />
              <Pressable style={styles.removePhotoButton} onPress={() => onRemoveGalleryPhoto(img.id)}>
                <ThemedText style={styles.removePhotoText}>Remove</ThemedText>
              </Pressable>
            </View>
          ))}
          <Pressable style={[styles.addPhotoButton, { borderColor: theme.brand }]} onPress={onPickGalleryPhoto} disabled={uploadingGallery}>
            {uploadingGallery ? <ActivityIndicator color={theme.brand} /> : <ThemedText themeColor="brand">+ Add</ThemedText>}
          </Pressable>
        </View>

        <View style={[styles.divider, { backgroundColor: theme.backgroundSelected }]} />

        <ThemedText type="smallBold" style={styles.sectionTitle}>
          Donations
        </ThemedText>
        {donationsData ? (
          <>
            <ThemedText themeColor="textSecondary" style={styles.donationSummary}>
              {donationsData.donationCount} successful · {initiative.currency} {Math.round(donationsData.totalRaised).toLocaleString()} raised
            </ThemedText>
            {donationsData.donations.slice(0, 20).map((d) => (
              <View key={d.id} style={[styles.donationRow, { borderColor: theme.backgroundSelected }]}>
                <ThemedText type="small">{d.donorName || 'Anonymous'}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {initiative.currency} {Math.round(Number(d.amount)).toLocaleString()} · {d.status}
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
  coverPicker: { borderWidth: 1, borderStyle: 'dashed', borderRadius: 10, padding: Spacing.two, alignItems: 'center', marginBottom: Spacing.three },
  coverImage: { width: '100%', height: 140, borderRadius: 8 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: Spacing.three, paddingVertical: Spacing.three, marginBottom: Spacing.three, fontSize: 16 },
  textArea: { minHeight: 120, textAlignVertical: 'top' },
  row: { flexDirection: 'row', gap: Spacing.three },
  half: { flex: 1 },
  error: { color: '#D14343', marginBottom: Spacing.three },
  success: { color: '#2E7D4F', marginBottom: Spacing.three },
  submitButton: { borderRadius: 10, paddingVertical: Spacing.three, alignItems: 'center' },
  disabled: { opacity: 0.6 },
  submitButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  divider: { height: 1, marginVertical: Spacing.five },
  sectionTitle: { marginBottom: Spacing.three },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  photoItem: { width: 90, height: 90, borderRadius: 8, overflow: 'hidden' },
  photoThumb: { width: '100%', height: '100%' },
  removePhotoButton: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.6)', paddingVertical: 3, alignItems: 'center' },
  removePhotoText: { color: '#fff', fontSize: 9, fontWeight: '700' },
  addPhotoButton: { width: 90, height: 90, borderRadius: 8, borderWidth: 1, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  donationSummary: { marginBottom: Spacing.two },
  donationRow: { flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, paddingVertical: Spacing.two },
});

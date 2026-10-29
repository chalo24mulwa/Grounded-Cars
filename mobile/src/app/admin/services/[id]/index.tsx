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
  getServiceAdmin,
  updateServiceAdmin,
  setServicePublishedAdmin,
  addServiceImageAdmin,
  removeServiceImageAdmin,
  getServiceOrdersAdmin,
  type ServiceAdmin,
} from '@/lib/admin-content-api';
import { ApiError } from '@/lib/api-client';

export default function EditServiceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();

  const { data: service, isLoading } = useQuery({
    queryKey: ['admin-service', id],
    queryFn: () => getServiceAdmin(id),
    enabled: Boolean(id),
  });

  if (isLoading || !service) {
    return (
      <ThemedView style={styles.centered}>
        <ActivityIndicator color={theme.brand} />
      </ThemedView>
    );
  }

  // Keyed by service.id so the form's lazily-initialized state is seeded
  // fresh from the loaded record with no useEffect sync needed — same
  // pattern ListingForm (listing-form.tsx) already uses.
  return <ServiceDetail key={service.id} id={id} service={service} />;
}

function ServiceDetail({ id, service }: { id: string; service: ServiceAdmin }) {
  const theme = useTheme();
  const queryClient = useQueryClient();

  const { data: ordersData } = useQuery({
    queryKey: ['admin-service-orders', id],
    queryFn: () => getServiceOrdersAdmin(id),
  });

  const [title, setTitle] = useState(service.title);
  const [description, setDescription] = useState(service.description);
  const [price, setPrice] = useState(service.price);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [togglingPublish, setTogglingPublish] = useState(false);
  const [uploadingGallery, setUploadingGallery] = useState(false);

  function invalidate() {
    return Promise.all([
      queryClient.invalidateQueries({ queryKey: ['admin-service', id] }),
      queryClient.invalidateQueries({ queryKey: ['admin-services'] }),
    ]);
  }

  async function onSave() {
    setError(null);
    setSaved(false);
    setSaving(true);
    try {
      await updateServiceAdmin(id, { title, description, price });
      await invalidate();
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function onTogglePublished() {
    setTogglingPublish(true);
    try {
      await setServicePublishedAdmin(id, !service.published);
      await invalidate();
    } finally {
      setTogglingPublish(false);
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
      await addServiceImageAdmin(id, { uri: asset.uri, name: asset.fileName ?? `photo-${Date.now()}.jpg`, type: asset.mimeType ?? 'image/jpeg' });
      await invalidate();
    } catch (err) {
      Alert.alert('Could not add photo', err instanceof ApiError ? err.message : 'Please try again.');
    } finally {
      setUploadingGallery(false);
    }
  }

  async function onRemoveGalleryPhoto(imageId: string) {
    try {
      await removeServiceImageAdmin(id, imageId);
      await invalidate();
    } catch (err) {
      Alert.alert('Could not remove photo', err instanceof ApiError ? err.message : 'Please try again.');
    }
  }

  const inputStyle = [styles.input, { color: theme.text, borderColor: theme.backgroundSelected }];

  return (
    <ThemedView style={{ flex: 1 }}>
      <Stack.Screen options={{ title: service.title }} />
      <ScrollView contentContainerStyle={styles.container}>
        <Pressable
          style={[styles.toggleButton, { backgroundColor: service.published ? '#2E7D4F' : theme.backgroundSelected }]}
          onPress={onTogglePublished}
          disabled={togglingPublish}
        >
          <ThemedText style={styles.toggleButtonText}>{service.published ? 'Published — tap to unpublish' : 'Draft — tap to publish'}</ThemedText>
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
        <TextInput style={inputStyle} placeholder="Price (KES)" placeholderTextColor={theme.textSecondary} keyboardType="number-pad" value={price} onChangeText={setPrice} />

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
          {(service.images ?? []).map((img) => (
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
          Orders
        </ThemedText>
        {ordersData ? (
          <>
            <ThemedText themeColor="textSecondary" style={styles.orderSummary}>
              {ordersData.orderCount} successful · {service.currency} {Math.round(ordersData.totalRevenue).toLocaleString()} revenue
            </ThemedText>
            {ordersData.orders.slice(0, 20).map((o) => (
              <View key={o.id} style={[styles.orderRow, { borderColor: theme.backgroundSelected }]}>
                <ThemedText type="small">{o.customerName || 'Anonymous'}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {service.currency} {Math.round(Number(o.amount)).toLocaleString()} · {o.status}
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
  toggleButton: { borderRadius: 10, paddingVertical: Spacing.three, alignItems: 'center', marginBottom: Spacing.four },
  toggleButtonText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: Spacing.three, paddingVertical: Spacing.three, marginBottom: Spacing.three, fontSize: 16 },
  textArea: { minHeight: 100, textAlignVertical: 'top' },
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
  orderSummary: { marginBottom: Spacing.two },
  orderRow: { flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, paddingVertical: Spacing.two },
});

import { useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/constants/theme';
import { ListingForm } from '@/components/listing-form';
import {
  getMyListingForEdit,
  updateMyListing,
  uploadListingImages,
  deleteListingImage,
  setPrimaryListingImage,
  submitListingForReview,
  type ListingFormInput,
  type MyListing,
} from '@/lib/my-listings-api';
import { ApiError } from '@/lib/api-client';

// Matches storage.ts's MAX_IMAGES_PER_LISTING — enforced authoritatively by
// the server either way; this just avoids letting someone pick more than
// can ever be accepted.
const MAX_IMAGES_PER_LISTING = 10;

// listing-service.ts's rows carry Prisma's Decimal (serialized as a string
// over JSON) and loosely-typed enum columns (string | null) — this narrows
// both back to ListingFormInput's shape for the form, trusting the values
// since they only ever came from the server's own enum-validated data.
function toFormInitialValues(listing: MyListing): Partial<ListingFormInput> {
  return {
    ...listing,
    price: Number(listing.price),
    mileage: listing.mileage ?? undefined,
    transmission: (listing.transmission as ListingFormInput['transmission']) ?? undefined,
    fuelType: (listing.fuelType as ListingFormInput['fuelType']) ?? undefined,
    engineSize: listing.engineSize ?? undefined,
    bodyType: listing.bodyType ?? undefined,
    color: listing.color ?? undefined,
    location: listing.location ?? undefined,
    description: listing.description ?? undefined,
    condition: (listing.condition as ListingFormInput['condition']) ?? undefined,
  };
}

export default function EditListingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [detailsSubmitting, setDetailsSubmitting] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [detailsSaved, setDetailsSaved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [busyImageId, setBusyImageId] = useState<string | null>(null);
  const [submittingForReview, setSubmittingForReview] = useState(false);

  const { data: listing, isLoading, error } = useQuery({
    queryKey: ['my-listing', id],
    queryFn: () => getMyListingForEdit(id),
    enabled: Boolean(id),
  });

  function invalidate() {
    return Promise.all([
      queryClient.invalidateQueries({ queryKey: ['my-listing', id] }),
      queryClient.invalidateQueries({ queryKey: ['my-listings'] }),
    ]);
  }

  async function onSaveDetails(values: ListingFormInput) {
    setDetailsError(null);
    setDetailsSaved(false);
    setDetailsSubmitting(true);
    try {
      await updateMyListing(id, values);
      await invalidate();
      setDetailsSaved(true);
    } catch (err) {
      setDetailsError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setDetailsSubmitting(false);
    }
  }

  async function onPickPhotos() {
    setPhotoError(null);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setPhotoError('Photo library access is needed to add photos.');
      return;
    }

    const remaining = MAX_IMAGES_PER_LISTING - (listing?.images.length ?? 0);
    if (remaining <= 0) {
      setPhotoError(`A listing can have at most ${MAX_IMAGES_PER_LISTING} photos.`);
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: remaining,
      quality: 0.8,
    });
    if (result.canceled || result.assets.length === 0) return;

    setUploading(true);
    try {
      await uploadListingImages(
        id,
        result.assets.map((asset, i) => ({
          uri: asset.uri,
          name: asset.fileName ?? `photo-${Date.now()}-${i}.jpg`,
          type: asset.mimeType ?? 'image/jpeg',
        }))
      );
      await invalidate();
    } catch (err) {
      setPhotoError(err instanceof ApiError ? err.message : 'Failed to upload photos. Please try again.');
    } finally {
      setUploading(false);
    }
  }

  async function onRemovePhoto(imageId: string) {
    setBusyImageId(imageId);
    try {
      await deleteListingImage(id, imageId);
      await invalidate();
    } catch (err) {
      Alert.alert('Could not remove photo', err instanceof ApiError ? err.message : 'Please try again.');
    } finally {
      setBusyImageId(null);
    }
  }

  async function onSetPrimary(imageId: string) {
    setBusyImageId(imageId);
    try {
      await setPrimaryListingImage(id, imageId);
      await invalidate();
    } catch (err) {
      Alert.alert('Could not update cover photo', err instanceof ApiError ? err.message : 'Please try again.');
    } finally {
      setBusyImageId(null);
    }
  }

  async function onSubmitForReview() {
    setSubmittingForReview(true);
    try {
      await submitListingForReview(id);
      await invalidate();
      Alert.alert('Submitted', 'Your listing has been sent for admin review.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (err) {
      Alert.alert('Could not submit listing', err instanceof ApiError ? err.message : 'Please try again.');
    } finally {
      setSubmittingForReview(false);
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

  return (
    <ThemedView style={{ flex: 1 }}>
      <Stack.Screen options={{ title: 'Edit Car Listing' }} />
      <ScrollView contentContainerStyle={styles.container}>
        {listing.rejectionReason ? (
          <View style={[styles.rejectionBox, { borderColor: '#D14343' }]}>
            <ThemedText type="smallBold" style={{ color: '#D14343' }}>
              Rejected by admin
            </ThemedText>
            <ThemedText type="small" style={{ color: '#D14343' }}>
              {listing.rejectionReason}
            </ThemedText>
          </View>
        ) : null}

        <ThemedText type="smallBold" style={styles.sectionTitle}>
          Photos ({listing.images.length}/{MAX_IMAGES_PER_LISTING})
        </ThemedText>
        <View style={styles.photoGrid}>
          {listing.images.map((img) => (
            <View key={img.id} style={styles.photoItem}>
              <Image source={{ uri: img.imageUrl }} style={styles.photoThumb} />
              {img.isPrimary ? (
                <View style={[styles.coverBadge, { backgroundColor: theme.brand }]}>
                  <ThemedText style={styles.coverBadgeText}>Cover</ThemedText>
                </View>
              ) : null}
              {busyImageId === img.id ? (
                <View style={styles.photoOverlay}>
                  <ActivityIndicator color="#fff" />
                </View>
              ) : (
                <View style={styles.photoActions}>
                  {!img.isPrimary && (
                    <Pressable style={styles.photoActionButton} onPress={() => onSetPrimary(img.id)}>
                      <ThemedText style={styles.photoActionText}>Set cover</ThemedText>
                    </Pressable>
                  )}
                  <Pressable style={[styles.photoActionButton, styles.removeButton]} onPress={() => onRemovePhoto(img.id)}>
                    <ThemedText style={styles.photoActionText}>Remove</ThemedText>
                  </Pressable>
                </View>
              )}
            </View>
          ))}
          <Pressable
            style={[styles.addPhotoButton, { borderColor: theme.brand }]}
            onPress={onPickPhotos}
            disabled={uploading}
          >
            {uploading ? <ActivityIndicator color={theme.brand} /> : <ThemedText themeColor="brand">+ Add</ThemedText>}
          </Pressable>
        </View>
        {photoError ? <ThemedText style={styles.error}>{photoError}</ThemedText> : null}

        {listing.status === 'DRAFT' ? (
          <Pressable
            style={[styles.submitReviewButton, { backgroundColor: theme.brand }, submittingForReview && styles.disabled]}
            onPress={onSubmitForReview}
            disabled={submittingForReview}
          >
            {submittingForReview ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <ThemedText style={styles.submitReviewText}>Submit for review</ThemedText>
            )}
          </Pressable>
        ) : null}

        <View style={[styles.divider, { backgroundColor: theme.backgroundSelected }]} />

        <ThemedText type="smallBold" style={styles.sectionTitle}>
          Vehicle details
        </ThemedText>
        {detailsSaved ? <ThemedText style={styles.success}>Saved.</ThemedText> : null}
        <ListingForm
          initialValues={toFormInitialValues(listing)}
          submitLabel="Save changes"
          submitting={detailsSubmitting}
          error={detailsError}
          onSubmit={onSaveDetails}
        />
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container: { padding: Spacing.four },
  sectionTitle: { marginBottom: Spacing.three },
  rejectionBox: { borderWidth: 1, borderRadius: 10, padding: Spacing.three, marginBottom: Spacing.four },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  photoItem: { width: 90, height: 90, borderRadius: 8, overflow: 'hidden' },
  photoThumb: { width: '100%', height: '100%' },
  coverBadge: { position: 'absolute', top: 4, left: 4, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  coverBadgeText: { color: '#fff', fontSize: 9, fontWeight: '700' },
  photoOverlay: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' },
  photoActions: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.55)' },
  photoActionButton: { paddingVertical: 3, alignItems: 'center' },
  removeButton: {},
  photoActionText: { color: '#fff', fontSize: 9, fontWeight: '700' },
  addPhotoButton: { width: 90, height: 90, borderRadius: 8, borderWidth: 1, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  error: { color: '#D14343', marginTop: Spacing.two },
  success: { color: '#2E7D4F', marginBottom: Spacing.three },
  submitReviewButton: { borderRadius: 10, paddingVertical: Spacing.three, alignItems: 'center', marginTop: Spacing.four },
  submitReviewText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  disabled: { opacity: 0.6 },
  divider: { height: 1, marginVertical: Spacing.five },
});

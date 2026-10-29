import { useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, TextInput } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/constants/theme';
import { getEventAdmin, updateEventAdmin, setEventPublishedAdmin, type EventAdmin, type PickedImage } from '@/lib/admin-content-api';
import { ApiError } from '@/lib/api-client';

export default function EditEventScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();

  const { data: event, isLoading } = useQuery({
    queryKey: ['admin-event', id],
    queryFn: () => getEventAdmin(id),
    enabled: Boolean(id),
  });

  if (isLoading || !event) {
    return (
      <ThemedView style={styles.centered}>
        <ActivityIndicator color={theme.brand} />
      </ThemedView>
    );
  }

  // Keyed by event.id so the form's lazily-initialized state is seeded
  // fresh from the loaded record with no useEffect sync needed — same
  // pattern ListingForm (listing-form.tsx) already uses.
  return <EventForm key={event.id} id={id} event={event} />;
}

function EventForm({ id, event }: { id: string; event: EventAdmin }) {
  const theme = useTheme();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState(event.title);
  const [description, setDescription] = useState(event.description);
  const [location, setLocation] = useState(event.location ?? '');
  const [eventDate, setEventDate] = useState(event.eventDate ? event.eventDate.slice(0, 10) : '');
  const [newImage, setNewImage] = useState<PickedImage | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [togglingPublish, setTogglingPublish] = useState(false);

  function invalidate() {
    return Promise.all([
      queryClient.invalidateQueries({ queryKey: ['admin-event', id] }),
      queryClient.invalidateQueries({ queryKey: ['admin-events'] }),
    ]);
  }

  async function onSave() {
    setError(null);
    setSaved(false);
    setSaving(true);
    try {
      await updateEventAdmin(id, { title, description, location: location || undefined, eventDate: eventDate || undefined }, newImage ?? undefined);
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
    setTogglingPublish(true);
    try {
      await setEventPublishedAdmin(id, !event.published);
      await invalidate();
    } catch {
      // surfaced via re-fetched state
    } finally {
      setTogglingPublish(false);
    }
  }

  async function onPickImage() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (result.canceled || result.assets.length === 0) return;
    const asset = result.assets[0]!;
    setNewImage({ uri: asset.uri, name: asset.fileName ?? `event-${Date.now()}.jpg`, type: asset.mimeType ?? 'image/jpeg' });
  }

  const inputStyle = [styles.input, { color: theme.text, borderColor: theme.backgroundSelected }];

  return (
    <ThemedView style={{ flex: 1 }}>
      <Stack.Screen options={{ title: 'Edit Event' }} />
      <ScrollView contentContainerStyle={styles.container}>
        <Pressable
          style={[styles.toggleButton, { backgroundColor: event.published ? '#2E7D4F' : theme.backgroundSelected }]}
          onPress={onTogglePublished}
          disabled={togglingPublish}
        >
          <ThemedText style={styles.toggleButtonText}>{event.published ? 'Published — tap to unpublish' : 'Draft — tap to publish'}</ThemedText>
        </Pressable>

        <Pressable style={[styles.imagePicker, { borderColor: theme.brand }]} onPress={onPickImage}>
          {newImage ? (
            <Image source={{ uri: newImage.uri }} style={styles.image} />
          ) : event.imageUrl ? (
            <Image source={{ uri: event.imageUrl }} style={styles.image} />
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
        <TextInput style={inputStyle} placeholder="Location" placeholderTextColor={theme.textSecondary} value={location} onChangeText={setLocation} />
        <TextInput style={inputStyle} placeholder="Date (YYYY-MM-DD)" placeholderTextColor={theme.textSecondary} value={eventDate} onChangeText={setEventDate} />

        {error ? <ThemedText style={styles.error}>{error}</ThemedText> : null}
        {saved ? <ThemedText style={styles.success}>Saved.</ThemedText> : null}
        <Pressable style={[styles.submitButton, { backgroundColor: theme.brand }, saving && styles.disabled]} onPress={onSave} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" /> : <ThemedText style={styles.submitButtonText}>Save changes</ThemedText>}
        </Pressable>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container: { padding: Spacing.four },
  toggleButton: { borderRadius: 10, paddingVertical: Spacing.three, alignItems: 'center', marginBottom: Spacing.four },
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
});

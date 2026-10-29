import { useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, TextInput } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/constants/theme';
import { createInsurancePolicyAdmin, type PickedImage } from '@/lib/admin-content-api';
import { ApiError } from '@/lib/api-client';

export default function NewInsurancePolicyScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startingPrice, setStartingPrice] = useState('');
  const [image, setImage] = useState<PickedImage | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onPickImage() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (result.canceled || result.assets.length === 0) return;
    const asset = result.assets[0]!;
    setImage({ uri: asset.uri, name: asset.fileName ?? `policy-${Date.now()}.jpg`, type: asset.mimeType ?? 'image/jpeg' });
  }

  const isValid = title.trim().length >= 3 && description.trim().length >= 10 && Number(startingPrice) > 0;

  async function onSubmit() {
    if (!isValid) return;
    setError(null);
    setSubmitting(true);
    try {
      const policy = await createInsurancePolicyAdmin(
        { title: title.trim(), description: description.trim(), startingPrice },
        image ?? undefined
      );
      router.replace(`/admin/insurance/${policy.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
      setSubmitting(false);
    }
  }

  const inputStyle = [styles.input, { color: theme.text, borderColor: theme.backgroundSelected }];

  return (
    <ThemedView style={{ flex: 1 }}>
      <Stack.Screen options={{ title: 'New Insurance Policy' }} />
      <ScrollView contentContainerStyle={styles.container}>
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

        <Pressable style={[styles.imagePicker, { borderColor: theme.brand }]} onPress={onPickImage}>
          {image ? <Image source={{ uri: image.uri }} style={styles.image} /> : <ThemedText themeColor="brand">Choose photo (optional)</ThemedText>}
        </Pressable>

        {error ? <ThemedText style={styles.error}>{error}</ThemedText> : null}

        <Pressable
          style={[styles.submitButton, { backgroundColor: theme.brand }, (!isValid || submitting) && styles.disabled]}
          onPress={onSubmit}
          disabled={!isValid || submitting}
        >
          {submitting ? <ActivityIndicator color="#fff" /> : <ThemedText style={styles.submitButtonText}>Create</ThemedText>}
        </Pressable>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { padding: Spacing.four },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: Spacing.three, paddingVertical: Spacing.three, marginBottom: Spacing.three, fontSize: 16 },
  textArea: { minHeight: 100, textAlignVertical: 'top' },
  imagePicker: { borderWidth: 1, borderStyle: 'dashed', borderRadius: 10, padding: Spacing.four, alignItems: 'center', marginBottom: Spacing.three },
  image: { width: '100%', height: 140, borderRadius: 8 },
  error: { color: '#D14343', marginBottom: Spacing.three },
  submitButton: { borderRadius: 10, paddingVertical: Spacing.three, alignItems: 'center' },
  disabled: { opacity: 0.6 },
  submitButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});

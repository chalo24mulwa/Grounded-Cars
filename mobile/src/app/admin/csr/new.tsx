import { useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/constants/theme';
import { createCsrInitiativeAdmin, type PickedImage } from '@/lib/admin-content-api';
import { ApiError } from '@/lib/api-client';

export default function NewCsrInitiativeScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [story, setStory] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [cover, setCover] = useState<PickedImage | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onPickCover() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (result.canceled || result.assets.length === 0) return;
    const asset = result.assets[0]!;
    setCover({ uri: asset.uri, name: asset.fileName ?? `cover-${Date.now()}.jpg`, type: asset.mimeType ?? 'image/jpeg' });
  }

  const isValid = title.trim().length >= 5 && summary.trim().length >= 10 && story.trim().length >= 20 && Number(targetAmount) > 0;

  async function onSubmit() {
    if (!isValid) return;
    setError(null);
    setSubmitting(true);
    try {
      const initiative = await createCsrInitiativeAdmin(
        {
          title: title.trim(),
          summary: summary.trim(),
          story: story.trim(),
          targetAmount,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
        },
        cover ?? undefined
      );
      router.replace(`/admin/csr/${initiative.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
      setSubmitting(false);
    }
  }

  const inputStyle = [styles.input, { color: theme.text, borderColor: theme.backgroundSelected }];

  return (
    <ThemedView style={{ flex: 1 }}>
      <Stack.Screen options={{ title: 'New CSR Initiative' }} />
      <ScrollView contentContainerStyle={styles.container}>
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
          <TextInput
            style={[inputStyle, styles.half]}
            placeholder="Start date (YYYY-MM-DD)"
            placeholderTextColor={theme.textSecondary}
            value={startDate}
            onChangeText={setStartDate}
          />
          <TextInput
            style={[inputStyle, styles.half]}
            placeholder="End date (YYYY-MM-DD)"
            placeholderTextColor={theme.textSecondary}
            value={endDate}
            onChangeText={setEndDate}
          />
        </View>

        <Pressable style={[styles.coverPicker, { borderColor: theme.brand }]} onPress={onPickCover}>
          {cover ? (
            <Image source={{ uri: cover.uri }} style={styles.coverImage} />
          ) : (
            <ThemedText themeColor="brand">Choose cover photo (optional)</ThemedText>
          )}
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
  textArea: { minHeight: 120, textAlignVertical: 'top' },
  row: { flexDirection: 'row', gap: Spacing.three },
  half: { flex: 1 },
  coverPicker: { borderWidth: 1, borderStyle: 'dashed', borderRadius: 10, padding: Spacing.four, alignItems: 'center', marginBottom: Spacing.three },
  coverImage: { width: '100%', height: 140, borderRadius: 8 },
  error: { color: '#D14343', marginBottom: Spacing.three },
  submitButton: { borderRadius: 10, paddingVertical: Spacing.three, alignItems: 'center' },
  disabled: { opacity: 0.6 },
  submitButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});

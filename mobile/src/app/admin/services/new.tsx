import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/constants/theme';
import { createServiceAdmin, SERVICE_PAGE_OPTIONS, type ServiceSlug } from '@/lib/admin-content-api';
import { ApiError } from '@/lib/api-client';

export default function NewServiceScreen() {
  const { slug } = useLocalSearchParams<{ slug: ServiceSlug }>();
  const theme = useTheme();
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pageLabel = SERVICE_PAGE_OPTIONS.find((o) => o.slug === slug)?.label ?? slug;
  const isValid = title.trim().length >= 3 && description.trim().length >= 10 && Number(price) > 0;

  async function onSubmit() {
    if (!isValid || !slug) return;
    setError(null);
    setSubmitting(true);
    try {
      const service = await createServiceAdmin({ slug, title: title.trim(), description: description.trim(), price });
      router.replace(`/admin/services/${service.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
      setSubmitting(false);
    }
  }

  const inputStyle = [styles.input, { color: theme.text, borderColor: theme.backgroundSelected }];

  return (
    <ThemedView style={{ flex: 1 }}>
      <Stack.Screen options={{ title: `New: ${pageLabel}` }} />
      <ScrollView contentContainerStyle={styles.container}>
        <ThemedText themeColor="textSecondary" style={styles.subtitle}>
          This will appear on the {pageLabel} page.
        </ThemedText>
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
  subtitle: { marginBottom: Spacing.three },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: Spacing.three, paddingVertical: Spacing.three, marginBottom: Spacing.three, fontSize: 16 },
  textArea: { minHeight: 100, textAlignVertical: 'top' },
  error: { color: '#D14343', marginBottom: Spacing.three },
  submitButton: { borderRadius: 10, paddingVertical: Spacing.three, alignItems: 'center' },
  disabled: { opacity: 0.6 },
  submitButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});

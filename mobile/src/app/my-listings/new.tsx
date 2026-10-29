import { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { ListingForm } from '@/components/listing-form';
import { createMyListing, type ListingFormInput } from '@/lib/my-listings-api';
import { ApiError } from '@/lib/api-client';

// Creates the listing as a DRAFT (same createListing() the website uses),
// then moves straight to the new listing's Edit screen to add photos and
// submit for review — the website's own create form stages photos up
// front in one combined step; this two-step version is simpler on mobile
// and reaches the exact same end state (a DRAFT with photos, ready to
// submit) through the same two API calls either way.
export default function NewListingScreen() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(values: ListingFormInput) {
    setError(null);
    setSubmitting(true);
    try {
      const listing = await createMyListing(values);
      router.replace(`/my-listings/${listing.id}/edit`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
      setSubmitting(false);
    }
  }

  return (
    <ThemedView style={{ flex: 1 }}>
      <Stack.Screen options={{ title: 'Add New Car' }} />
      <ScrollView contentContainerStyle={styles.container}>
        <ThemedText themeColor="textSecondary" style={styles.subtitle}>
          Fill in your vehicle&apos;s details, then add photos and submit for review on the next
          screen.
        </ThemedText>
        <ListingForm submitLabel="Continue to photos" submitting={submitting} error={error} onSubmit={onSubmit} />
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { padding: Spacing.four },
  subtitle: { marginBottom: Spacing.four },
});

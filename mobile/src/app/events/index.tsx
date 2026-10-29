import { ActivityIndicator, FlatList, Image, Pressable, StyleSheet, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/constants/theme';
import { getEvents, type MobileEvent } from '@/lib/events-api';

function formatDate(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-KE', { year: 'numeric', month: 'short', day: 'numeric' });
}

function isPast(iso: string | null): boolean {
  return Boolean(iso && new Date(iso).getTime() < Date.now());
}

// Public, no auth — same getPublishedEvents() the website's /events page
// uses. Free/informational only: no RSVP, no payment, matching the
// website's own "no action button" design for events.
export default function EventsScreen() {
  const theme = useTheme();
  const router = useRouter();

  const { data, isLoading, error } = useQuery({ queryKey: ['events'], queryFn: getEvents });

  const upcoming = (data ?? []).filter((e) => !isPast(e.eventDate));
  const past = (data ?? []).filter((e) => isPast(e.eventDate));
  const sections = [...upcoming, ...past];

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: 'Events' }} />
      {isLoading ? (
        <ActivityIndicator style={styles.spinner} color={theme.brand} />
      ) : error ? (
        <ThemedText style={styles.error}>{error instanceof Error ? error.message : 'Failed to load events.'}</ThemedText>
      ) : (
        <FlatList
          data={sections}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<ThemedText style={styles.empty}>No events yet — check back soon.</ThemedText>}
          renderItem={({ item }) => (
            <EventCard event={item} past={isPast(item.eventDate)} onPress={() => router.push(`/events/${item.id}`)} />
          )}
        />
      )}
    </ThemedView>
  );
}

function EventCard({ event, past, onPress }: { event: MobileEvent; past: boolean; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected }]}
    >
      {event.imageUrl ? (
        <Image source={{ uri: event.imageUrl }} style={styles.cardImage} resizeMode="cover" />
      ) : (
        <View style={[styles.cardImage, { backgroundColor: theme.backgroundSelected }]} />
      )}
      <View style={styles.cardBody}>
        {past ? (
          <View style={[styles.pastBadge, { backgroundColor: theme.backgroundSelected }]}>
            <ThemedText type="small">Past event</ThemedText>
          </View>
        ) : null}
        <ThemedText type="smallBold" numberOfLines={2}>
          {event.title}
        </ThemedText>
        <ThemedText themeColor="textSecondary" type="small">
          {formatDate(event.eventDate)}
          {event.location ? ` · ${event.location}` : ''}
        </ThemedText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: Spacing.three, paddingTop: Spacing.three },
  spinner: { marginTop: Spacing.six },
  error: { textAlign: 'center', marginTop: Spacing.six, color: '#D14343' },
  empty: { textAlign: 'center', marginTop: Spacing.six },
  list: { paddingBottom: Spacing.six },
  card: { flexDirection: 'row', borderWidth: 1, borderRadius: 12, marginBottom: Spacing.three, overflow: 'hidden' },
  cardImage: { width: 100, height: 90 },
  cardBody: { flex: 1, padding: Spacing.three, gap: 2 },
  pastBadge: { alignSelf: 'flex-start', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, marginBottom: 2 },
});

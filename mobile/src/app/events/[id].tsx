import { ActivityIndicator, Image, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/constants/theme';
import { getEvent } from '@/lib/events-api';

function formatDate(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-KE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

function formatTime(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('en-KE', { hour: 'numeric', minute: '2-digit' });
}

// No action button of any kind — matches the website's detail page exactly
// (no RSVP, no payment, no ticketing for events).
export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const { width } = useWindowDimensions();

  const { data: event, isLoading, error } = useQuery({
    queryKey: ['event', id],
    queryFn: () => getEvent(id),
    enabled: Boolean(id),
  });

  if (isLoading) {
    return (
      <ThemedView style={styles.centered}>
        <ActivityIndicator color={theme.brand} />
      </ThemedView>
    );
  }

  if (error || !event) {
    return (
      <ThemedView style={styles.centered}>
        <ThemedText>This event couldn&apos;t be found.</ThemedText>
      </ThemedView>
    );
  }

  const facts = [
    { label: 'Date', value: formatDate(event.eventDate) },
    { label: 'Time', value: event.eventDate ? formatTime(event.eventDate) : null },
    { label: 'Location', value: event.location },
  ].filter((f) => f.value);

  return (
    <ThemedView style={{ flex: 1 }}>
      <Stack.Screen options={{ title: event.title }} />
      <ScrollView>
        {event.imageUrl ? (
          <Image source={{ uri: event.imageUrl }} style={{ width, height: 220 }} resizeMode="cover" />
        ) : (
          <View style={[{ width, height: 220 }, { backgroundColor: theme.backgroundElement }]} />
        )}
        <View style={styles.content}>
          <ThemedText type="subtitle" style={styles.title}>
            {event.title}
          </ThemedText>

          {facts.length > 0 ? (
            <View style={[styles.factsGrid, { borderColor: theme.backgroundSelected }]}>
              {facts.map((fact) => (
                <View key={fact.label} style={styles.factItem}>
                  <ThemedText themeColor="textSecondary" type="small">
                    {fact.label}
                  </ThemedText>
                  <ThemedText type="smallBold">{fact.value}</ThemedText>
                </View>
              ))}
            </View>
          ) : null}

          <ThemedText style={styles.description}>{event.description}</ThemedText>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: Spacing.four },
  title: { marginBottom: Spacing.three },
  factsGrid: { flexDirection: 'row', flexWrap: 'wrap', borderTopWidth: 1, paddingTop: Spacing.three, gap: Spacing.four, marginBottom: Spacing.four },
  factItem: { minWidth: '40%' },
  description: { lineHeight: 22 },
});

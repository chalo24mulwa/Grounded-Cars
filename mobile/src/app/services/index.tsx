import { useQueries } from '@tanstack/react-query';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/constants/theme';
import { SERVICE_PAGES, getService } from '@/lib/services-api';

export default function ServicesListScreen() {
  const theme = useTheme();
  const router = useRouter();

  const results = useQueries({
    queries: SERVICE_PAGES.map((page) => ({ queryKey: ['service', page.slug], queryFn: () => getService(page.slug) })),
  });
  const loading = results.some((r) => r.isLoading);

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: 'Services' }} />
      {loading ? (
        <ActivityIndicator style={styles.spinner} color={theme.brand} />
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {SERVICE_PAGES.map((page, i) => {
            const service = results[i]?.data;
            return (
              <Pressable
                key={page.slug}
                disabled={!service}
                onPress={() => router.push(`/services/${page.slug}`)}
                style={[styles.row, { borderColor: theme.backgroundSelected, backgroundColor: theme.backgroundElement }, !service && styles.rowDisabled]}
              >
                <ThemedText type="smallBold">{page.label}</ThemedText>
                {service ? (
                  <ThemedText themeColor="brand" style={{ fontWeight: '700' }}>
                    KES {Math.round(Number(service.price)).toLocaleString()}
                  </ThemedText>
                ) : (
                  <ThemedText themeColor="textSecondary" type="small">
                    Coming soon
                  </ThemedText>
                )}
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: Spacing.three, paddingTop: Spacing.three },
  spinner: { marginTop: Spacing.six },
  list: { paddingBottom: Spacing.six },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
    marginBottom: Spacing.two,
  },
  rowDisabled: { opacity: 0.6 },
});

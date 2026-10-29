import { useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Stack } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/constants/theme';
import { getPlans, createPlan, setPlanActive, type FeaturedPlan } from '@/lib/admin-commerce-api';
import { ApiError } from '@/lib/api-client';

export default function PlansScreen() {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [durationDays, setDurationDays] = useState('');
  const [price, setPrice] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const { data: plans, isLoading, error } = useQuery({ queryKey: ['admin-plans'], queryFn: getPlans });

  function invalidate() {
    return queryClient.invalidateQueries({ queryKey: ['admin-plans'] });
  }

  const isValid = name.trim().length >= 2 && Number(durationDays) >= 1 && Number(price) > 0;

  async function onCreate() {
    setFormError(null);
    setSubmitting(true);
    try {
      await createPlan({ name: name.trim(), durationDays: Number(durationDays), price: Number(price), currency: 'KES' });
      setName('');
      setDurationDays('');
      setPrice('');
      setShowForm(false);
      await invalidate();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  async function onToggle(plan: FeaturedPlan) {
    setTogglingId(plan.id);
    try {
      await setPlanActive(plan.id, !plan.active);
      await invalidate();
    } catch (err) {
      Alert.alert('Could not update plan', err instanceof ApiError ? err.message : 'Please try again.');
    } finally {
      setTogglingId(null);
    }
  }

  const inputStyle = [styles.input, { color: theme.text, borderColor: theme.backgroundSelected }];

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: 'Featured Plans' }} />

      <Pressable style={[styles.addButton, { backgroundColor: theme.brand }]} onPress={() => setShowForm((v) => !v)}>
        <ThemedText style={styles.addButtonText}>{showForm ? 'Cancel' : '+ New plan'}</ThemedText>
      </Pressable>

      {showForm ? (
        <View style={[styles.form, { borderColor: theme.backgroundSelected, backgroundColor: theme.backgroundElement }]}>
          <TextInput style={inputStyle} placeholder="Plan name (e.g. 7-day boost)" placeholderTextColor={theme.textSecondary} value={name} onChangeText={setName} />
          <TextInput
            style={[inputStyle, styles.formSpacing]}
            placeholder="Duration (days)"
            placeholderTextColor={theme.textSecondary}
            keyboardType="number-pad"
            value={durationDays}
            onChangeText={setDurationDays}
          />
          <TextInput
            style={[inputStyle, styles.formSpacing]}
            placeholder="Price (KES)"
            placeholderTextColor={theme.textSecondary}
            keyboardType="number-pad"
            value={price}
            onChangeText={setPrice}
          />
          {formError ? <ThemedText style={styles.error}>{formError}</ThemedText> : null}
          <Pressable
            style={[styles.submitButton, { backgroundColor: theme.brand }, (submitting || !isValid) && styles.disabled]}
            onPress={onCreate}
            disabled={submitting || !isValid}
          >
            {submitting ? <ActivityIndicator color="#fff" /> : <ThemedText style={styles.addButtonText}>Create plan</ThemedText>}
          </Pressable>
        </View>
      ) : null}

      {isLoading ? (
        <ActivityIndicator style={styles.spinner} color={theme.brand} />
      ) : error ? (
        <ThemedText style={styles.error}>{error instanceof Error ? error.message : 'Failed to load plans.'}</ThemedText>
      ) : (
        <FlatList
          data={plans ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<ThemedText style={styles.empty}>No plans yet.</ThemedText>}
          renderItem={({ item }) => (
            <View style={[styles.row, { borderColor: theme.backgroundSelected, backgroundColor: theme.backgroundElement }]}>
              <View style={{ flex: 1 }}>
                <ThemedText type="smallBold">{item.name}</ThemedText>
                <ThemedText themeColor="textSecondary" type="small">
                  {item.durationDays} days · {item.currency} {Number(item.price).toLocaleString()}
                </ThemedText>
              </View>
              <Pressable
                onPress={() => onToggle(item)}
                disabled={togglingId === item.id}
                style={[styles.toggleButton, { borderColor: item.active ? '#D14343' : theme.brand }]}
              >
                {togglingId === item.id ? (
                  <ActivityIndicator color={item.active ? '#D14343' : theme.brand} />
                ) : (
                  <ThemedText type="small" style={{ color: item.active ? '#D14343' : theme.brand, fontWeight: '700' }}>
                    {item.active ? 'Retire' : 'Activate'}
                  </ThemedText>
                )}
              </Pressable>
            </View>
          )}
        />
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: Spacing.three, paddingTop: Spacing.three },
  addButton: { borderRadius: 10, paddingVertical: Spacing.three, alignItems: 'center', marginBottom: Spacing.three },
  addButtonText: { color: '#fff', fontWeight: '700' },
  form: { borderWidth: 1, borderRadius: 10, padding: Spacing.three, marginBottom: Spacing.three },
  formSpacing: { marginTop: Spacing.two },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: Spacing.three, paddingVertical: Spacing.three, fontSize: 16 },
  error: { color: '#D14343', marginTop: Spacing.two },
  submitButton: { borderRadius: 10, paddingVertical: Spacing.three, alignItems: 'center', marginTop: Spacing.three },
  disabled: { opacity: 0.6 },
  spinner: { marginTop: Spacing.six },
  empty: { textAlign: 'center', marginTop: Spacing.six },
  list: { paddingBottom: Spacing.six },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    padding: Spacing.three,
    marginBottom: Spacing.two,
    gap: Spacing.two,
  },
  toggleButton: { borderWidth: 1, borderRadius: 8, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
});

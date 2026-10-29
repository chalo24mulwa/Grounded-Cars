import { useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Stack } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/constants/theme';
import { getModerators, createModerator, deleteModerator } from '@/lib/admin-api';
import { ApiError } from '@/lib/api-client';

// ADMIN only — there is no self-service path to MODERATOR anywhere in the
// app; this is the only place a moderator account is ever created.
export default function AdminModeratorsScreen() {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['admin-moderators'],
    queryFn: getModerators,
  });

  function invalidate() {
    return queryClient.invalidateQueries({ queryKey: ['admin-moderators'] });
  }

  async function onCreate() {
    setCreateError(null);
    setCreating(true);
    try {
      await createModerator({ name: name.trim(), email: email.trim(), password, phone: phone.trim() || undefined });
      setName('');
      setEmail('');
      setPassword('');
      setPhone('');
      setShowForm(false);
      await invalidate();
    } catch (err) {
      setCreateError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setCreating(false);
    }
  }

  function confirmDelete(id: string, name2: string) {
    Alert.alert(`Remove ${name2}?`, 'This permanently deletes their moderator account.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          setBusyId(id);
          try {
            await deleteModerator(id);
            await invalidate();
          } catch (err) {
            Alert.alert('Could not remove', err instanceof ApiError ? err.message : 'Please try again.');
          } finally {
            setBusyId(null);
          }
        },
      },
    ]);
  }

  const inputStyle = [styles.input, { color: theme.text, borderColor: theme.backgroundSelected }];

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: 'Moderators' }} />

      <Pressable style={[styles.addButton, { backgroundColor: theme.brand }]} onPress={() => setShowForm((v) => !v)}>
        <ThemedText style={styles.addButtonText}>{showForm ? 'Cancel' : '+ Add moderator'}</ThemedText>
      </Pressable>

      {showForm ? (
        <View style={[styles.form, { borderColor: theme.backgroundSelected, backgroundColor: theme.backgroundElement }]}>
          <TextInput style={inputStyle} placeholder="Full name" placeholderTextColor={theme.textSecondary} value={name} onChangeText={setName} />
          <TextInput style={inputStyle} placeholder="Email" placeholderTextColor={theme.textSecondary} autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
          <TextInput style={inputStyle} placeholder="Password" placeholderTextColor={theme.textSecondary} secureTextEntry value={password} onChangeText={setPassword} />
          <TextInput style={inputStyle} placeholder="Phone (optional)" placeholderTextColor={theme.textSecondary} keyboardType="phone-pad" value={phone} onChangeText={setPhone} />
          {createError ? <ThemedText style={styles.error}>{createError}</ThemedText> : null}
          <Pressable
            style={[styles.submitButton, { backgroundColor: theme.brand }, (creating || !name || !email || !password) && styles.disabled]}
            onPress={onCreate}
            disabled={creating || !name || !email || !password}
          >
            {creating ? <ActivityIndicator color="#fff" /> : <ThemedText style={styles.submitButtonText}>Create moderator</ThemedText>}
          </Pressable>
        </View>
      ) : null}

      {isLoading ? (
        <ActivityIndicator style={styles.spinner} color={theme.brand} />
      ) : error ? (
        <ThemedText style={styles.error}>{error instanceof Error ? error.message : 'Failed to load moderators.'}</ThemedText>
      ) : (
        <FlatList
          data={data ?? []}
          keyExtractor={(item) => item.id}
          refreshing={isFetching}
          onRefresh={refetch}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<ThemedText style={styles.empty}>No moderators yet.</ThemedText>}
          renderItem={({ item }) => (
            <View style={[styles.card, { borderColor: theme.backgroundSelected, backgroundColor: theme.backgroundElement }]}>
              <View style={{ flex: 1 }}>
                <ThemedText type="smallBold">{item.name}</ThemedText>
                <ThemedText themeColor="textSecondary" type="small">{item.email}</ThemedText>
              </View>
              {busyId === item.id ? (
                <ActivityIndicator color={theme.brand} />
              ) : (
                <Pressable onPress={() => confirmDelete(item.id, item.name)}>
                  <ThemedText style={{ color: '#D14343', fontWeight: '700' }}>Remove</ThemedText>
                </Pressable>
              )}
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
  form: { borderWidth: 1, borderRadius: 12, padding: Spacing.three, marginBottom: Spacing.three },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: Spacing.three, paddingVertical: Spacing.three, marginBottom: Spacing.two, fontSize: 16 },
  submitButton: { borderRadius: 10, paddingVertical: Spacing.three, alignItems: 'center', marginTop: Spacing.one },
  submitButtonText: { color: '#fff', fontWeight: '700' },
  disabled: { opacity: 0.6 },
  spinner: { marginTop: Spacing.six },
  error: { textAlign: 'center', marginVertical: Spacing.two, color: '#D14343' },
  empty: { textAlign: 'center', marginTop: Spacing.six },
  list: { paddingBottom: Spacing.six },
  card: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderRadius: 12, padding: Spacing.three, marginBottom: Spacing.three },
});

import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/constants/theme';
import { confirmPasswordReset } from '@/lib/account-api';
import { ApiError } from '@/lib/api-client';

// The reset email (requestPasswordReset) links to the website
// (groundedcars.co.ke/reset-password?token=...), since the backend has no
// way to know in advance whether the request came from the app or the
// browser — so this screen's token field is filled either by a deep link
// (if one is ever sent), or by the user pasting the link/token from their
// email directly. Same confirmPasswordReset() endpoint either way.
function extractToken(value: string): string {
  const trimmed = value.trim();
  try {
    const url = new URL(trimmed);
    return url.searchParams.get('token') ?? trimmed;
  } catch {
    return trimmed;
  }
}

export default function ResetPasswordScreen() {
  const theme = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ token?: string }>();
  const [tokenInput, setTokenInput] = useState(params.token ?? '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function onSubmit() {
    setError(null);
    if (newPassword !== confirmNewPassword) {
      setError('Passwords do not match.');
      return;
    }
    setSubmitting(true);
    try {
      await confirmPasswordReset({ token: extractToken(tokenInput), newPassword, confirmNewPassword });
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText type="title" style={styles.title}>
          Password updated
        </ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.subtitle}>
          Your password has been reset. Log in with your new password.
        </ThemedText>
        <Pressable style={[styles.button, { backgroundColor: theme.brand }]} onPress={() => router.replace('/login')}>
          <ThemedText style={styles.buttonText}>Log in</ThemedText>
        </Pressable>
      </ThemedView>
    );
  }

  const inputStyle = [styles.input, { color: theme.text, borderColor: theme.backgroundSelected }];

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title" style={styles.title}>
        Enter your reset link
      </ThemedText>
      <ThemedText themeColor="textSecondary" style={styles.subtitle}>
        Paste the password reset link (or code) from your email, then choose a new password.
      </ThemedText>

      <TextInput
        style={inputStyle}
        placeholder="Reset link or code"
        placeholderTextColor={theme.textSecondary}
        autoCapitalize="none"
        value={tokenInput}
        onChangeText={setTokenInput}
      />
      <TextInput
        style={inputStyle}
        placeholder="New password"
        placeholderTextColor={theme.textSecondary}
        secureTextEntry
        value={newPassword}
        onChangeText={setNewPassword}
      />
      <TextInput
        style={inputStyle}
        placeholder="Confirm new password"
        placeholderTextColor={theme.textSecondary}
        secureTextEntry
        value={confirmNewPassword}
        onChangeText={setConfirmNewPassword}
      />

      {error ? <ThemedText style={styles.error}>{error}</ThemedText> : null}

      <Pressable
        style={[styles.button, { backgroundColor: theme.brand }, submitting && styles.buttonDisabled]}
        onPress={onSubmit}
        disabled={submitting || !tokenInput || !newPassword}
      >
        {submitting ? <ActivityIndicator color="#fff" /> : <ThemedText style={styles.buttonText}>Reset password</ThemedText>}
      </Pressable>

      <View style={styles.footer}>
        <Link href="/login">
          <ThemedText themeColor="brand" style={styles.link}>
            Back to log in
          </ThemedText>
        </Link>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', paddingHorizontal: Spacing.four },
  title: { textAlign: 'center', fontSize: 28, marginBottom: Spacing.two },
  subtitle: { textAlign: 'center', marginBottom: Spacing.five },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    marginBottom: Spacing.three,
    fontSize: 16,
  },
  error: { color: '#D14343', marginBottom: Spacing.three, textAlign: 'center' },
  button: { borderRadius: 10, paddingVertical: Spacing.three, alignItems: 'center', marginTop: Spacing.two },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: Spacing.five },
  link: { fontWeight: '700' },
});

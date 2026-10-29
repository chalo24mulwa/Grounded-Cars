import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/constants/theme';
import { requestPasswordReset } from '@/lib/account-api';
import { ApiError } from '@/lib/api-client';

// Same requestPasswordReset() endpoint the website's /forgot-password form
// submits to — deliberately resolves the same way whether or not the email
// is registered (see the server route's own comment), so this screen never
// reveals which emails have accounts.
export default function ForgotPasswordScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function onSubmit() {
    setError(null);
    setSubmitting(true);
    try {
      await requestPasswordReset(email.trim());
      setSent(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText type="title" style={styles.title}>
          Check your email
        </ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.subtitle}>
          If an account exists for {email.trim()}, we&apos;ve sent a link to reset your password.
          Open it from your phone or computer to finish resetting your password, then come back
          here to log in.
        </ThemedText>
        <Pressable
          style={[styles.button, { backgroundColor: theme.brand }]}
          onPress={() => router.replace('/login')}
        >
          <ThemedText style={styles.buttonText}>Back to log in</ThemedText>
        </Pressable>
        <View style={styles.footer}>
          <ThemedText themeColor="textSecondary">Have a reset link already? </ThemedText>
          <Link href="/reset-password">
            <ThemedText themeColor="brand" style={styles.link}>
              Enter it here
            </ThemedText>
          </Link>
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title" style={styles.title}>
        Reset your password
      </ThemedText>
      <ThemedText themeColor="textSecondary" style={styles.subtitle}>
        Enter your account email and we&apos;ll send you a link to reset your password.
      </ThemedText>

      <TextInput
        style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
        placeholder="Email address"
        placeholderTextColor={theme.textSecondary}
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />

      {error ? <ThemedText style={styles.error}>{error}</ThemedText> : null}

      <Pressable
        style={[styles.button, { backgroundColor: theme.brand }, submitting && styles.buttonDisabled]}
        onPress={onSubmit}
        disabled={submitting || !email}
      >
        {submitting ? <ActivityIndicator color="#fff" /> : <ThemedText style={styles.buttonText}>Send reset link</ThemedText>}
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

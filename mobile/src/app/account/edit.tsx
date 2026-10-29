import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth-context';
import { getProfile, updateProfile, changePassword } from '@/lib/account-api';
import { ApiError } from '@/lib/api-client';

// Same updateProfile()/changePassword() the website's /account page submits
// to. Email is never editable here either — same "out of scope, would need
// re-verification" rule as the website (see auth-service.ts).
export default function EditAccountScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { status } = useAuth();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSaved, setProfileSaved] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSaved, setPasswordSaved] = useState(false);

  useEffect(() => {
    if (status !== 'authenticated') return;
    void getProfile()
      .then((profile) => {
        setName(profile.name);
        setPhone(profile.phone ?? '');
      })
      .finally(() => setLoading(false));
  }, [status]);

  if (status === 'unauthenticated') return <Redirect href="/login" />;

  async function onSaveProfile() {
    setProfileError(null);
    setProfileSaved(false);
    setSavingProfile(true);
    try {
      await updateProfile({ name: name.trim(), phone: phone.trim() || undefined });
      setProfileSaved(true);
    } catch (err) {
      setProfileError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSavingProfile(false);
    }
  }

  async function onChangePassword() {
    setPasswordError(null);
    setPasswordSaved(false);
    if (newPassword !== confirmNewPassword) {
      setPasswordError('Passwords do not match.');
      return;
    }
    setChangingPassword(true);
    try {
      await changePassword({ currentPassword, newPassword, confirmNewPassword });
      setPasswordSaved(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
    } catch (err) {
      setPasswordError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setChangingPassword(false);
    }
  }

  if (loading) {
    return (
      <ThemedView style={styles.centered}>
        <ActivityIndicator color={theme.brand} />
      </ThemedView>
    );
  }

  const inputStyle = [styles.input, { color: theme.text, borderColor: theme.backgroundSelected }];

  return (
    <ScrollView>
      <ThemedView style={styles.container}>
        <ThemedText type="smallBold" style={styles.sectionTitle}>
          Profile
        </ThemedText>
        <TextInput style={inputStyle} placeholder="Full name" placeholderTextColor={theme.textSecondary} value={name} onChangeText={setName} />
        <TextInput
          style={inputStyle}
          placeholder="Phone number"
          placeholderTextColor={theme.textSecondary}
          keyboardType="phone-pad"
          value={phone}
          onChangeText={setPhone}
        />
        {profileError ? <ThemedText style={styles.error}>{profileError}</ThemedText> : null}
        {profileSaved ? <ThemedText style={styles.success}>Profile updated.</ThemedText> : null}
        <Pressable
          style={[styles.button, { backgroundColor: theme.brand }, savingProfile && styles.buttonDisabled]}
          onPress={onSaveProfile}
          disabled={savingProfile || !name}
        >
          {savingProfile ? <ActivityIndicator color="#fff" /> : <ThemedText style={styles.buttonText}>Save profile</ThemedText>}
        </Pressable>

        <View style={[styles.divider, { backgroundColor: theme.backgroundSelected }]} />

        <ThemedText type="smallBold" style={styles.sectionTitle}>
          Change password
        </ThemedText>
        <TextInput
          style={inputStyle}
          placeholder="Current password"
          placeholderTextColor={theme.textSecondary}
          secureTextEntry
          value={currentPassword}
          onChangeText={setCurrentPassword}
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
        {passwordError ? <ThemedText style={styles.error}>{passwordError}</ThemedText> : null}
        {passwordSaved ? <ThemedText style={styles.success}>Password changed.</ThemedText> : null}
        <Pressable
          style={[styles.button, { backgroundColor: theme.brand }, changingPassword && styles.buttonDisabled]}
          onPress={onChangePassword}
          disabled={changingPassword || !currentPassword || !newPassword}
        >
          {changingPassword ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <ThemedText style={styles.buttonText}>Change password</ThemedText>
          )}
        </Pressable>

        <Pressable style={styles.backLink} onPress={() => router.back()}>
          <ThemedText themeColor="brand">Back to account</ThemedText>
        </Pressable>
      </ThemedView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container: { padding: Spacing.four },
  sectionTitle: { marginBottom: Spacing.three },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    marginBottom: Spacing.three,
    fontSize: 16,
  },
  error: { color: '#D14343', marginBottom: Spacing.three },
  success: { color: '#2E7D4F', marginBottom: Spacing.three },
  button: { borderRadius: 10, paddingVertical: Spacing.three, alignItems: 'center' },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  divider: { height: 1, marginVertical: Spacing.five },
  backLink: { marginTop: Spacing.five, alignItems: 'center' },
});

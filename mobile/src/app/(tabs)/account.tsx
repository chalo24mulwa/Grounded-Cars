import { Pressable, StyleSheet, View } from 'react-native';
import { Link } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth-context';
import { Spacing } from '@/constants/theme';

const ROLE_LABELS: Record<string, string> = {
  BUYER: 'Buyer',
  SELLER: 'Seller',
  ADMIN: 'Admin',
  MODERATOR: 'Moderator',
};

export default function AccountScreen() {
  const theme = useTheme();
  const { status, user, logout } = useAuth();

  if (status !== 'authenticated' || !user) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText type="subtitle" style={styles.name}>
          Sign in to your account
        </ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.promptSubtitle}>
          Save favorites, manage listings, and more.
        </ThemedText>
        <Link href="/login" asChild>
          <Pressable style={[styles.logoutButton, { backgroundColor: theme.brand, borderColor: theme.brand }]}>
            <ThemedText style={styles.loginButtonText}>Log in</ThemedText>
          </Pressable>
        </Link>
        <Link href="/register" asChild>
          <Pressable style={[styles.logoutButton, { borderColor: theme.brand, marginTop: Spacing.two }]}>
            <ThemedText themeColor="brand" style={styles.logoutText}>
              Create an account
            </ThemedText>
          </Pressable>
        </Link>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.avatar, { backgroundColor: theme.brand }]}>
        <ThemedText style={styles.avatarText}>{(user?.name ?? '?').charAt(0).toUpperCase()}</ThemedText>
      </View>
      <ThemedText type="subtitle" style={styles.name}>
        {user?.name}
      </ThemedText>
      <ThemedText themeColor="textSecondary">{user?.email}</ThemedText>
      <View style={[styles.roleBadge, { backgroundColor: theme.backgroundElement }]}>
        <ThemedText type="small">{ROLE_LABELS[user?.role ?? ''] ?? user?.role}</ThemedText>
      </View>

      <Pressable style={[styles.logoutButton, { borderColor: theme.brand }]} onPress={logout}>
        <ThemedText themeColor="brand" style={styles.logoutText}>
          Log out
        </ThemedText>
      </Pressable>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', paddingTop: Spacing.six, paddingHorizontal: Spacing.four },
  avatar: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.three },
  avatarText: { color: '#fff', fontSize: 28, fontWeight: '700' },
  name: { marginBottom: 2, textAlign: 'center' },
  promptSubtitle: { textAlign: 'center', marginTop: Spacing.one, marginBottom: Spacing.five },
  loginButtonText: { color: '#fff', fontWeight: '700' },
  roleBadge: { borderRadius: 12, paddingHorizontal: Spacing.three, paddingVertical: Spacing.one, marginTop: Spacing.three },
  logoutButton: { borderWidth: 1, borderRadius: 10, paddingVertical: Spacing.three, paddingHorizontal: Spacing.five, marginTop: Spacing.six },
  logoutText: { fontWeight: '700' },
});

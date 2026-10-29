import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth-context';
import { Spacing } from '@/constants/theme';
import { becomeSeller } from '@/lib/account-api';
import { ApiError } from '@/lib/api-client';

const ROLE_LABELS: Record<string, string> = {
  BUYER: 'Buyer',
  SELLER: 'Seller',
  ADMIN: 'Admin',
  MODERATOR: 'Moderator',
};

function MenuRow({ label, onPress }: { label: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[styles.menuRow, { borderColor: theme.backgroundSelected, backgroundColor: theme.backgroundElement }]}
    >
      <ThemedText>{label}</ThemedText>
      <ThemedText themeColor="textSecondary">{'›'}</ThemedText>
    </Pressable>
  );
}

export default function AccountScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { status, user, logout, refreshUser } = useAuth();
  const [becomingSeller, setBecomingSeller] = useState(false);
  const [becomeSellerError, setBecomeSellerError] = useState<string | null>(null);

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
        <Link href="/events" asChild>
          <Pressable style={styles.contactLink}>
            <ThemedText themeColor="brand">Upcoming Events</ThemedText>
          </Pressable>
        </Link>
        <Link href="/contact" asChild>
          <Pressable style={styles.contactLink}>
            <ThemedText themeColor="brand">Contact Grounded Cars</ThemedText>
          </Pressable>
        </Link>
      </ThemedView>
    );
  }

  async function onBecomeSeller() {
    setBecomeSellerError(null);
    setBecomingSeller(true);
    try {
      await becomeSeller();
      await refreshUser();
    } catch (err) {
      setBecomeSellerError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setBecomingSeller(false);
    }
  }

  const canSell = user.role === 'SELLER' || user.role === 'ADMIN' || user.role === 'MODERATOR';

  return (
    <ScrollView>
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

        <View style={styles.menu}>
          <MenuRow label="Favorites" onPress={() => router.push('/favorites')} />
          {canSell ? (
            <>
              <MenuRow label="My Listings" onPress={() => router.push('/my-listings')} />
              <MenuRow label="Inquiries" onPress={() => router.push('/my-listings/inquiries')} />
            </>
          ) : (
            <>
              <Pressable
                onPress={onBecomeSeller}
                disabled={becomingSeller}
                style={[styles.menuRow, { borderColor: theme.brand, backgroundColor: theme.backgroundElement }]}
              >
                <ThemedText themeColor="brand" style={{ fontWeight: '700' }}>
                  Become a seller
                </ThemedText>
                {becomingSeller ? <ActivityIndicator color={theme.brand} /> : <ThemedText themeColor="brand">{'›'}</ThemedText>}
              </Pressable>
              {becomeSellerError ? <ThemedText style={styles.error}>{becomeSellerError}</ThemedText> : null}
            </>
          )}
          {canSell ? <MenuRow label="Featured Listings" onPress={() => router.push('/featured')} /> : null}
          <MenuRow label="Events" onPress={() => router.push('/events')} />
          <MenuRow label="CSR Initiatives" onPress={() => router.push('/csr')} />
          <MenuRow label="Services" onPress={() => router.push('/services')} />
          <MenuRow label="Insurance" onPress={() => router.push('/insurance')} />
          <MenuRow label="Edit profile" onPress={() => router.push('/account/edit')} />
          <MenuRow label="Contact Grounded Cars" onPress={() => router.push('/contact')} />
          {user.role === 'ADMIN' || user.role === 'MODERATOR' ? (
            <MenuRow label="Admin" onPress={() => router.push('/admin')} />
          ) : null}
        </View>

        <Pressable style={[styles.logoutButton, { borderColor: theme.brand }]} onPress={logout}>
          <ThemedText themeColor="brand" style={styles.logoutText}>
            Log out
          </ThemedText>
        </Pressable>
      </ThemedView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', paddingTop: Spacing.six, paddingHorizontal: Spacing.four, paddingBottom: Spacing.six },
  avatar: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.three },
  avatarText: { color: '#fff', fontSize: 28, fontWeight: '700' },
  name: { marginBottom: 2, textAlign: 'center' },
  promptSubtitle: { textAlign: 'center', marginTop: Spacing.one, marginBottom: Spacing.five },
  loginButtonText: { color: '#fff', fontWeight: '700' },
  roleBadge: { borderRadius: 12, paddingHorizontal: Spacing.three, paddingVertical: Spacing.one, marginTop: Spacing.three },
  menu: { width: '100%', marginTop: Spacing.five, gap: Spacing.two },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
  },
  error: { color: '#D14343', marginTop: Spacing.one },
  logoutButton: { borderWidth: 1, borderRadius: 10, paddingVertical: Spacing.three, paddingHorizontal: Spacing.five, marginTop: Spacing.six },
  logoutText: { fontWeight: '700' },
  contactLink: { marginTop: Spacing.five },
});

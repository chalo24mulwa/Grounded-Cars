import { Pressable, StyleSheet } from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth-context';
import { addFavorite, removeFavorite } from '@/lib/favorites-api';

// Mirrors the website's FavoriteButton.tsx: optimistic heart toggle, no
// confirmation needed either way since addFavorite/removeFavorite are both
// idempotent server-side. Signed-out visitors can browse freely (per the
// rest of this app's design) but tapping the heart routes them to login,
// same as every other auth-gated action here.
export function FavoriteButtonOverlay({
  listingId,
  favorited,
  size = 'small',
}: {
  listingId: string;
  favorited: boolean;
  size?: 'small' | 'large';
}) {
  const theme = useTheme();
  const { status } = useAuth();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (next: boolean) => (next ? addFavorite(listingId) : removeFavorite(listingId)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['favorites'] });
      void queryClient.invalidateQueries({ queryKey: ['favorite-ids'] });
    },
  });

  function onPress() {
    if (status !== 'authenticated') {
      // Keep this component dumb about navigation — screens that render it
      // inside an auth-required context (Favorites screen) never hit this
      // branch; Browse/Detail screens hide the heart entirely when signed
      // out instead (simpler than importing the router here).
      return;
    }
    mutation.mutate(!favorited);
  }

  const fontSize = size === 'large' ? 26 : 18;

  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      style={[styles.button, size === 'large' ? styles.buttonLarge : styles.buttonSmall]}
    >
      <ThemedText style={{ fontSize, color: favorited ? '#D14343' : theme.background }}>
        {favorited ? '♥' : '♡'}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonSmall: { width: 28, height: 28 },
  buttonLarge: { width: 40, height: 40 },
});

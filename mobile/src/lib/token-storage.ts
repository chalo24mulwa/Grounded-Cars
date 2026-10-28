import * as SecureStore from 'expo-secure-store';

// Keychain (iOS) / encrypted SharedPreferences (Android)-backed storage for
// the refresh token — this is what the website's httpOnly session cookie
// does for the browser: survives app restarts, never readable by other
// apps. The access token is deliberately NOT persisted here; it's short-
// lived (15 min) and kept in memory only (see auth-context.tsx), re-minted
// from the refresh token on cold start.
const REFRESH_TOKEN_KEY = 'groundedcars.refreshToken';

export async function getStoredRefreshToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function setStoredRefreshToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token);
}

export async function clearStoredRefreshToken(): Promise<void> {
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
}

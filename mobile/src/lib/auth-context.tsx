import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { apiFetch, setAccessToken, registerRefreshHandler, ApiError } from '@/lib/api-client';
import { getStoredRefreshToken, setStoredRefreshToken, clearStoredRefreshToken } from '@/lib/token-storage';
import { decodeAccessToken, type AccessTokenPayload } from '@/lib/jwt';

type MobileAuthTokens = { accessToken: string; refreshToken: string; expiresIn: number };

type AuthUser = Pick<AccessTokenPayload, 'sub' | 'role' | 'email' | 'name'>;

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

type AuthContextValue = {
  status: AuthStatus;
  user: AuthUser | null;
  login: (email: string, password: string) => Promise<void>;
  register: (input: { name: string; email: string; phone: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
  /** Surfaced so screens can show the exact server-chosen message. */
  error: string | null;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function applyTokens(tokens: MobileAuthTokens): AuthUser | null {
  setAccessToken(tokens.accessToken);
  void setStoredRefreshToken(tokens.refreshToken);
  const payload = decodeAccessToken(tokens.accessToken);
  if (!payload) return null;
  return { sub: payload.sub, role: payload.role, email: payload.email, name: payload.name };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [error, setError] = useState<string | null>(null);

  // One refresh flow, shared by app-boot silent login AND api-client's
  // automatic refresh-on-401 retry (registered below) — a single source of
  // truth for "exchange the stored refresh token for a new token pair."
  async function attemptRefresh(): Promise<string | null> {
    const stored = await getStoredRefreshToken();
    if (!stored) return null;
    try {
      const tokens = await apiFetch<MobileAuthTokens>('/api/mobile/auth/refresh', {
        method: 'POST',
        body: { refreshToken: stored },
        skipAuth: true,
      });
      const nextUser = applyTokens(tokens);
      setUser(nextUser);
      setStatus('authenticated');
      return tokens.accessToken;
    } catch {
      await clearStoredRefreshToken();
      setAccessToken(null);
      setUser(null);
      setStatus('unauthenticated');
      return null;
    }
  }

  useEffect(() => {
    registerRefreshHandler(attemptRefresh);
    void attemptRefresh().then((token) => {
      if (!token) setStatus('unauthenticated');
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function login(email: string, password: string) {
    setError(null);
    try {
      const tokens = await apiFetch<MobileAuthTokens>('/api/mobile/auth/login', {
        method: 'POST',
        body: { email, password },
        skipAuth: true,
      });
      setUser(applyTokens(tokens));
      setStatus('authenticated');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
      throw err;
    }
  }

  async function register(input: { name: string; email: string; phone: string; password: string }) {
    setError(null);
    try {
      const tokens = await apiFetch<MobileAuthTokens>('/api/mobile/auth/register', {
        method: 'POST',
        body: input,
        skipAuth: true,
      });
      setUser(applyTokens(tokens));
      setStatus('authenticated');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
      throw err;
    }
  }

  async function logout() {
    const stored = await getStoredRefreshToken();
    if (stored) {
      // Best-effort — logging out locally must never block on the network.
      void apiFetch('/api/mobile/auth/logout', { method: 'POST', body: { refreshToken: stored }, skipAuth: true }).catch(
        () => undefined
      );
    }
    await clearStoredRefreshToken();
    setAccessToken(null);
    setUser(null);
    setStatus('unauthenticated');
  }

  const value = useMemo(
    () => ({ status, user, login, register, logout, error }),
    [status, user, error]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}

// Reads an access token's payload for DISPLAY purposes only (name/role/
// email shown in the UI) — this never verifies the signature, so it must
// never be used for an authorization decision. Every request that actually
// matters is re-verified server-side (withMobileAuth/verifyMobileAccessToken
// in the backend), the same trust boundary the website's own session.user
// relies on; this is purely a convenience so the app doesn't need an extra
// round trip just to know who's signed in.
export type AccessTokenPayload = {
  sub: string;
  role: 'BUYER' | 'SELLER' | 'ADMIN' | 'MODERATOR';
  email: string;
  name: string;
  exp: number;
};

export function decodeAccessToken(token: string): AccessTokenPayload | null {
  try {
    const [, payloadSegment] = token.split('.');
    if (!payloadSegment) return null;
    const normalized = payloadSegment.replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(
      atob(normalized)
        .split('')
        .map((c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'))
        .join('')
    );
    return JSON.parse(json) as AccessTokenPayload;
  } catch {
    return null;
  }
}

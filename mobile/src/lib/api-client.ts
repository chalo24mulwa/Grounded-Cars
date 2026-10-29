// Thin fetch wrapper for every src/app/api/mobile/** call. Mirrors the
// backend's own mobileErrorResponse() shape ({ error: string }) so every
// screen can show the same message the server chose, rather than a generic
// "request failed."
//
// No secret lives in this file or anywhere in the bundle — only the short-
// lived access token, held in memory (see auth-context.tsx), is ever
// attached, as a Bearer header.

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'https://groundedcars.co.ke';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Thrown when a request got a 401 and the one refresh-and-retry attempt
 * (see apiFetch below) also failed — the caller should treat this as
 * "logged out" and route to the login screen. */
export class SessionExpiredError extends Error {
  constructor() {
    super('Your session has expired. Please log in again.');
    this.name = 'SessionExpiredError';
  }
}

let currentAccessToken: string | null = null;
export function setAccessToken(token: string | null): void {
  currentAccessToken = token;
}

// auth-context.tsx registers its own refresh-token flow here at startup.
// Kept as an indirection (rather than importing auth-context from here)
// so this module has no circular dependency on the context that uses it.
let refreshHandler: (() => Promise<string | null>) | null = null;
export function registerRefreshHandler(fn: () => Promise<string | null>): void {
  refreshHandler = fn;
}

type ApiFetchOptions = Omit<RequestInit, 'body'> & {
  body?: unknown;
  /** Skips attaching the Authorization header and the refresh-on-401 retry — for the public auth endpoints themselves. */
  skipAuth?: boolean;
};

async function parseJsonSafe(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const { skipAuth, body, headers, ...rest } = options;

  async function doFetch(): Promise<Response> {
    const finalHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(headers as Record<string, string> | undefined),
    };
    if (!skipAuth && currentAccessToken) {
      finalHeaders.Authorization = `Bearer ${currentAccessToken}`;
    }
    return fetch(`${API_BASE_URL}${path}`, {
      ...rest,
      headers: finalHeaders,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  let res = await doFetch();

  if (res.status === 401 && !skipAuth && refreshHandler) {
    const newToken = await refreshHandler();
    if (!newToken) throw new SessionExpiredError();
    res = await doFetch();
    if (res.status === 401) throw new SessionExpiredError();
  }

  if (!res.ok) {
    const data = (await parseJsonSafe(res)) as { error?: string } | null;
    throw new ApiError(res.status, data?.error ?? 'Something went wrong. Please try again.');
  }

  if (res.status === 204) return undefined as T;
  return (await parseJsonSafe(res)) as T;
}

/**
 * Multipart upload variant of apiFetch — used only for listing photo
 * uploads. Deliberately never sets Content-Type itself: fetch/React
 * Native's multipart implementation must generate the boundary, which it
 * can only do when it owns the header. Same auth-header/refresh-on-401
 * retry behavior as apiFetch.
 */
export async function apiUpload<T>(path: string, formData: FormData): Promise<T> {
  return apiUploadWithMethod(path, formData, 'POST');
}

/**
 * Same as apiUpload, but lets the caller choose POST/PATCH — for admin
 * content-management screens whose "create" and "update" routes are both
 * multipart (text fields + an optional replacement image) but differ only
 * in HTTP method.
 */
export async function apiUploadWithMethod<T>(
  path: string,
  formData: FormData,
  method: 'POST' | 'PATCH'
): Promise<T> {
  async function doFetch(): Promise<Response> {
    const headers: Record<string, string> = {};
    if (currentAccessToken) headers.Authorization = `Bearer ${currentAccessToken}`;
    return fetch(`${API_BASE_URL}${path}`, { method, headers, body: formData });
  }

  let res = await doFetch();

  if (res.status === 401 && refreshHandler) {
    const newToken = await refreshHandler();
    if (!newToken) throw new SessionExpiredError();
    res = await doFetch();
    if (res.status === 401) throw new SessionExpiredError();
  }

  if (!res.ok) {
    const data = (await parseJsonSafe(res)) as { error?: string } | null;
    throw new ApiError(res.status, data?.error ?? 'Something went wrong. Please try again.');
  }

  if (res.status === 204) return undefined as T;
  return (await parseJsonSafe(res)) as T;
}

import { handlers } from "@/lib/auth";

// Mounts Auth.js's own route handlers (sign-in, callback, CSRF, session,
// etc.) at the framework's standard /api/auth/* paths. The Credentials
// provider never needed this — registerAction/loginAction call signIn()
// directly server-side — but any OAuth provider fundamentally requires a
// real HTTP redirect/callback endpoint, since the round trip goes through
// Google's own servers, not just ours. Google's callback specifically
// lands at /api/auth/callback/google (see GOOGLE_CLIENT setup docs).
export const { GET, POST } = handlers;

import "server-only";
import { siteConfig } from "@/config/site";

// ----------------------------------------------------------------------------
// Provider-agnostic email service (Phase 8). This is the ONLY module that
// knows how to actually send an email — nothing else in the app talks to an
// email provider's API or SMTP directly, same convention as mpesa.ts owning
// all Daraja calls and storage.ts owning all file writes. Swapping providers
// later (or wiring up a real one for the first time) means editing this one
// file's `sendViaProvider()`, never any call site.
//
// EMAIL_PROVIDER selects the backend:
//   - "console" (default): logs the email instead of sending it. This is
//     what every environment uses today, the same documented state as
//     password-reset links (see password-reset-service.ts) — no real
//     provider has been chosen yet. Always "succeeds," so callers can be
//     written exactly as they will be once a real provider is live.
//   - "resend": a real HTTP call to Resend's API (chosen because it's a
//     plain REST POST — no SDK dependency needed, matching how mpesa.ts
//     calls Safaricom with raw fetch rather than an SDK). Needs
//     RESEND_API_KEY and EMAIL_FROM.
//
// send() NEVER throws. A failed/misconfigured provider is logged and
// reported back as { sent: false } — every call site treats email as a
// best-effort side effect of a real state change that has already
// committed, so a broken provider can never corrupt marketplace data or
// block the action that triggered the email. This is the same "outside the
// transaction, failure never rolls back a real change" rule already applied
// to in-app notifications (see listing-service.ts's SOLD notification).
// ----------------------------------------------------------------------------

export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

export type EmailSendResult = { sent: boolean; error?: string };

type EmailProvider = "console" | "resend";

function getProvider(): EmailProvider {
  const raw = process.env.EMAIL_PROVIDER?.toLowerCase();
  return raw === "resend" ? "resend" : "console";
}

export function isEmailConfigured(): boolean {
  const provider = getProvider();
  if (provider === "console") return true;
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

async function sendViaConsole(message: EmailMessage): Promise<EmailSendResult> {
  console.log(
    `[email:console] To: ${message.to} | Subject: ${message.subject}\n${message.text}`
  );
  return { sent: true };
}

async function sendViaResend(message: EmailMessage): Promise<EmailSendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) {
    return { sent: false, error: "Resend is not configured (missing RESEND_API_KEY/EMAIL_FROM)." };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: message.to,
        subject: message.subject,
        html: message.html,
        text: message.text,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { sent: false, error: `Resend responded ${res.status}: ${body.slice(0, 200)}` };
    }
    return { sent: true };
  } catch (error) {
    return { sent: false, error: error instanceof Error ? error.message : "Unknown email error" };
  }
}

/**
 * Sends one email. Never throws — see module doc above. Every call site
 * should call this AFTER the real database change it's reporting on has
 * already committed, never inside the same transaction.
 */
export async function sendEmail(message: EmailMessage): Promise<EmailSendResult> {
  try {
    const provider = getProvider();
    const result = provider === "resend" ? await sendViaResend(message) : await sendViaConsole(message);
    if (!result.sent) {
      console.error(`[email] Failed to send to ${message.to}: ${result.error}`);
    }
    return result;
  } catch (error) {
    // Belt-and-braces — sendViaResend/sendViaConsole already catch their own
    // errors, but this outer guard is what makes the "never throws" contract
    // absolute even if a future provider implementation forgets to.
    console.error(`[email] Unexpected error sending to ${message.to}:`, error);
    return { sent: false, error: error instanceof Error ? error.message : "Unknown email error" };
  }
}

/** Shared HTML wrapper so every template looks like it came from the same
 * product, without each template hand-rolling layout markup. */
export function renderEmailLayout(bodyHtml: string): string {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#f8fafc;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
    <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px;border:1px solid #e2e8f0;">
      <p style="margin:0 0 20px;font-size:18px;font-weight:700;color:#0f172a;">${siteConfig.name}</p>
      ${bodyHtml}
      <p style="margin:32px 0 0;font-size:12px;color:#94a3b8;">
        ${siteConfig.legalName} &middot; ${siteConfig.contactPhone}
      </p>
    </div>
  </body>
</html>`;
}

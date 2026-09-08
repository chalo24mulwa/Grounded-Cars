import "server-only";
import { renderEmailLayout } from "@/lib/email";

// ----------------------------------------------------------------------------
// One reusable email template, not one bespoke design per notification type.
// Every notification email is a title, a message, and an optional call-to-
// action button — the marketplace-event copy itself (what to say) lives in
// notification-service.ts's NOTIFICATION_COPY; this module only knows how to
// lay that content out as an email. Keeping "what to say" and "how to render
// it as HTML" separate is what makes this reusable across every current and
// future notification type without a new template file each time.
// ----------------------------------------------------------------------------

// Titles/messages can embed user-authored free text (a listing title, an
// admin's rejection reason) — never trusted as safe HTML. Escaped before
// interpolation so an email client that renders HTML can't be made to run
// markup/script from data a seller or admin typed into a text field.
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildNotificationEmail({
  title,
  message,
  ctaLabel,
  ctaUrl,
}: {
  title: string;
  message: string;
  ctaLabel?: string;
  ctaUrl?: string;
}): { subject: string; html: string; text: string } {
  const button =
    ctaLabel && ctaUrl
      ? `<p style="margin:24px 0 0;">
           <a href="${escapeHtml(ctaUrl)}" style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;padding:10px 20px;border-radius:8px;font-size:14px;font-weight:600;">${escapeHtml(ctaLabel)}</a>
         </p>`
      : "";

  const html = renderEmailLayout(`
    <p style="margin:0 0 12px;font-size:16px;font-weight:600;color:#0f172a;">${escapeHtml(title)}</p>
    <p style="margin:0;font-size:14px;line-height:1.6;color:#334155;">${escapeHtml(message)}</p>
    ${button}
  `);

  const text = ctaLabel && ctaUrl ? `${title}\n\n${message}\n\n${ctaLabel}: ${ctaUrl}` : `${title}\n\n${message}`;

  return { subject: title, html, text };
}

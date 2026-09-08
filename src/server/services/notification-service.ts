import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAuth, AuthorizationError } from "@/server/authorization/ownership";
import { sendEmail } from "@/lib/email";
import { buildNotificationEmail } from "@/lib/email-templates";

// ----------------------------------------------------------------------------
// Notification architecture (Phase 8, extending the Phase 6 foundation).
// `notify()` is the ONLY way anything in the app creates a notification or
// sends a notification-triggered email — every call site below (inquiries,
// listing status changes, featured subscriptions, admin user management,
// the expiry/reminder sweep) goes through this one function, never writes a
// Notification row or calls sendEmail() directly. That's what keeps
// notification copy, the in-app/email preference gate, and the "required"
// exemption in exactly one place instead of scattered per feature.
//
// Two independent, deliberately decoupled channels:
//   - In-app: a Notification row. Always cheap, always safe to write.
//   - Email: best-effort, via lib/email.ts, which never throws — a broken
//     or unconfigured email provider can therefore never corrupt a real
//     state change, since notify() is always called AFTER that change has
//     already committed (see every call site).
// Both channels are gated by NotificationPreference, except for
// REQUIRED_TYPES (operationally/legally necessary — e.g. your account was
// suspended), which always fire regardless of preference. Missing
// preference row == both channels enabled (the default).
// ----------------------------------------------------------------------------

export type NotificationType =
  | "INQUIRY_RECEIVED"
  | "INQUIRY_REPLIED"
  | "FAVORITE_LISTING_SOLD"
  | "LISTING_SOLD"
  | "LISTING_APPROVED"
  | "LISTING_REJECTED"
  | "SUBSCRIPTION_ACTIVATED"
  | "SUBSCRIPTION_EXPIRING_SOON"
  | "SUBSCRIPTION_EXPIRED"
  | "PAYMENT_FAILED"
  | "ACCOUNT_STATUS_CHANGED";

type NotificationVars = Record<string, string | number>;

// Notifications a user cannot opt out of, on either channel — account
// status and payment-failure notices are operationally/legally necessary,
// not preference-gated marketing. Every other type respects
// NotificationPreference.
const REQUIRED_TYPES: ReadonlySet<NotificationType> = new Set([
  "ACCOUNT_STATUS_CHANGED",
  "PAYMENT_FAILED",
]);

type CopyBuilder = (vars: NotificationVars) => {
  title: string;
  message: string;
  ctaLabel?: string;
  ctaPath?: string;
};

const str = (v: string | number | undefined, fallback = "") => (v === undefined ? fallback : String(v));

// The single source of truth for what every notification type says, in both
// the in-app row and the email — a future UI never needs its own per-type
// copy logic, it just renders `title`/`message` as stored.
const NOTIFICATION_COPY: Record<NotificationType, CopyBuilder> = {
  INQUIRY_RECEIVED: (v) => ({
    title: "New inquiry received",
    message: `You have a new inquiry about "${str(v.listingTitle)}". Reply from your seller dashboard.`,
    ctaLabel: "View inquiry",
    ctaPath: "/dashboard/inquiries",
  }),
  INQUIRY_REPLIED: (v) => ({
    title: "Seller replied to your inquiry",
    message: `The seller replied about "${str(v.listingTitle, "your inquiry")}" — check it for details.`,
    ctaLabel: "View listing",
    ctaPath: v.listingSlug ? `/cars/${str(v.listingSlug)}` : undefined,
  }),
  FAVORITE_LISTING_SOLD: (v) => ({
    title: "A favorited listing was sold",
    message: `"${str(v.listingTitle)}" that you favorited has been marked as sold.`,
    ctaLabel: "Browse similar cars",
    ctaPath: "/cars",
  }),
  LISTING_SOLD: (v) => ({
    title: "Listing marked as sold",
    message: `"${str(v.listingTitle)}" has been marked as sold and removed from active search results.`,
    ctaLabel: "View my listings",
    ctaPath: "/dashboard/listings?status=SOLD",
  }),
  LISTING_APPROVED: (v) => ({
    title: "Your listing was approved",
    message: `"${str(v.listingTitle)}" is now live on the marketplace.`,
    ctaLabel: "View my listings",
    ctaPath: "/dashboard/listings?status=ACTIVE",
  }),
  LISTING_REJECTED: (v) => ({
    title: "Changes requested on your listing",
    message: `"${str(v.listingTitle)}" needs changes before it can go live: ${str(v.reason)}`,
    ctaLabel: "Update listing",
    ctaPath: "/dashboard/listings?status=DRAFT",
  }),
  SUBSCRIPTION_ACTIVATED: (v) => ({
    title: "Your listing is now featured",
    message: `"${str(v.listingTitle)}" is now featured (${str(v.planName)}) until ${str(v.expiresAt)}.`,
    ctaLabel: "View featured listings",
    ctaPath: "/dashboard/featured",
  }),
  SUBSCRIPTION_EXPIRING_SOON: (v) => ({
    title: `Featured listing expires in ${str(v.daysRemaining)} day${v.daysRemaining === 1 ? "" : "s"}`,
    message: `"${str(v.listingTitle)}"'s featured placement expires in ${str(v.daysRemaining)} day${v.daysRemaining === 1 ? "" : "s"}. Renew to keep top placement.`,
    ctaLabel: "Renew featured listing",
    ctaPath: "/dashboard/featured",
  }),
  SUBSCRIPTION_EXPIRED: (v) => ({
    title: "Featured subscription expired",
    message: `"${str(v.listingTitle)}" is no longer featured. It remains listed as a normal, active listing.`,
    ctaLabel: "Feature it again",
    ctaPath: "/dashboard/featured",
  }),
  PAYMENT_FAILED: (v) => ({
    title: "Payment failed",
    message: `Your payment of ${str(v.currency, "KES")} ${str(v.amount)} for featuring "${str(v.listingTitle)}" was not successful. You have not been charged.`,
    ctaLabel: "Try again",
    ctaPath: "/dashboard/featured",
  }),
  ACCOUNT_STATUS_CHANGED: (v) => ({
    title: "Your account status has changed",
    message: v.reason
      ? `Your account status is now ${str(v.status)}. Reason: ${str(v.reason)}`
      : `Your account status is now ${str(v.status)}.`,
    ctaLabel: "View account",
    ctaPath: "/account",
  }),
};

export type NotifyInput = {
  userId: string;
  type: NotificationType;
  vars?: NotificationVars;
  relatedEntityType?: string;
  relatedEntityId?: string;
  /** Small, non-sensitive extra data for a future renderer — never raw
   * contact info or payment details. */
  payload?: Record<string, unknown>;
};

/**
 * Writes the in-app notification (if enabled) and sends the email (if
 * enabled), for one event, for one user. Never throws: a failure in either
 * channel is logged and swallowed, since this is always called after the
 * real state change it reports on has already committed — see every call
 * site (listing-service.ts, inquiry-service.ts, featured-service.ts,
 * admin-service.ts, expiry-service.ts).
 */
export async function notify(input: NotifyInput): Promise<void> {
  try {
    const copy = NOTIFICATION_COPY[input.type](input.vars ?? {});
    const required = REQUIRED_TYPES.has(input.type);

    const [preference, user] = await Promise.all([
      prisma.notificationPreference.findUnique({ where: { userId: input.userId } }),
      prisma.user.findUnique({ where: { id: input.userId }, select: { email: true } }),
    ]);

    const inAppEnabled = required || (preference?.inAppEnabled ?? true);
    const emailEnabled = required || (preference?.emailEnabled ?? true);

    if (inAppEnabled) {
      await prisma.notification.create({
        data: {
          userId: input.userId,
          type: input.type,
          title: copy.title,
          message: copy.message,
          relatedEntityType: input.relatedEntityType,
          relatedEntityId: input.relatedEntityId,
          payload: input.payload as Prisma.InputJsonValue | undefined,
        },
      });
    }

    if (emailEnabled && user?.email) {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
      const { subject, html, text } = buildNotificationEmail({
        title: copy.title,
        message: copy.message,
        ctaLabel: copy.ctaLabel,
        ctaUrl: copy.ctaPath ? `${baseUrl}${copy.ctaPath}` : undefined,
      });
      await sendEmail({ to: user.email, subject, html, text });
    }
  } catch (error) {
    // notify() must never be the reason a real action (approving a listing,
    // marking a car sold, activating a subscription) fails — log and move
    // on. Every call site already treats this as fire-and-forget.
    console.error(`[notify] Failed to notify user ${input.userId} of ${input.type}:`, error);
  }
}

/** The signed-in user's own notifications only — never accepts a userId
 * from the caller, so there is no parameter to tamper with to read someone
 * else's notifications. */
export async function getMyNotifications({
  unreadOnly = false,
  page = 1,
  pageSize = 20,
}: { unreadOnly?: boolean; page?: number; pageSize?: number } = {}) {
  const user = await requireAuth();
  const safePage = Math.max(1, page);
  const where = { userId: user.id, ...(unreadOnly ? { readAt: null } : {}) };

  const [notifications, totalCount, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (safePage - 1) * pageSize,
      take: pageSize,
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { userId: user.id, readAt: null } }),
  ]);

  return {
    notifications,
    totalCount,
    unreadCount,
    totalPages: Math.max(1, Math.ceil(totalCount / pageSize)),
    page: safePage,
  };
}

/** Marks one notification read — re-fetches it and checks ownership
 * server-side rather than trusting that a notificationId passed in belongs
 * to the caller (the same "never trust a client-supplied identity" rule as
 * requireListingOwnership). */
export async function markNotificationRead(notificationId: string) {
  const user = await requireAuth();

  const notification = await prisma.notification.findUnique({ where: { id: notificationId } });
  if (!notification || notification.userId !== user.id) {
    throw new AuthorizationError("Notification not found.");
  }

  if (notification.readAt) return notification;

  return prisma.notification.update({
    where: { id: notificationId },
    data: { readAt: new Date() },
  });
}

/** Current user's own preference row, or the implicit all-enabled default
 * if they've never set one. */
export async function getMyNotificationPreference() {
  const user = await requireAuth();
  const preference = await prisma.notificationPreference.findUnique({ where: { userId: user.id } });
  return preference ?? { userId: user.id, emailEnabled: true, inAppEnabled: true };
}

/**
 * Upserts the current user's own preference — never accepts a userId
 * parameter, so a user can only ever change their own preference. Exists
 * now as the architecture "prepared for future expansion" (spec) even
 * without a settings UI yet; REQUIRED_TYPES in notify() above already
 * guarantees this can never be used to silence an operationally/legally
 * necessary notification.
 */
export async function updateMyNotificationPreference(input: {
  emailEnabled?: boolean;
  inAppEnabled?: boolean;
}) {
  const user = await requireAuth();
  return prisma.notificationPreference.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      emailEnabled: input.emailEnabled ?? true,
      inAppEnabled: input.inAppEnabled ?? true,
    },
    update: {
      ...(input.emailEnabled !== undefined ? { emailEnabled: input.emailEnabled } : {}),
      ...(input.inAppEnabled !== undefined ? { inAppEnabled: input.inAppEnabled } : {}),
    },
  });
}

import "server-only";

// ----------------------------------------------------------------------------
// M-Pesa Daraja STK Push client (Buy Goods / Till number flow).
//
// This module is the ONLY place that talks to Safaricom's API, and the ONE
// centralized configuration point for M-Pesa across the entire site.
// Every payment surface — Featured/Preferred Listings, CSR donations, Car
// Insurance, and the orderable Services (Car Tracking, Pre-Purchase
// Inspection, etc.) — goes through this same module and pays into the same
// single MPESA_TILL_NUMBER. There is deliberately no per-feature Till or
// passkey anywhere in the codebase: the Till Number is entered once, here,
// via env vars, and every call site downstream (featured-service.ts,
// csr-service.ts, insurance-service.ts, service-catalog-service.ts) just
// calls initiateStkPush() with no knowledge of which Till it uses. (An
// earlier revision of this app gave CSR and Insurance their own isolated
// Tills for reconciliation-trail reasons; that was explicitly reversed in
// favor of one shared Till, so don't reintroduce per-domain Till branching
// without a fresh instruction to do so.)
//
// isMpesaConfigured() gates everything: the business Till number and
// Daraja app credentials are not available yet, so every call site must
// handle "not configured" as an expected, user-safe state (see
// MpesaNotConfiguredError below), never a crash. What actually
// distinguishes one payment domain from another is never the Till — it's
// which table the transaction row lands in (PaymentTransaction,
// CsrDonation, InsurancePurchase, ServiceOrder) and that row's own service
// reference + accountReference/transactionDesc on the STK push — see each
// service module's own comments.
// ----------------------------------------------------------------------------

const BASE_URL =
  process.env.MPESA_ENV === "production"
    ? "https://api.safaricom.co.ke"
    : "https://sandbox.safaricom.co.ke";

export class MpesaNotConfiguredError extends Error {
  constructor() {
    super("Payments aren't set up yet. Please check back soon.");
    this.name = "MpesaNotConfiguredError";
  }
}

export class MpesaRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MpesaRequestError";
  }
}

/** The one gate every payment surface on the site checks before attempting
 * a real STK push — see the module comment above. */
export function isMpesaConfigured(): boolean {
  return Boolean(
    process.env.MPESA_CONSUMER_KEY &&
      process.env.MPESA_CONSUMER_SECRET &&
      process.env.MPESA_TILL_NUMBER &&
      process.env.MPESA_PASSKEY &&
      process.env.MPESA_CALLBACK_SECRET
  );
}

function requireConfig() {
  if (!isMpesaConfigured()) throw new MpesaNotConfiguredError();
  return {
    consumerKey: process.env.MPESA_CONSUMER_KEY!,
    consumerSecret: process.env.MPESA_CONSUMER_SECRET!,
    tillNumber: process.env.MPESA_TILL_NUMBER!,
    passkey: process.env.MPESA_PASSKEY!,
    callbackSecret: process.env.MPESA_CALLBACK_SECRET!,
  };
}

// Access tokens last ~1hr per Daraja docs; a small in-memory cache avoids a
// round trip on every push without needing a shared store (fine for a
// single-process deployment — see rate-limit.ts for the same tradeoff).
let cachedToken: { value: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  const { consumerKey, consumerSecret } = requireConfig();

  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.value;
  }

  const credentials = Buffer.from(`${consumerKey}:${consumerSecret}`).toString("base64");
  const res = await fetch(`${BASE_URL}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${credentials}` },
  });

  if (!res.ok) {
    throw new MpesaRequestError(`Failed to authenticate with M-Pesa (${res.status}).`);
  }

  const data = (await res.json()) as { access_token: string; expires_in: string };
  cachedToken = {
    value: data.access_token,
    // Refresh a little early to avoid using a token that expires mid-request.
    expiresAt: Date.now() + (Number(data.expires_in) - 60) * 1000,
  };
  return data.access_token;
}

function darajaTimestamp(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    date.getFullYear().toString() +
    pad(date.getMonth() + 1) +
    pad(date.getDate()) +
    pad(date.getHours()) +
    pad(date.getMinutes()) +
    pad(date.getSeconds())
  );
}

/** Normalizes a Kenyan phone number to Daraja's required 2547XXXXXXXX /
 * 2541XXXXXXXX format. Throws on anything that doesn't clearly parse. */
export function normalizeKenyanPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (/^2547\d{8}$/.test(digits) || /^2541\d{8}$/.test(digits)) return digits;
  if (/^0[17]\d{8}$/.test(digits)) return `254${digits.slice(1)}`;
  if (/^[17]\d{8}$/.test(digits)) return `254${digits}`;
  throw new MpesaRequestError("Enter a valid Safaricom number, e.g. 07XXXXXXXX.");
}

export type StkPushResult = {
  merchantRequestId: string;
  checkoutRequestId: string;
};

/**
 * Initiates an STK Push (M-Pesa prompt on the customer's phone) for a Buy
 * Goods (Till) payment. The result only confirms the PUSH was sent — the
 * actual payment outcome arrives later via the callback webhook
 * (/api/webhooks/payments), which is the only place a subscription is ever
 * activated. Never treat a successful call to this function as "paid."
 */
export async function initiateStkPush({
  phone,
  amount,
  accountReference,
  transactionDesc,
}: {
  phone: string;
  amount: number;
  /** Free text identifying the specific thing being paid for (a listing
   * slug, an initiative slug, a policy title, …) — shown on the
   * customer's M-Pesa statement. This, not the Till, is what distinguishes
   * one payment domain from another; see the module comment above. */
  accountReference: string;
  transactionDesc: string;
}): Promise<StkPushResult> {
  const { tillNumber, passkey, callbackSecret } = requireConfig();
  const accessToken = await getAccessToken();

  const timestamp = darajaTimestamp(new Date());
  const password = Buffer.from(`${tillNumber}${passkey}${timestamp}`).toString("base64");
  const callbackUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/webhooks/payments?token=${callbackSecret}`;

  const res = await fetch(`${BASE_URL}/mpesa/stkpush/v1/processrequest`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      BusinessShortCode: tillNumber,
      Password: password,
      Timestamp: timestamp,
      // Buy Goods (Till), not Paybill — matches "Till number" in the brief.
      TransactionType: "CustomerBuyGoodsOnline",
      Amount: Math.round(amount),
      PartyA: phone,
      PartyB: tillNumber,
      PhoneNumber: phone,
      CallBackURL: callbackUrl,
      AccountReference: accountReference.slice(0, 12),
      TransactionDesc: transactionDesc.slice(0, 13),
    }),
  });

  const data = (await res.json()) as Record<string, unknown>;

  if (!res.ok || data.ResponseCode !== "0") {
    const desc =
      (data.errorMessage as string) ||
      (data.ResponseDescription as string) ||
      "M-Pesa declined the request.";
    throw new MpesaRequestError(desc);
  }

  return {
    merchantRequestId: String(data.MerchantRequestID),
    checkoutRequestId: String(data.CheckoutRequestID),
  };
}

// ----------------------------------------------------------------------------
// Callback payload shape (Daraja's STK Push result push to CallBackURL).
// ResultCode 0 = success; anything else = failed/cancelled by the customer.
// ----------------------------------------------------------------------------

export type MpesaCallbackItem = { Name: string; Value?: string | number };

export type MpesaStkCallback = {
  MerchantRequestID: string;
  CheckoutRequestID: string;
  ResultCode: number;
  ResultDesc: string;
  CallbackMetadata?: { Item: MpesaCallbackItem[] };
};

export function parseStkCallback(body: unknown): MpesaStkCallback | null {
  const stkCallback = (body as { Body?: { stkCallback?: MpesaStkCallback } })?.Body?.stkCallback;
  if (!stkCallback?.CheckoutRequestID) return null;
  return stkCallback;
}

export function callbackMetadataValue(
  callback: MpesaStkCallback,
  name: string
): string | number | undefined {
  return callback.CallbackMetadata?.Item.find((item) => item.Name === name)?.Value;
}

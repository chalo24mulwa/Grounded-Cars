import { z } from "zod";

// The five existing /services/* pages this feature attaches to — kept as a
// single source of truth so the admin create form's <select> and the
// service-catalog-service.ts lookups can never drift out of sync with the
// actual routes under src/app/(public)/services/*.
export const SERVICE_PAGE_OPTIONS = [
  { slug: "pre-purchase-inspection", label: "Pre-Purchase Inspection" },
  { slug: "car-financing", label: "Car Financing" },
  { slug: "car-valuation", label: "Car Valuation" },
  { slug: "car-tracking", label: "Car Tracking" },
  { slug: "home-repairs", label: "Home Repairs" },
] as const;

export type ServicePageSlug = (typeof SERVICE_PAGE_OPTIONS)[number]["slug"];
const SERVICE_SLUGS = SERVICE_PAGE_OPTIONS.map((o) => o.slug) as [string, ...string[]];

const moneyString = z
  .string()
  .trim()
  .min(1, "Enter a price")
  .transform((v) => Number(v))
  .refine((v) => Number.isFinite(v) && v > 0, "Enter a valid price greater than 0");

export const createServiceSchema = z.object({
  slug: z.enum(SERVICE_SLUGS, { errorMap: () => ({ message: "Choose which service page this applies to" }) }),
  title: z.string().trim().min(3, "Title must be at least 3 characters").max(150),
  description: z.string().trim().min(10, "Description must be at least 10 characters").max(5000),
  price: moneyString,
});
export type CreateServiceInput = z.input<typeof createServiceSchema>;

// Editing never changes which page a service is attached to — the slug is
// fixed at creation (enforced by the DB's @unique constraint too), so the
// edit form doesn't expose it at all.
export const updateServiceSchema = createServiceSchema.omit({ slug: true });
export type UpdateServiceInput = z.input<typeof updateServiceSchema>;

// A customer orders without an account (same "no login required" pattern as
// CSR donations) — customerPhone is required (the STK push needs a real
// number); name/email are optional.
export const orderServiceSchema = z.object({
  serviceId: z.string().min(1),
  customerPhone: z.string().trim().min(1, "Enter your M-Pesa phone number"),
  customerName: z.string().trim().max(150).optional(),
  customerEmail: z.string().trim().email("Enter a valid email").max(200).optional().or(z.literal("")),
  // Optional — a blank/omitted code means "no coupon," not an error. See
  // initiateServiceOrder() in service-catalog-service.ts for how it's
  // applied.
  couponCode: z.string().trim().optional(),
});
export type OrderServiceInput = z.input<typeof orderServiceSchema>;

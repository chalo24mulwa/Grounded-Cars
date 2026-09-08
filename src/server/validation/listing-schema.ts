import { z } from "zod";

// ----------------------------------------------------------------------------
// Single definition of "what is a valid car listing", imported by both the
// client-side form (for inline validation/UX) and the server action (for
// the authoritative check). Never duplicate these rules elsewhere — if a
// field's rules need to change, this is the only file to edit.
// ----------------------------------------------------------------------------

const currentYear = new Date().getFullYear();

export const createListingSchema = z.object({
  title: z.string().min(5, "Title must be at least 5 characters").max(150),
  make: z.string().min(1, "Make is required").max(60),
  model: z.string().min(1, "Model is required").max(60),
  year: z
    .number()
    .int()
    .min(1970, "Year seems too old")
    .max(currentYear + 1, "Year cannot be in the future"),
  // Upper bound matches the DB column's own limit (Decimal(12, 2), i.e. up
  // to 10 digits before the decimal point) — validated here so a bad value
  // fails with a friendly Zod message instead of a raw Prisma/Postgres
  // numeric-overflow error reaching toUserSafeError()'s generic fallback.
  price: z
    .number()
    .positive("Price must be greater than 0")
    .max(999_999_999, "Price is too large"),
  currency: z.string().length(3).default("KES"),
  mileage: z.number().int().nonnegative().optional(),
  transmission: z.enum(["MANUAL", "AUTOMATIC", "CVT", "SEMI_AUTOMATIC"]).optional(),
  fuelType: z.enum(["PETROL", "DIESEL", "HYBRID", "ELECTRIC", "LPG"]).optional(),
  engineSize: z.string().max(30).optional(),
  bodyType: z.string().max(60).optional(),
  color: z.string().max(40).optional(),
  location: z.string().max(120).optional(),
  description: z.string().max(5000).optional(),
  condition: z.enum(["BRAND_NEW", "FOREIGN_USED", "LOCALLY_USED"]).optional(),
  // Mandatory — every listing declares exactly one (not `.optional()`,
  // unlike `condition` above). Distinct field from `condition`: this is
  // "how was it brought into the country," not "how new/used it looks."
  importStatus: z.enum(["LOCALLY_USED", "FRESH_IMPORT"], {
    errorMap: () => ({ message: "Select whether this car is Locally Used or a Fresh Import." }),
  }),
  // Mandatory, like importStatus above — backs the header's "Find a Car"
  // category dropdown and getRelatedListings()'s matching (see
  // listing-service.ts). Distinct from the free-text `bodyType` field.
  category: z.enum(["CARS", "SUV_TRUCKS", "LORRIES_BUSES", "EV_CARS", "EV_BIKES"], {
    errorMap: () => ({ message: "Select a category for this vehicle." }),
  }),
});

// Updates never include `status` — status changes are handled exclusively by
// changeListingStatus() via the centrally-validated transition table, never
// by a generic "update listing" call. This is enforced again defensively in
// the service layer, but starts here so the type itself doesn't offer it.
export const updateListingSchema = createListingSchema.partial();

export type CreateListingInput = z.infer<typeof createListingSchema>;
export type UpdateListingInput = z.infer<typeof updateListingSchema>;

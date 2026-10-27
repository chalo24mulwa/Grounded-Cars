import { z } from "zod";

// ----------------------------------------------------------------------------
// Parses raw URL search params (always strings, always attacker-controlled)
// into a safe, typed filter object. Deliberately field-by-field rather than
// one big object schema: a single malformed param (bad year, garbage enum
// value, a SQL-injection-flavored string in `q`) must never fail the whole
// request — it's just dropped, and every other valid filter still applies.
// There is no SQL string-building anywhere in this app (Prisma's query
// builder parameterizes everything), so "injection protection" here is
// really about not letting garbage input reach Prisma with the wrong type,
// which is exactly what this coercion does.
// ----------------------------------------------------------------------------

export const LISTING_SORTS = [
  "featured",
  "newest",
  "oldest",
  "price_asc",
  "price_desc",
  "year_desc",
  "mileage_asc",
] as const;
export type ListingSort = (typeof LISTING_SORTS)[number];

const TRANSMISSIONS = ["MANUAL", "AUTOMATIC", "CVT", "SEMI_AUTOMATIC"] as const;
const FUEL_TYPES = ["PETROL", "DIESEL", "HYBRID", "ELECTRIC", "LPG"] as const;
const CONDITIONS = ["BRAND_NEW", "FOREIGN_USED", "LOCALLY_USED"] as const;
// Kept in sync by hand with the Prisma `VehicleClassification` enum.
export const CLASSIFICATIONS = ["GROUNDED", "SALVAGE", "AUCTION", "OLD_SCHOOL"] as const;
// Kept in sync by hand with the Prisma `VehicleCategory` enum (schema.prisma)
// — same "small fixed set, no DB round trip needed to validate" reasoning
// as the other enum arrays above.
export const VEHICLE_CATEGORIES = ["CARS", "SUV_TRUCKS", "LORRIES_BUSES", "EV_CARS", "EV_BIKES"] as const;

const textField = z.string().trim().min(1).max(120);
const yearField = z.coerce.number().int().min(1900).max(2100);
const priceField = z.coerce.number().nonnegative().max(1_000_000_000);
const mileageField = z.coerce.number().int().nonnegative().max(10_000_000);
const pageField = z.coerce.number().int().min(1).max(10_000);

export type ListingSearchParams = {
  q?: string;
  make?: string;
  model?: string;
  minPrice?: number;
  maxPrice?: number;
  minYear?: number;
  maxYear?: number;
  minMileage?: number;
  maxMileage?: number;
  transmission?: (typeof TRANSMISSIONS)[number];
  fuelType?: (typeof FUEL_TYPES)[number];
  bodyType?: string;
  location?: string;
  condition?: (typeof CONDITIONS)[number];
  // A listing matches if it has ANY of the selected classifications (an
  // OR, not an AND) — see buildListingWhere's `hasSome` filter.
  classifications?: (typeof CLASSIFICATIONS)[number][];
  category?: (typeof VEHICLE_CATEGORIES)[number];
  sort: ListingSort;
  page: number;
};

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseText(raw: string | string[] | undefined): string | undefined {
  const result = textField.safeParse(first(raw));
  return result.success ? result.data : undefined;
}

function parseEnum<T extends readonly string[]>(
  raw: string | string[] | undefined,
  allowed: T
): T[number] | undefined {
  const value = first(raw);
  return value && (allowed as readonly string[]).includes(value) ? (value as T[number]) : undefined;
}

// Repeated ?classifications=GROUNDED&classifications=SALVAGE query params
// arrive here as a string[] already; a single occurrence arrives as a plain
// string. Either way, every value is independently checked against the
// allowed list — one bad value never discards the valid ones alongside it.
function parseEnumArray<T extends readonly string[]>(
  raw: string | string[] | undefined,
  allowed: T
): T[number][] | undefined {
  if (raw === undefined) return undefined;
  const values = Array.isArray(raw) ? raw : [raw];
  const valid = [...new Set(values.filter((v): v is T[number] => (allowed as readonly string[]).includes(v)))];
  return valid.length > 0 ? valid : undefined;
}

/** Parses Next.js's raw searchParams object into a safe filter set. Every
 * field is independently validated — garbage in one field never discards
 * the rest of a buyer's filter selection. */
export function parseListingSearchParams(
  raw: Record<string, string | string[] | undefined>
): ListingSearchParams {
  const minPriceResult = priceField.safeParse(first(raw.minPrice));
  const maxPriceResult = priceField.safeParse(first(raw.maxPrice));
  const minYearResult = yearField.safeParse(first(raw.minYear));
  const maxYearResult = yearField.safeParse(first(raw.maxYear));
  const minMileageResult = mileageField.safeParse(first(raw.minMileage));
  const maxMileageResult = mileageField.safeParse(first(raw.maxMileage));
  const pageResult = pageField.safeParse(first(raw.page));

  return {
    q: parseText(raw.q),
    make: parseText(raw.make),
    model: parseText(raw.model),
    minPrice: minPriceResult.success ? minPriceResult.data : undefined,
    maxPrice: maxPriceResult.success ? maxPriceResult.data : undefined,
    minYear: minYearResult.success ? minYearResult.data : undefined,
    maxYear: maxYearResult.success ? maxYearResult.data : undefined,
    minMileage: minMileageResult.success ? minMileageResult.data : undefined,
    maxMileage: maxMileageResult.success ? maxMileageResult.data : undefined,
    transmission: parseEnum(raw.transmission, TRANSMISSIONS),
    fuelType: parseEnum(raw.fuelType, FUEL_TYPES),
    bodyType: parseText(raw.bodyType),
    location: parseText(raw.location),
    condition: parseEnum(raw.condition, CONDITIONS),
    classifications: parseEnumArray(raw.classifications, CLASSIFICATIONS),
    category: parseEnum(raw.category, VEHICLE_CATEGORIES),
    sort: parseEnum(raw.sort, LISTING_SORTS) ?? "featured",
    page: pageResult.success ? pageResult.data : 1,
  };
}

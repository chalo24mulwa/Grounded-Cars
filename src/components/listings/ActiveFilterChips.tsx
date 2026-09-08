import Link from "next/link";
import type { ListingSearchParams } from "@/server/validation/search-schema";

const LABELS: Partial<Record<keyof ListingSearchParams, string>> = {
  q: "Keyword",
  make: "Make",
  model: "Model",
  minPrice: "Min price",
  maxPrice: "Max price",
  minYear: "From year",
  maxYear: "To year",
  minMileage: "Min mileage",
  maxMileage: "Max mileage",
  transmission: "Transmission",
  fuelType: "Fuel type",
  bodyType: "Body type",
  location: "Location",
  condition: "Condition",
  importStatus: "Import status",
  category: "Category",
};

const CHIP_KEYS = Object.keys(LABELS) as (keyof ListingSearchParams)[];

// Server-rendered — each chip is a Link to the same URL minus that one
// param (built from the already-parsed, already-safe filter set, not raw
// user input), so removing a filter is a real navigation, not client state.
export function ActiveFilterChips({
  current,
  buildHrefWithout,
  basePath = "/cars",
}: {
  current: ListingSearchParams;
  buildHrefWithout: (key: keyof ListingSearchParams) => string;
  // Lets this same component be reused on another listing page (e.g. Best
  // Deals) without changing its default /cars behavior.
  basePath?: string;
}) {
  const active = CHIP_KEYS.filter((key) => current[key] != null && current[key] !== "");
  if (active.length === 0) return null;

  return (
    <div className="mb-4 flex flex-wrap gap-2">
      {active.map((key) => (
        <Link
          key={key}
          href={buildHrefWithout(key)}
          className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200"
        >
          {LABELS[key]}: {String(current[key])}
          <span aria-hidden="true">×</span>
        </Link>
      ))}
      <Link
        href={basePath}
        className="inline-flex items-center rounded-full border border-slate-300 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-brand-subtle"
      >
        Clear all
      </Link>
    </div>
  );
}

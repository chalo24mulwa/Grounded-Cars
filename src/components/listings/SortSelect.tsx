"use client";

import { useRouter, useSearchParams } from "next/navigation";
import type { ListingSort } from "@/server/validation/search-schema";

const OPTIONS: { value: ListingSort; label: string }[] = [
  { value: "featured", label: "Featured first" },
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
  { value: "year_desc", label: "Year: newest first" },
  { value: "mileage_asc", label: "Mileage: lowest first" },
];

export function SortSelect({
  current,
  basePath = "/cars",
}: {
  current: ListingSort;
  // Lets this same control be reused on another listing page (e.g. Best
  // Deals) without changing its default /cars behavior.
  basePath?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("sort", e.target.value);
    params.delete("page"); // a new sort order restarts pagination from page 1
    router.push(`${basePath}?${params.toString()}`);
  }

  return (
    <select
      value={current}
      onChange={handleChange}
      aria-label="Sort results"
      className="rounded-md border border-slate-300 px-2.5 py-1.5 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
    >
      {OPTIONS.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

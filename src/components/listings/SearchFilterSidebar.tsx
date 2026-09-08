"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ListingSearchParams } from "@/server/validation/search-schema";

const inputClass =
  "w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand";
const labelClass = "block text-xs font-medium text-slate-600";

type MakeModelIndex = { make: string; models: string[] }[];

// Filters are plain, real URL navigation (router.push to /cars?...) rather
// than a client-side data filter — every submission is a real server
// request that re-runs getPublicListings() with the new params, which is
// what "don't load everything and filter client-side" actually means in
// practice, and it's also what makes the resulting URL genuinely
// shareable/bookmarkable (it's not synthetic client state, it's the real
// navigation state).
export function SearchFilterSidebar({
  makeModelIndex,
  current,
  basePath = "/cars",
}: {
  makeModelIndex: MakeModelIndex;
  current: ListingSearchParams;
  // Lets this same form be reused on another listing page (e.g. Best
  // Deals) without changing its default /cars behavior.
  basePath?: string;
}) {
  const router = useRouter();
  const [make, setMake] = useState(current.make ?? "");

  const modelOptions = useMemo(() => {
    if (!make) return [];
    return makeModelIndex.find((m) => m.make === make)?.models ?? [];
  }, [make, makeModelIndex]);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const params = new URLSearchParams();

    for (const [key, value] of formData.entries()) {
      const trimmed = String(value).trim();
      if (trimmed) params.set(key, trimmed);
    }
    // Any filter change starts back at page 1 — a stale page number from
    // the previous filter set could point past the end of the new result
    // set entirely.
    params.delete("page");

    router.push(`${basePath}?${params.toString()}`);
  }

  function handleClear() {
    router.push(basePath);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
      <div>
        <label htmlFor="q" className={labelClass}>
          Keyword
        </label>
        <input
          id="q"
          name="q"
          type="text"
          defaultValue={current.q ?? ""}
          placeholder="e.g. Axio, Nairobi"
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="make" className={labelClass}>
          Make
        </label>
        <select
          id="make"
          name="make"
          value={make}
          onChange={(e) => setMake(e.target.value)}
          className={inputClass}
        >
          <option value="">Any make</option>
          {makeModelIndex.map((m) => (
            <option key={m.make} value={m.make}>
              {m.make}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="model" className={labelClass}>
          Model
        </label>
        <select
          id="model"
          name="model"
          defaultValue={current.model ?? ""}
          disabled={!make}
          className={inputClass}
        >
          <option value="">{make ? "Any model" : "Select a make first"}</option>
          {modelOptions.map((model) => (
            <option key={model} value={model}>
              {model}
            </option>
          ))}
        </select>
      </div>

      <fieldset>
        <legend className={labelClass}>Price (KES)</legend>
        <div className="mt-1 flex gap-2">
          <input
            name="minPrice"
            type="number"
            min={0}
            placeholder="Min"
            defaultValue={current.minPrice ?? ""}
            className={inputClass}
          />
          <input
            name="maxPrice"
            type="number"
            min={0}
            placeholder="Max"
            defaultValue={current.maxPrice ?? ""}
            className={inputClass}
          />
        </div>
      </fieldset>

      <fieldset>
        <legend className={labelClass}>Year</legend>
        <div className="mt-1 flex gap-2">
          <input
            name="minYear"
            type="number"
            min={1900}
            max={2100}
            placeholder="From"
            defaultValue={current.minYear ?? ""}
            className={inputClass}
          />
          <input
            name="maxYear"
            type="number"
            min={1900}
            max={2100}
            placeholder="To"
            defaultValue={current.maxYear ?? ""}
            className={inputClass}
          />
        </div>
      </fieldset>

      <fieldset>
        <legend className={labelClass}>Mileage (km)</legend>
        <div className="mt-1 flex gap-2">
          <input
            name="minMileage"
            type="number"
            min={0}
            placeholder="Min"
            defaultValue={current.minMileage ?? ""}
            className={inputClass}
          />
          <input
            name="maxMileage"
            type="number"
            min={0}
            placeholder="Max"
            defaultValue={current.maxMileage ?? ""}
            className={inputClass}
          />
        </div>
      </fieldset>

      <div>
        <label htmlFor="transmission" className={labelClass}>
          Transmission
        </label>
        <select
          id="transmission"
          name="transmission"
          defaultValue={current.transmission ?? ""}
          className={inputClass}
        >
          <option value="">Any</option>
          <option value="MANUAL">Manual</option>
          <option value="AUTOMATIC">Automatic</option>
          <option value="CVT">CVT</option>
          <option value="SEMI_AUTOMATIC">Semi-automatic</option>
        </select>
      </div>

      <div>
        <label htmlFor="fuelType" className={labelClass}>
          Fuel type
        </label>
        <select id="fuelType" name="fuelType" defaultValue={current.fuelType ?? ""} className={inputClass}>
          <option value="">Any</option>
          <option value="PETROL">Petrol</option>
          <option value="DIESEL">Diesel</option>
          <option value="HYBRID">Hybrid</option>
          <option value="ELECTRIC">Electric</option>
          <option value="LPG">LPG</option>
        </select>
      </div>

      <div>
        <label htmlFor="bodyType" className={labelClass}>
          Body type
        </label>
        <input
          id="bodyType"
          name="bodyType"
          type="text"
          placeholder="e.g. SUV, Sedan"
          defaultValue={current.bodyType ?? ""}
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="location" className={labelClass}>
          Location
        </label>
        <input
          id="location"
          name="location"
          type="text"
          placeholder="e.g. Nairobi"
          defaultValue={current.location ?? ""}
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="condition" className={labelClass}>
          Condition
        </label>
        <select id="condition" name="condition" defaultValue={current.condition ?? ""} className={inputClass}>
          <option value="">Any</option>
          <option value="BRAND_NEW">Brand new</option>
          <option value="FOREIGN_USED">Foreign used</option>
          <option value="LOCALLY_USED">Locally used</option>
        </select>
      </div>

      <div>
        <label htmlFor="category" className={labelClass}>
          Category
        </label>
        <select id="category" name="category" defaultValue={current.category ?? ""} className={inputClass}>
          <option value="">Any</option>
          <option value="CARS">Cars</option>
          <option value="SUV_TRUCKS">SUV & Trucks</option>
          <option value="LORRIES_BUSES">Lorries and Buses</option>
          <option value="EV_CARS">Electric Vehicles</option>
          <option value="EV_BIKES">Electric Bikes</option>
        </select>
      </div>

      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          className="flex-1 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand/90"
        >
          Apply Filters
        </button>
        <button
          type="button"
          onClick={handleClear}
          className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-brand-subtle"
        >
          Clear All
        </button>
      </div>
    </form>
  );
}

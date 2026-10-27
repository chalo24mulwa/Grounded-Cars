"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";

const inputClass =
  "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand";
const labelClass = "mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500";

type MakeModelIndex = { make: string; models: string[] }[];

const CLASSIFICATION_OPTIONS = [
  { value: "GROUNDED", label: "Grounded" },
  { value: "SALVAGE", label: "Salvage" },
  { value: "AUCTION", label: "Auction" },
  { value: "OLD_SCHOOL", label: "Old School" },
] as const;

// The homepage hero's search card — same real-navigation pattern as
// SearchFilterSidebar (a submit is a router.push into /cars?..., not
// client-side filtering), just laid out horizontally for a hero banner and
// starting blank every time (there's no "current" filter state on the
// homepage the way there is on /cars). Deliberately its own component
// rather than a reuse of SearchFilterSidebar — that one is contractually a
// vertical sidebar; forcing it into a hero card would mean fighting its
// layout instead of just building the layout this needs.
//
// The keyword row is always visible; the rest of the fields stay collapsed
// behind the filter-icon toggle until clicked (a CSS grid-rows 0fr→1fr
// transition, not display:none, so it animates open rather than popping in)
// — keeps the hero uncluttered by default while the full filter set is one
// click away, same spirit as cars360.co.ke's own search bar.
export function HeroSearchBar({ makeModelIndex }: { makeModelIndex: MakeModelIndex }) {
  const router = useRouter();
  const [make, setMake] = useState("");
  const [expanded, setExpanded] = useState(false);

  const modelOptions = useMemo(() => {
    if (!make) return [];
    return makeModelIndex.find((m) => m.make === make)?.models ?? [];
  }, [make, makeModelIndex]);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const params = new URLSearchParams();

    // .append (not .set) — a checkbox group like `classifications` submits
    // multiple entries under the same name, and .set would silently drop
    // every value but the last one checked.
    for (const [key, value] of formData.entries()) {
      const trimmed = String(value).trim();
      if (trimmed) params.append(key, trimmed);
    }

    router.push(`/cars?${params.toString()}`);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full rounded-2xl bg-white/95 p-4 shadow-xl ring-1 ring-black/5 backdrop-blur-sm sm:p-5"
    >
      <div className="flex gap-2 sm:gap-3">
        <input
          name="q"
          type="text"
          placeholder="Search make, model, location…"
          className={`${inputClass} flex-1`}
        />
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          aria-controls="hero-search-filters"
          aria-label={expanded ? "Hide filters" : "Show more filters"}
          title={expanded ? "Hide filters" : "Show more filters"}
          className={clsx(
            "flex shrink-0 items-center justify-center rounded-md border px-3 transition",
            expanded
              ? "border-brand bg-brand/10 text-brand"
              : "border-slate-300 bg-white text-slate-500 hover:border-brand/40 hover:bg-brand-subtle hover:text-brand"
          )}
        >
          <SlidersIcon />
        </button>
        <button
          type="submit"
          className="hidden shrink-0 rounded-md bg-brand px-6 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand/90 sm:block"
        >
          Search Vehicles
        </button>
      </div>
      <button
        type="submit"
        className="mt-3 w-full rounded-md bg-brand px-6 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand/90 sm:hidden"
      >
        Search Vehicles
      </button>

      <div
        id="hero-search-filters"
        className={clsx(
          "grid transition-all duration-300 ease-in-out",
          expanded ? "mt-4 grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        )}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="grid grid-cols-2 gap-3 border-t border-slate-100 pt-4 sm:grid-cols-4">
            <div>
              <label htmlFor="hero-make" className={labelClass}>
                Make
              </label>
              <select
                id="hero-make"
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
              <label htmlFor="hero-model" className={labelClass}>
                Model
              </label>
              <select id="hero-model" name="model" disabled={!make} className={inputClass}>
                <option value="">{make ? "Any model" : "Select a make first"}</option>
                {modelOptions.map((model) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="hero-minPrice" className={labelClass}>
                Min Price (KES)
              </label>
              <input
                id="hero-minPrice"
                name="minPrice"
                type="number"
                min={0}
                placeholder="Min"
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="hero-maxPrice" className={labelClass}>
                Max Price (KES)
              </label>
              <input
                id="hero-maxPrice"
                name="maxPrice"
                type="number"
                min={0}
                placeholder="Max"
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="hero-location" className={labelClass}>
                Location
              </label>
              <input
                id="hero-location"
                name="location"
                type="text"
                placeholder="e.g. Nairobi"
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="hero-transmission" className={labelClass}>
                Transmission
              </label>
              <select id="hero-transmission" name="transmission" className={inputClass}>
                <option value="">Any</option>
                <option value="MANUAL">Manual</option>
                <option value="AUTOMATIC">Automatic</option>
                <option value="CVT">CVT</option>
                <option value="SEMI_AUTOMATIC">Semi-automatic</option>
              </select>
            </div>

            <div className="col-span-2 sm:col-span-2">
              <span className={labelClass}>Classification</span>
              <div className="flex flex-wrap gap-2">
                {CLASSIFICATION_OPTIONS.map((option) => (
                  <label
                    key={option.value}
                    className="flex cursor-pointer items-center gap-1.5 rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700 has-[:checked]:border-brand has-[:checked]:bg-brand/5 has-[:checked]:text-brand"
                  >
                    <input
                      type="checkbox"
                      name="classifications"
                      value={option.value}
                      className="h-3.5 w-3.5 accent-brand"
                    />
                    {option.label}
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}

function SlidersIcon() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
      <path d="M3 5h9M15 5h2M3 10h4M9 10h8M3 15h11M17 15h0" strokeLinecap="round" />
      <circle cx="12" cy="5" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="6.5" cy="10" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="14.5" cy="15" r="1.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

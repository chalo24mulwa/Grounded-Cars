import Link from "next/link";
import clsx from "clsx";

// Server-rendered — no client JS needed for pagination itself, it's just
// links that carry the rest of the current filter/sort state forward.
export function Pagination({
  page,
  totalPages,
  buildHref,
}: {
  page: number;
  totalPages: number;
  buildHref: (page: number) => string;
}) {
  if (totalPages <= 1) return null;

  // First and last page, plus up to two pages either side of the current
  // one (1 2 3 4 5 … 12). Never more than ~9 links, however many pages.
  const pages = new Set<number>(
    [1, totalPages, page - 2, page - 1, page, page + 1, page + 2].filter((p) => p >= 1 && p <= totalPages)
  );
  const sorted = Array.from(pages).sort((a, b) => a - b);
  const isFirst = page <= 1;
  const isLast = page >= totalPages;

  return (
    <nav aria-label="Pagination" className="mt-8 flex flex-wrap items-center justify-center gap-1 sm:gap-1.5">
      <Link
        href={buildHref(Math.max(1, page - 1))}
        aria-disabled={isFirst}
        aria-label="Previous page"
        tabIndex={isFirst ? -1 : undefined}
        className={clsx(
          "inline-flex h-9 items-center gap-1 rounded-md border border-slate-300 px-2.5 text-sm font-medium sm:px-3",
          isFirst ? "pointer-events-none opacity-40" : "text-slate-700 hover:bg-brand-subtle"
        )}
      >
        <Arrow direction="left" />
        <span className="hidden sm:inline">Previous</span>
      </Link>

      {sorted.map((p, i) => (
        <span key={p} className="flex items-center gap-1 sm:gap-1.5">
          {i > 0 && p - sorted[i - 1]! > 1 && <span className="px-0.5 text-slate-400">…</span>}
          <Link
            href={buildHref(p)}
            aria-current={p === page ? "page" : undefined}
            aria-label={`Page ${p}`}
            className={clsx(
              "inline-flex h-9 min-w-9 items-center justify-center rounded-md px-2.5 text-sm font-medium",
              p === page ? "bg-brand text-white" : "text-slate-700 hover:bg-brand-subtle"
            )}
          >
            {p}
          </Link>
        </span>
      ))}

      <Link
        href={buildHref(Math.min(totalPages, page + 1))}
        aria-disabled={isLast}
        aria-label="Next page"
        tabIndex={isLast ? -1 : undefined}
        className={clsx(
          "inline-flex h-9 items-center gap-1 rounded-md border border-slate-300 px-2.5 text-sm font-medium sm:px-3",
          isLast ? "pointer-events-none opacity-40" : "text-slate-700 hover:bg-brand-subtle"
        )}
      >
        <span className="hidden sm:inline">Next</span>
        <Arrow direction="right" />
      </Link>
    </nav>
  );
}

function Arrow({ direction }: { direction: "left" | "right" }) {
  return (
    <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={direction === "left" ? "M12.5 4.5L7 10l5.5 5.5" : "M7.5 4.5L13 10l-5.5 5.5"} />
    </svg>
  );
}

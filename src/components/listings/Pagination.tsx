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

  // A handful of page numbers around the current one, plus first/last —
  // scales fine visually even if totalPages is in the thousands, since we
  // never render more than ~7 links regardless of totalPages.
  const pages = new Set<number>([1, totalPages, page, page - 1, page + 1].filter(
    (p) => p >= 1 && p <= totalPages
  ));
  const sorted = Array.from(pages).sort((a, b) => a - b);

  return (
    <nav aria-label="Pagination" className="mt-8 flex items-center justify-center gap-1">
      <Link
        href={buildHref(Math.max(1, page - 1))}
        aria-disabled={page === 1}
        className={clsx(
          "rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium",
          page === 1 ? "pointer-events-none opacity-40" : "text-slate-700 hover:bg-brand-subtle"
        )}
      >
        Previous
      </Link>

      {sorted.map((p, i) => (
        <span key={p} className="flex items-center gap-1">
          {i > 0 && p - sorted[i - 1]! > 1 && <span className="px-1 text-slate-400">…</span>}
          <Link
            href={buildHref(p)}
            aria-current={p === page ? "page" : undefined}
            className={clsx(
              "rounded-md px-3 py-1.5 text-sm font-medium",
              p === page ? "bg-brand text-white" : "text-slate-700 hover:bg-brand-subtle"
            )}
          >
            {p}
          </Link>
        </span>
      ))}

      <Link
        href={buildHref(Math.min(totalPages, page + 1))}
        aria-disabled={page === totalPages}
        className={clsx(
          "rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium",
          page === totalPages ? "pointer-events-none opacity-40" : "text-slate-700 hover:bg-brand-subtle"
        )}
      >
        Next
      </Link>
    </nav>
  );
}

import Link from "next/link";

// Custom 404 (Next.js file convention) — without this, notFound() calls
// throughout the app (e.g. an unknown /cars/[slug], or an ownership check
// in the seller edit page that deliberately renders "not found" rather than
// "forbidden" for someone else's listing — see that page's own comment)
// fell through to Next's default unstyled page. Branded and consistent with
// error.tsx, which handles thrown errors; this handles "no such page/data."
export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 text-center">
      <h1 className="text-xl font-bold text-slate-900">Page not found</h1>
      <p className="mt-2 text-sm text-slate-600">
        The page you&apos;re looking for doesn&apos;t exist, or may have been removed.
      </p>
      <div className="mt-4 flex gap-4">
        <Link href="/" className="text-sm font-medium text-brand hover:underline">
          Return home
        </Link>
        <Link href="/cars" className="text-sm font-medium text-brand hover:underline">
          Browse vehicles
        </Link>
      </div>
    </div>
  );
}

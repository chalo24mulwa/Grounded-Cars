"use client";

// Root-layout-level error boundary (Next.js file convention) — catches
// errors thrown while the ROOT layout itself renders, which src/app/error.tsx
// alone cannot catch (a route segment's error.tsx only wraps its own
// segment and below, never the layout above it — see Next.js docs). This
// is the last line of defense; it must render its own <html>/<body> since
// it fully replaces the root layout when it fires. Kept intentionally
// minimal (no shared components, no Tailwind-dependent layout assumptions)
// since the very thing that renders this may be a broken root layout.
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  return (
    <html lang="en">
      <body>
        <div style={{ maxWidth: 420, margin: "80px auto", padding: "0 16px", textAlign: "center" }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "#0f172a" }}>Something went wrong</h1>
          <p style={{ marginTop: 8, fontSize: 14, color: "#475569" }}>
            Please try refreshing the page, or come back in a few minutes.
          </p>
          {error.digest && (
            <p style={{ marginTop: 8, fontSize: 12, color: "#94a3b8" }}>Reference: {error.digest}</p>
          )}
        </div>
      </body>
    </html>
  );
}

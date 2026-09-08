// Shared shell for /register, /login, /forgot-password, /reset-password —
// a single centered card. Deliberately minimal per Phase 2 spec ("don't
// overcomplicate the UI; focus on trust, clarity, mobile usability").
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-12">
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="h-1 w-full bg-gradient-to-r from-brand via-brand-gold to-brand-accent" />
        <div className="p-6 sm:p-8">{children}</div>
      </div>
    </div>
  );
}

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { endImpersonationAction } from "@/server/actions/admin-actions";

// Only ever visible while an admin is impersonating another user (see
// startImpersonationAction) — shows who's being viewed and who's actually
// driving, with the one, always-reachable way back to the admin's own
// session. Deliberately NOT sticky — a plain banner in normal document
// flow at the very top of <body>, so it never has to coordinate pixel
// offsets with UtilityBar/SiteHeader's own sticky stack (see their
// `top-[Npx]` values) for a state that's rare and admin-only; it simply
// pushes them down by its own height, same as any other block content.
export async function ImpersonationBanner() {
  const session = await auth();
  if (!session?.user || !session.impersonatorId) return null;

  const [target, admin] = await Promise.all([
    prisma.user.findUnique({ where: { id: session.user.id }, select: { name: true, email: true } }),
    prisma.user.findUnique({ where: { id: session.impersonatorId }, select: { name: true } }),
  ]);
  if (!target || !admin) return null;

  return (
    <div className="w-full bg-amber-400 text-amber-950">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm">
        <span>
          <strong>{admin.name}</strong> is viewing as <strong>{target.name}</strong> ({target.email})
        </span>
        <form action={endImpersonationAction}>
          <button
            type="submit"
            className="rounded-md bg-amber-950 px-3 py-1 text-xs font-semibold text-amber-50 transition hover:bg-amber-900"
          >
            Return to admin
          </button>
        </form>
      </div>
    </div>
  );
}

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getMyFavorites } from "@/server/services/favorite-service";
import { CarCard } from "@/components/listings/CarCard";

export const metadata = { title: "Your Favorites" };

export default async function FavoritesPage() {
  // Defense in depth: middleware already protects /favorites/*, but this
  // page re-verifies itself rather than depending on that alone.
  const session = await auth();
  if (!session?.user) redirect("/login");

  const favorites = await getMyFavorites();

  // A favorited listing can later be archived/unpublished by its seller —
  // still shown honestly (ACTIVE/SOLD, per spec), but a listing that's no
  // longer publicly reachable (getPublicListingBySlug would 404 it) isn't
  // rendered as a clickable card here.
  const visible = favorites.filter((f) => f.listing.status === "ACTIVE" || f.listing.status === "SOLD");
  const hiddenCount = favorites.length - visible.length;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="mb-1 text-2xl font-bold">Your Favorites</h1>
      <p className="mb-6 text-sm text-slate-500">
        {favorites.length} saved vehicle{favorites.length === 1 ? "" : "s"}.
      </p>

      {visible.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center text-sm text-slate-500">
          You haven&apos;t saved any vehicles yet — tap the heart icon on a listing to save it here.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4">
          {visible.map((favorite) => (
            <CarCard
              key={favorite.id}
              listing={favorite.listing}
              isFavorited
              isAuthenticated
            />
          ))}
        </div>
      )}

      {hiddenCount > 0 && (
        <p className="mt-6 text-xs text-slate-400">
          {hiddenCount} saved vehicle{hiddenCount === 1 ? "" : "s"} no longer publicly available.
        </p>
      )}
    </div>
  );
}

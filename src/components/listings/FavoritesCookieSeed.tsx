import { auth } from "@/lib/auth";
import { readFavoritesCookie } from "@/server/services/favorite-service";
import { FavoritesCookieSeedPing } from "@/components/listings/FavoritesCookieSeedPing";

/** Renders nothing unless a signed-in visitor has no saved-cars cookie yet;
 * then a tiny script asks the server to write it, so their next pages show
 * hearts without any database work. */
export async function FavoritesCookieSeed() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;
  if (await readFavoritesCookie(userId)) return null;
  return <FavoritesCookieSeedPing />;
}

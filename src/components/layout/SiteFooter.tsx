import Image from "next/image";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { siteConfig } from "@/config/site";

// Mounted once in the root layout (src/app/layout.tsx), after <main> —
// every route in the app renders inside that one layout, so this appears
// on every page without each page needing to include it itself.
//
// Async Server Component (session-aware, same pattern as SiteHeader) so
// the account links below reflect who's actually signed in — never a
// dead/misleading "Log in" link shown to someone already logged in, and
// never a "Dashboard"/"Admin" link shown to someone without that role.
export async function SiteFooter() {
  const session = await auth();
  const role = session?.user?.role;

  return (
    <footer className="border-t border-brand/20 bg-brand text-white/80">
      {/* Mirrors the header's top strip — the same gold→orange sweep
          framing the page from below. */}
      <div className="h-[3px] w-full bg-gradient-to-r from-brand-accent via-brand-gold to-brand" />
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-2 lg:grid-cols-5">
        <div className="sm:col-span-2 lg:col-span-1">
          <Link href="/" className="flex items-center gap-2">
            <Image src={siteConfig.logo.transparent} alt={siteConfig.name} width={60} height={32} />
            <span className="text-base font-bold text-white">{siteConfig.name}</span>
          </Link>
          <p className="mt-3 text-sm leading-relaxed text-white/70">{siteConfig.description}</p>
        </div>

        <nav aria-label="Marketplace">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-brand-gold">Marketplace</h2>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <Link href="/cars" className="transition hover:text-white">
                Browse Vehicles
              </Link>
            </li>
            <li>
              <Link href="/best-deals" className="transition hover:text-white">
                Best Deals
              </Link>
            </li>
            <li>
              <Link href="/events" className="transition hover:text-white">
                Events
              </Link>
            </li>
            <li>
              <Link href="/reviews" className="transition hover:text-white">
                Customer Reviews
              </Link>
            </li>
            <li>
              <Link href="/favorites" className="transition hover:text-white">
                Favorites
              </Link>
            </li>
          </ul>
        </nav>

        <nav aria-label="Our Services">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-brand-gold">Our Services</h2>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <Link href="/services/pre-purchase-inspection" className="transition hover:text-white">
                Pre-Purchase Inspection
              </Link>
            </li>
            <li>
              <Link href="/services/car-financing" className="transition hover:text-white">
                Car Financing
              </Link>
            </li>
            <li>
              <Link href="/services/car-valuation" className="transition hover:text-white">
                Car Valuation
              </Link>
            </li>
            <li>
              <Link href="/services/car-tracking" className="transition hover:text-white">
                Car Tracking
              </Link>
            </li>
            <li>
              <Link href="/services/home-repairs" className="transition hover:text-white">
                Home Repairs
              </Link>
            </li>
          </ul>
        </nav>

        <nav aria-label="Account">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-brand-gold">Account</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {session?.user ? (
              <>
                <li>
                  <Link href="/account" className="transition hover:text-white">
                    Your account
                  </Link>
                </li>
                {(role === "SELLER" || role === "ADMIN" || role === "MODERATOR") && (
                  <li>
                    <Link href="/dashboard" className="transition hover:text-white">
                      {role === "MODERATOR" ? "Moderator dashboard" : "Seller dashboard"}
                    </Link>
                  </li>
                )}
                {role === "ADMIN" && (
                  <li>
                    <Link href="/admin" className="transition hover:text-white">
                      Admin
                    </Link>
                  </li>
                )}
              </>
            ) : (
              <>
                <li>
                  <Link href="/login" className="transition hover:text-white">
                    Log in
                  </Link>
                </li>
                <li>
                  <Link href="/register" className="transition hover:text-white">
                    Register
                  </Link>
                </li>
              </>
            )}
          </ul>
        </nav>

        <nav aria-label="Contact">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-brand-gold">Contact</h2>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <Link href="/about-us" className="transition hover:text-white">
                About Us
              </Link>
            </li>
            <li>
              <Link href="/contact" className="transition hover:text-white">
                Contact Us
              </Link>
            </li>
            <li>
              <a href={`tel:${siteConfig.contactPhone}`} className="transition hover:text-white">
                {siteConfig.contactPhone}
              </a>
            </li>
            <li>
              <a
                href={`https://wa.me/${siteConfig.whatsappNumber}`}
                target="_blank"
                rel="noopener noreferrer"
                className="transition hover:text-white"
              >
                Chat on WhatsApp
              </a>
            </li>
          </ul>
        </nav>
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto max-w-6xl px-4 py-4 text-xs text-white/60">
          &copy; {new Date().getFullYear()} {siteConfig.name}. All rights reserved.
        </div>
      </div>
    </footer>
  );
}

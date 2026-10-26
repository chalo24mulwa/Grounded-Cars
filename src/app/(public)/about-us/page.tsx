import Link from "next/link";
import type { Metadata } from "next";

// The About page is where the brand is explained, so its title leads with the
// name ("About Car Marketplace | ..."). Using the plain `title` string would
// run through the root layout's `template: "%s | Car Marketplace"` and repeat
// the name; `title.absolute` is Next.js's documented way to opt one page out
// of the parent template entirely.
export const metadata: Metadata = {
  title: { absolute: "About Grounded Cars | Buy & Sell Cars Online in Kenya" },
  description:
    "Grounded Cars is a fast-growing Kenyan online car marketplace where dealers and car owners can list vehicles for free and connect with targeted buyers. Find, buy and sell cars across Kenya while supporting community initiatives.",
  alternates: { canonical: "/about-us" },
};

const VALUES = ["Trust", "Innovation", "Accessibility", "Community"];

export default function AboutUsPage() {
  return (
    <div>
      {/* Hero — same brand gradient sweep used site-wide (header's accent
          strip, CSR progress bars) rather than a fabricated/unrelated
          photo, since no About-Us-specific imagery was supplied. */}
      <section className="bg-gradient-to-br from-brand via-brand-deep to-slate-900">
        <div className="mx-auto max-w-4xl px-4 py-16 text-center sm:py-20">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white ring-1 ring-white/25">
            About Us
          </span>
          <h1 className="mt-4 text-3xl font-bold text-white sm:text-4xl md:text-5xl">
            Driving Kenya&apos;s Car Market Forward
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-white/80 sm:text-lg">
            Grounded Cars is one of Kenya&apos;s fast-growing online marketplaces for buying and
            selling vehicles, created to make the car-buying and selling experience simpler, more
            accessible, and more connected.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-4xl px-4 py-12 sm:py-16">
        {/* Our Story */}
        <section>
          <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">Our Story</h2>
          <div className="mt-4 space-y-4 text-base leading-relaxed text-slate-600">
            <p>
              Our story began in 2016, when our founder, Chris Mulwa, was a fresh BSc Mathematics
              &amp; Computer Science graduate from Jomo Kenyatta University of Agriculture and
              Technology (JKUAT) and a passionate car enthusiast.
            </p>
            <p>
              What started as a simple idea grew into{" "}
              <span className="font-semibold text-slate-900">GroundedCars.com</span>, a platform
              created to connect customers with project cars from across Kenya. As the automotive
              market evolved, so did the vision. The platform expanded beyond project cars to
              include clean locally used vehicles, quality pre-owned cars, and fresh imports.
            </p>
            <p>Today, that vision continues through Car Marketplace.</p>
          </div>
        </section>

        {/* A Marketplace Built for Buyers and Sellers */}
        <section className="mt-12">
          <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">
            A Marketplace Built for Buyers and Sellers
          </h2>
          <div className="mt-4 space-y-4 text-base leading-relaxed text-slate-600">
            <p>
              Grounded Cars provides a digital platform where individual car owners, dealers,
              and automotive businesses can list their vehicles and connect directly with
              potential buyers.
            </p>
            <p className="font-semibold text-slate-900">
              Our goal is simple: make it easier for the right car to find the right buyer.
            </p>
            <p>
              Whether you&apos;re selling your first car, operating a dealership, looking for a
              reliable locally used vehicle, or searching for a fresh import, Grounded Cars is
              designed to bring buyers and sellers closer together.
            </p>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <p className="font-semibold text-slate-900">Free listings</p>
              <p className="mt-1 text-sm text-slate-600">
                Car owners and dealers can list their vehicles for free, giving sellers an
                opportunity to reach a targeted audience of people actively looking for cars.
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <p className="font-semibold text-slate-900">Optional promotion &amp; boosting</p>
              <p className="mt-1 text-sm text-slate-600">
                Our platform also provides optional listing promotion and boosting services,
                helping sellers give their vehicles greater visibility when they want to reach
                more potential buyers.
              </p>
            </div>
          </div>
        </section>

        {/* More Than a Marketplace / CSR */}
        <section className="mt-12 rounded-2xl border border-brand/15 bg-brand-mist p-6 sm:p-8">
          <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">More Than a Marketplace</h2>
          <div className="mt-4 space-y-4 text-base leading-relaxed text-slate-600">
            <p>We believe a successful business should create value beyond its customers.</p>
            <p>
              That is why a portion of the revenue generated through our platform&apos;s
              listing-boosting and promotional services is intended to support our{" "}
              <Link href="/csr" className="font-medium text-brand hover:underline">
                Corporate Social Responsibility (CSR)
              </Link>{" "}
              initiatives.
            </p>
            <p>
              Through these initiatives, Grounded Cars aims to contribute to communities across
              Kenya by supporting vulnerable groups and people in need, including community
              outreach, food support, and visits and assistance to vulnerable and street-connected
              children.
            </p>
          </div>

          <h3 className="mt-8 text-xl font-bold text-slate-900">Every Deal Can Make a Difference</h3>
          <div className="mt-3 space-y-4 text-base leading-relaxed text-slate-600">
            <p>
              Our vision is to create a unique connection between the automotive industry and
              social impact.
            </p>
            <p>
              We want car dealers, car-selling companies, vehicle owners, buyers, and our wider
              community to have an opportunity to participate in meaningful CSR initiatives.
            </p>
            <p>
              In the future, our platform will provide opportunities for automotive businesses and
              individuals to support selected community initiatives directly.
            </p>
            <p className="font-semibold text-slate-900">
              When the automotive community grows, we want the wider community to benefit too.
            </p>
          </div>

          <Link
            href="/csr"
            className="mt-6 inline-block rounded-md bg-brand-accent px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-accent/90"
          >
            See our CSR initiatives
          </Link>
        </section>

        {/* Vision / Mission / Values */}
        <section className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-brand-accent">
              Our Vision
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              To become one of Kenya&apos;s most trusted and innovative digital automotive
              marketplaces while using technology and business to create meaningful social impact.
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-brand-accent">
              Our Mission
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              To connect car buyers and sellers through a convenient, transparent and accessible
              digital marketplace while creating opportunities for the automotive industry to
              contribute positively to communities across Kenya.
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-brand-accent">
              Our Values
            </h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {VALUES.map((value) => (
                <span
                  key={value}
                  className="rounded-full bg-brand/10 px-3 py-1 text-sm font-medium text-brand"
                >
                  {value}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* Closing brand statement */}
        <section className="mt-16 text-center">
          <p className="text-lg leading-relaxed text-slate-700 sm:text-xl">
            We are building more than a website for cars.
            <br />
            We are building a marketplace that connects people, creates opportunities, and gives
            back.
          </p>

          <div className="mt-6 h-[3px] w-24 mx-auto rounded-full bg-gradient-to-r from-brand via-brand-gold to-brand-accent" />

          <p className="mt-6 text-2xl font-bold text-slate-900 sm:text-3xl">Grounded Cars</p>
          <p className="mt-1 bg-gradient-to-r from-brand-accent via-brand-gold to-brand bg-clip-text text-lg font-semibold text-transparent sm:text-xl">
            Find. Buy. Sell. Drive. Give Back.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/cars"
              className="rounded-md bg-brand px-5 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-brand/90"
            >
              Browse Vehicles
            </Link>
            <Link
              href="/dashboard/listings/new"
              className="rounded-md border border-brand/30 bg-white px-5 py-2.5 text-sm font-semibold text-brand transition hover:bg-brand-subtle"
            >
              List Your Car
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}

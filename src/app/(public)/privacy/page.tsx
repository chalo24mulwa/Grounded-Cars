import type { Metadata } from "next";
import Link from "next/link";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: { absolute: "Privacy Policy | Grounded Cars" },
  description:
    "How Grounded Cars collects, uses, and protects your personal information across the website and mobile apps.",
  alternates: { canonical: "/privacy" },
};

const LAST_UPDATED = "30 October 2026";

export default function PrivacyPolicyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:py-16">
      <h1 className="text-3xl font-bold text-slate-900 sm:text-4xl">Privacy Policy</h1>
      <p className="mt-2 text-sm text-slate-500">Last updated: {LAST_UPDATED}</p>

      <div className="mt-8 space-y-10 text-base leading-relaxed text-slate-700">
        <section>
          <p>
            This Privacy Policy explains how Grounded Cars (&quot;Grounded Cars&quot;,
            &quot;we&quot;, &quot;us&quot;) collects, uses, shares, and protects personal
            information when you use the Grounded Cars website (groundedcars.co.ke) and our
            Android and iOS mobile apps (together, the &quot;Service&quot;). It applies to
            everyone who visits, browses, registers an account with, or otherwise uses the
            Service.
          </p>
          <p className="mt-4">
            We aim to handle your information consistently with Kenya&apos;s Data Protection Act,
            2019, and the guidance of the Office of the Data Protection Commissioner (ODPC). If
            you have questions about this policy or your data, see{" "}
            <Link href="/contact" className="font-medium text-brand hover:underline">
              Contact Us
            </Link>{" "}
            for how to reach us.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-slate-900">Information we collect</h2>

          <h3 className="mt-5 text-lg font-semibold text-slate-900">Account information</h3>
          <p className="mt-2">
            When you register, we collect your name, email address, phone number, and a password
            (stored only as an irreversible cryptographic hash — we never store your password in
            plain text). If you sign up as a seller, the same account is used; becoming a seller
            does not require any additional personal information.
          </p>

          <h3 className="mt-5 text-lg font-semibold text-slate-900">Listings you create</h3>
          <p className="mt-2">
            If you list a vehicle, we collect the details you provide about it (make, model, year,
            price, description, condition, location, and similar), along with any photos you
            upload. Uploaded photos are watermarked with our domain and may be resized for
            display. Your listing — and your name and phone number as the seller — are shown
            publicly once a listing is approved and active, so buyers can contact you.
          </p>

          <h3 className="mt-5 text-lg font-semibold text-slate-900">
            Inquiries, favorites, and messages
          </h3>
          <p className="mt-2">
            If you contact a seller through the Service, we share your name, email, phone number,
            and message with that seller so they can respond to you. If you save (&quot;favorite&quot;)
            a listing, we record that against your account so you can find it again — this is
            never visible to anyone but you.
          </p>

          <h3 className="mt-5 text-lg font-semibold text-slate-900">Payment information</h3>
          <p className="mt-2">
            Some features — featuring a listing, donating to a CSR initiative, ordering a service,
            or purchasing an insurance policy — are paid for via M-Pesa. When you pay, we collect
            the phone number you provide and send a payment request to Safaricom&apos;s M-Pesa
            system; we record the outcome (success or failure), the amount, and the M-Pesa
            transaction reference once Safaricom confirms it. <strong>We never see or store your
            M-Pesa PIN, and we do not collect card or bank account numbers</strong> — the payment
            itself is authorized entirely on your phone through M-Pesa.
          </p>

          <h3 className="mt-5 text-lg font-semibold text-slate-900">
            Information collected automatically
          </h3>
          <p className="mt-2">
            The website uses a small number of cookies that are required for the Service to work:
            one keeps you signed in (your session), and another remembers which listings you&apos;ve
            favorited so they display correctly without extra load time. We do not use these
            cookies to track you across other websites. The mobile apps keep you signed in using
            your device&apos;s secure storage (Keychain on iOS, encrypted storage on Android)
            instead of a cookie. We also record basic technical information needed to operate the
            Service, such as which listings are viewed, for the view counts shown to sellers.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-slate-900">How we use your information</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            <li>To create and manage your account, and to let you sign in.</li>
            <li>To publish and manage listings you create, and to display them to buyers.</li>
            <li>
              To connect buyers and sellers — for example, delivering an inquiry message, or
              showing a seller&apos;s contact details on their own active listing.
            </li>
            <li>To process payments you initiate via M-Pesa, and to activate what you paid for.</li>
            <li>
              To moderate the marketplace — for example, an administrator or moderator reviewing a
              submitted listing before it goes live, or responding to a policy violation.
            </li>
            <li>To send account-related notifications (such as a listing being approved).</li>
            <li>To maintain the security of the Service and prevent abuse.</li>
          </ul>
          <p className="mt-4">
            We do not sell your personal information, and we do not use it for third-party
            advertising.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-slate-900">Who we share information with</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            <li>
              <strong>Other users, where the Service is designed to do so</strong> — e.g. a
              seller&apos;s name and phone number on their own active listing, or your contact
              details when you send an inquiry to a seller.
            </li>
            <li>
              <strong>Safaricom M-Pesa</strong>, to process a payment you initiate — we send the
              phone number and amount needed for that one transaction.
            </li>
            <li>
              <strong>Service providers who host and operate the Service on our behalf</strong>{" "}
              (for example, web hosting and database infrastructure), under obligations to protect
              your data and use it only to provide that infrastructure to us.
            </li>
            <li>
              <strong>Legal or regulatory authorities</strong>, only where we are required to by
              law.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-slate-900">How long we keep information</h2>
          <p className="mt-2">
            We retain your account and listing information for as long as your account is active.
            If you delete a listing or ask us to close your account, we remove or anonymize the
            personal information associated with it, except where we need to keep a record for
            legitimate business, accounting, or legal reasons (for example, a record of a completed
            payment).
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-slate-900">Your rights and choices</h2>
          <p className="mt-2">
            You can review and update most of your account information at any time from your
            account settings, on the website or in the app. You can also ask us to access, correct,
            or delete your personal information, or to explain how we&apos;ve used it, by reaching
            us through{" "}
            <Link href="/contact" className="font-medium text-brand hover:underline">
              Contact Us
            </Link>
            . We will respond within a reasonable time and in line with the Data Protection Act,
            2019.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-slate-900">Children</h2>
          <p className="mt-2">
            The Service is intended for people old enough to lawfully buy, sell, or enter into
            agreements regarding a vehicle in Kenya. It is not directed at children, and we do not
            knowingly collect personal information from children.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-slate-900">Security</h2>
          <p className="mt-2">
            We use reasonable technical and organizational measures to protect your information,
            including encrypted password storage, access controls restricting who can view
            administrative data, and secure storage of mobile sign-in tokens on your device. No
            method of storage or transmission is completely secure, so we cannot guarantee absolute
            security.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-slate-900">Changes to this policy</h2>
          <p className="mt-2">
            We may update this policy as the Service changes. We&apos;ll update the &quot;Last
            updated&quot; date above when we do, and significant changes will be reflected here
            before they take effect.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-slate-900">Contact us</h2>
          <p className="mt-2">
            For any question about this policy or your personal information, reach us at{" "}
            <a href={`tel:${siteConfig.contactPhone}`} className="font-medium text-brand hover:underline">
              {siteConfig.contactPhone}
            </a>{" "}
            or via{" "}
            <Link href="/contact" className="font-medium text-brand hover:underline">
              Contact Us
            </Link>
            .
          </p>
        </section>
      </div>
    </div>
  );
}

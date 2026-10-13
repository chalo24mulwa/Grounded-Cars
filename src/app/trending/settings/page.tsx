import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getViewerProfile } from "@/server/services/trending/profile-service";
import { ProfileSettingsForm } from "@/components/trending/ProfileSettingsForm";

export const metadata: Metadata = { title: "Edit Trending profile", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function TrendingSettingsPage() {
  const me = await getViewerProfile();
  if (!me) redirect(`/login?callbackUrl=${encodeURIComponent("/trending/settings")}`);
  return (
    <div className="mx-auto max-w-lg px-4 py-6">
      <h1 className="text-xl font-bold text-slate-900">Edit profile</h1>
      <p className="mt-1 text-sm text-slate-600">This is how you appear on Trending. Your email and phone number are never shown.</p>
      <ProfileSettingsForm profile={me} />
    </div>
  );
}

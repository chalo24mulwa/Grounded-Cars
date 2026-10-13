"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { updateProfileAction, setAvatarAction, removeAvatarAction, type ProfileFormState } from "@/server/actions/trending-actions";
import { Avatar } from "@/components/trending/ui";
import { BIO_MAX } from "@/lib/trending/config";

const inputClass = "mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand";

export function ProfileSettingsForm({
  profile,
}: {
  profile: { username: string; displayName: string; bio: string | null; avatarUrl: string | null };
}) {
  const [state, formAction, saving] = useActionState<ProfileFormState, FormData>(updateProfileAction, {});
  const [avatar, setAvatar] = useState(profile.avatarUrl);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [uploading, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const [bio, setBio] = useState(profile.bio ?? "");

  function upload(file: File) {
    const data = new FormData();
    data.set("avatar", file);
    start(async () => {
      const r = await setAvatarAction(data);
      if (r.ok) {
        setAvatar(r.data);
        setAvatarError(null);
      } else setAvatarError(r.error);
    });
  }

  return (
    <div className="mt-6 space-y-8">
      <section className="flex items-center gap-4">
        <Avatar src={avatar} name={profile.displayName} size={80} />
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="rounded-md bg-brand px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              {uploading ? "Uploading…" : avatar ? "Change picture" : "Add picture"}
            </button>
            {avatar && (
              <button
                type="button"
                disabled={uploading}
                onClick={() =>
                  start(async () => {
                    const r = await removeAvatarAction();
                    if (r.ok) setAvatar(null);
                    else setAvatarError(r.error);
                  })
                }
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700"
              >
                Remove
              </button>
            )}
          </div>
          <p className="text-xs text-slate-500">JPEG, PNG or WebP, up to 5MB. It&apos;s cropped to a square.</p>
          {avatarError && <p className="text-xs text-red-600">{avatarError}</p>}
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) upload(file);
              e.target.value = "";
            }}
          />
        </div>
      </section>

      <form action={formAction} className="space-y-4">
        <label className="block text-sm font-medium text-slate-700">
          Name
          <input name="displayName" defaultValue={profile.displayName} required minLength={2} maxLength={50} className={inputClass} />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Username
          <div className="mt-1 flex items-center rounded-md border border-slate-300 focus-within:border-brand focus-within:ring-1 focus-within:ring-brand">
            <span className="pl-3 text-sm text-slate-500">@</span>
            <input
              name="username"
              defaultValue={profile.username}
              required
              pattern="[a-z0-9_.]{3,24}"
              title="3-24 characters: lowercase letters, numbers, dots and underscores"
              className="block w-full rounded-md px-1 py-2 text-sm outline-none"
            />
          </div>
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Bio <span className="font-normal text-slate-400">({bio.length}/{BIO_MAX})</span>
          <textarea name="bio" value={bio} onChange={(e) => setBio(e.target.value)} maxLength={BIO_MAX} rows={3} className={inputClass} />
        </label>
        {state.error && <p className="text-sm text-red-600">{state.error}</p>}
        {state.success && <p className="text-sm text-green-700">Saved.</p>}
        <div className="flex items-center gap-3">
          <button type="submit" disabled={saving} className="rounded-md bg-brand-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
            {saving ? "Saving…" : "Save changes"}
          </button>
          <Link href="/trending" className="text-sm font-medium text-slate-600">
            Back to feed
          </Link>
        </div>
      </form>
    </div>
  );
}

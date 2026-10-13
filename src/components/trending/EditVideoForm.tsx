"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateVideoAction } from "@/server/actions/trending-actions";
import { CAPTION_MAX } from "@/lib/trending/config";

export function EditVideoForm({ id, caption, title }: { id: string; caption: string; title: string }) {
  const router = useRouter();
  const [c, setC] = useState(caption);
  const [t, setT] = useState(title);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className="mt-4 space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await updateVideoAction(id, c, t);
          if (r.ok) router.push(`/trending/v/${id}`);
          else setError(r.error);
        });
      }}
    >
      <label className="block text-sm font-medium text-slate-700">
        Title
        <input value={t} onChange={(e) => setT(e.target.value)} maxLength={100} className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
      </label>
      <label className="block text-sm font-medium text-slate-700">
        Caption
        <textarea value={c} onChange={(e) => setC(e.target.value)} required maxLength={CAPTION_MAX} rows={4} className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button disabled={pending} className="rounded-md bg-brand-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
        {pending ? "Saving…" : "Save"}
      </button>
    </form>
  );
}

"use client";

import Link from "next/link";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import type { InquiryStatus } from "@prisma/client";
import { updateInquiryStatusAction } from "@/server/actions/inquiry-actions";

const STATUS_LABEL: Record<InquiryStatus, string> = {
  NEW: "New",
  READ: "Read",
  REPLIED: "Replied",
  CLOSED: "Closed",
};

const STATUS_CLASS: Record<InquiryStatus, string> = {
  NEW: "bg-status-pending/10 text-status-pending",
  READ: "bg-status-active/10 text-status-active",
  REPLIED: "bg-brand/10 text-brand",
  CLOSED: "bg-status-archived/10 text-status-archived",
};

export type InquiryRowData = {
  id: string;
  status: InquiryStatus;
  name: string;
  email: string;
  phone: string | null;
  message: string;
  createdAt: string;
  listing: { title: string; slug: string; status: string };
};

export function InquiryRow({ inquiry }: { inquiry: InquiryRowData }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function setStatus(status: InquiryStatus) {
    startTransition(async () => {
      await updateInquiryStatusAction(inquiry.id, status);
      router.refresh();
    });
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <Link
            href={`/cars/${inquiry.listing.slug}`}
            className="text-sm font-semibold text-slate-900 hover:text-brand"
          >
            {inquiry.listing.title}
          </Link>
          <p className="text-xs text-slate-400">
            {new Date(inquiry.createdAt).toLocaleString()}
          </p>
        </div>
        <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[inquiry.status]}`}>
          {STATUS_LABEL[inquiry.status]}
        </span>
      </div>

      <p className="mt-2 whitespace-pre-line text-sm text-slate-700">{inquiry.message}</p>

      <div className="mt-2 text-xs text-slate-500">
        From <span className="font-medium text-slate-700">{inquiry.name}</span> ·{" "}
        <a href={`mailto:${inquiry.email}`} className="hover:text-brand">
          {inquiry.email}
        </a>
        {inquiry.phone && (
          <>
            {" "}
            ·{" "}
            <a href={`tel:${inquiry.phone}`} className="hover:text-brand">
              {inquiry.phone}
            </a>
          </>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {inquiry.status === "NEW" && (
          <button
            type="button"
            disabled={isPending}
            onClick={() => setStatus("READ")}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-brand-subtle disabled:opacity-50"
          >
            Mark as read
          </button>
        )}
        {(inquiry.status === "NEW" || inquiry.status === "READ") && (
          <button
            type="button"
            disabled={isPending}
            onClick={() => setStatus("REPLIED")}
            className="rounded-md border border-brand px-3 py-1.5 text-xs font-medium text-brand hover:bg-brand/5 disabled:opacity-50"
          >
            Mark as replied
          </button>
        )}
        {inquiry.status !== "CLOSED" && (
          <button
            type="button"
            disabled={isPending}
            onClick={() => setStatus("CLOSED")}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-brand-subtle disabled:opacity-50"
          >
            Close
          </button>
        )}
        {inquiry.status === "CLOSED" && (
          <button
            type="button"
            disabled={isPending}
            onClick={() => setStatus("READ")}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-brand-subtle disabled:opacity-50"
          >
            Reopen
          </button>
        )}
      </div>
    </div>
  );
}

import Link from "next/link";
import { UploadedImage } from "@/components/ui/UploadedImage";
import { CsrProgressBar } from "@/components/csr/CsrProgressBar";

type CardInitiative = {
  slug: string;
  title: string;
  summary: string;
  coverImageUrl: string | null;
  targetAmount: number;
  amountRaised: number;
  currency: string;
  status: "ACTIVE" | "COMPLETED";
};

export function CsrInitiativeCard({ initiative }: { initiative: CardInitiative }) {
  return (
    <div className="group flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md">
      <Link href={`/csr/${initiative.slug}`} className="relative aspect-[16/10] w-full bg-slate-100">
        {initiative.coverImageUrl ? (
          <UploadedImage
            src={initiative.coverImageUrl}
            alt={initiative.title}
            fill
            className="object-cover transition group-hover:scale-[1.02]"
            sizes="(max-width: 768px) 100vw, 33vw"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-slate-400">Grounded Cars CSR</div>
        )}
        <span
          className={
            initiative.status === "ACTIVE"
              ? "absolute right-3 top-3 rounded-full bg-status-active px-2.5 py-1 text-xs font-semibold text-white shadow"
              : "absolute right-3 top-3 rounded-full bg-slate-700 px-2.5 py-1 text-xs font-semibold text-white shadow"
          }
        >
          {initiative.status === "ACTIVE" ? "Active" : "Completed"}
        </span>
      </Link>

      <div className="flex flex-1 flex-col p-4">
        <Link href={`/csr/${initiative.slug}`}>
          <h3 className="font-semibold text-slate-900 hover:text-brand">{initiative.title}</h3>
        </Link>
        <p className="mt-1 line-clamp-2 flex-1 text-sm text-slate-600">{initiative.summary}</p>

        <div className="mt-4">
          <CsrProgressBar
            raised={initiative.amountRaised}
            target={initiative.targetAmount}
            currency={initiative.currency}
            size="sm"
          />
        </div>

        <Link
          href={`/csr/${initiative.slug}#donate`}
          className="mt-4 rounded-md bg-brand-accent px-4 py-2 text-center text-sm font-semibold text-white transition hover:bg-brand-accent/90"
        >
          Donate
        </Link>
      </div>
    </div>
  );
}

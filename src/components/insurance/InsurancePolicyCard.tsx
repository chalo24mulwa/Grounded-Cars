import { UploadedImage } from "@/components/ui/UploadedImage";
import Link from "next/link";
import { ShareButton } from "@/components/share/ShareButton";

export function InsurancePolicyCard({
  policy,
}: {
  policy: {
    id: string;
    title: string;
    description: string;
    startingPrice: number;
    currency: string;
    imageUrl: string | null;
  };
}) {
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md">
      <div className="relative aspect-[16/10] w-full bg-slate-100">
        {policy.imageUrl ? (
          <UploadedImage
            src={policy.imageUrl}
            alt={policy.title}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 33vw"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-slate-400">
            Car Marketplace
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col p-5">
        <h3 className="font-semibold text-slate-900">{policy.title}</h3>
        <p className="mt-2 line-clamp-3 flex-1 text-sm text-slate-600">{policy.description}</p>

        {/* Now that "Buy Now" charges exactly this amount (see
            InsurancePurchaseForm / initiateInsurancePurchase), this reads
            as the real price rather than a "from" range-starting-point —
            same underlying startingPrice field, just clearer public copy. */}
        <div className="mt-4 flex items-center justify-between gap-2">
          <p className="text-lg font-bold text-brand">
            {policy.currency} {policy.startingPrice.toLocaleString()}
          </p>
          <ShareButton
            target={{
              path: `/services/car-insurance/${policy.id}`,
              title: policy.title,
              subtitle: `${policy.currency} ${policy.startingPrice.toLocaleString()}`,
              imageUrl: policy.imageUrl ?? undefined,
            }}
          />
        </div>

        <Link
          href={`/services/car-insurance/${policy.id}`}
          className="mt-4 rounded-md bg-brand-accent px-4 py-2 text-center text-sm font-semibold text-white transition hover:bg-brand-accent/90"
        >
          Buy Now / Get Cover
        </Link>
      </div>
    </div>
  );
}

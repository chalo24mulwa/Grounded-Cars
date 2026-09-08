export function CsrProgressBar({
  raised,
  target,
  currency,
  size = "md",
}: {
  raised: number;
  target: number;
  currency: string;
  size?: "sm" | "md";
}) {
  const pct = target > 0 ? Math.min(100, Math.round((raised / target) * 100)) : 0;

  return (
    <div>
      <div className={`w-full overflow-hidden rounded-full bg-slate-100 ${size === "sm" ? "h-1.5" : "h-2.5"}`}>
        <div
          className="h-full rounded-full bg-gradient-to-r from-brand via-brand-gold to-brand-accent"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className={`mt-1.5 flex items-baseline justify-between ${size === "sm" ? "text-xs" : "text-sm"}`}>
        <span className="font-semibold text-slate-900">
          {currency} {raised.toLocaleString()}{" "}
          <span className="font-normal text-slate-500">raised of {currency} {target.toLocaleString()}</span>
        </span>
        <span className="font-semibold text-brand-accent">{pct}%</span>
      </div>
    </div>
  );
}

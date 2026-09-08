export function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 text-center">
      <p className="text-2xl font-bold text-brand">{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}

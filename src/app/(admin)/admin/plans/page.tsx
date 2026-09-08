import { getAllFeaturedPlansForAdmin } from "@/server/services/featured-service";
import { CreatePlanForm } from "@/components/admin/CreatePlanForm";
import { PlanToggleButton } from "@/components/admin/PlanToggleButton";

export const metadata = { title: "Featured Plans" };

// Auth/role check lives in the (admin) layout now — getAllFeaturedPlansForAdmin()
// still independently requires ADMIN, so data access is never gated by the
// layout alone. Small, deliberately un-fancy admin CRUD — retiring a plan
// (active: false) is the only "delete" offered, since
// FeaturedSubscription.planId references plans with onDelete: Restrict; a
// real delete would either fail loudly on any plan that's ever been
// purchased, or (worse) silently orphan history.
export default async function AdminPlansPage() {
  const plans = await getAllFeaturedPlansForAdmin();

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">Featured Plans</h1>

      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4">
        <CreatePlanForm />
      </div>

      <div className="mt-6 space-y-3">
        {plans.map((plan) => (
          <div
            key={plan.id}
            className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4"
          >
            <div>
              <p className="font-semibold text-slate-900">{plan.name}</p>
              <p className="text-sm text-slate-500">
                {plan.durationDays} days · {plan.currency} {Number(plan.price).toLocaleString()}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span
                className={
                  plan.active
                    ? "rounded-md bg-status-active/10 px-2 py-0.5 text-xs font-medium text-status-active"
                    : "rounded-md bg-status-archived/10 px-2 py-0.5 text-xs font-medium text-status-archived"
                }
              >
                {plan.active ? "Active" : "Retired"}
              </span>
              <PlanToggleButton planId={plan.id} active={plan.active} />
            </div>
          </div>
        ))}
        {plans.length === 0 && (
          <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">
            No plans yet — add one above.
          </p>
        )}
      </div>
    </div>
  );
}

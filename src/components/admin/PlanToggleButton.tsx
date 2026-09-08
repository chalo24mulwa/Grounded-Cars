"use client";

import { ActionButton } from "@/components/dashboard/ActionButton";
import { setFeaturedPlanActiveAction } from "@/server/actions/admin-actions";

export function PlanToggleButton({ planId, active }: { planId: string; active: boolean }) {
  return (
    <ActionButton
      label={active ? "Retire" : "Reactivate"}
      variant={active ? "danger" : "primary"}
      onAction={() => setFeaturedPlanActiveAction(planId, !active)}
    />
  );
}

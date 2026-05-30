import { createClient } from "@/lib/supabase/server";
import { getCurrentHouseholdId } from "@/lib/supabase/household";
import { PageShell } from "@/components/page-shell";
import { GoalsClient } from "@/components/goals-client";
import type { Goal, GoalWithProgress } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function GoalsPage() {
  const supabase = await createClient();
  const householdId = await getCurrentHouseholdId();

  const [goalsRes, depositsRes] = await Promise.all([
    supabase
      .from("goals")
      .select("*")
      .eq("household_id", householdId ?? "")
      .order("status")
      .order("sort_order")
      .order("created_at"),
    supabase
      .from("expenses")
      .select("goal_id, amount")
      .eq("household_id", householdId ?? "")
      .not("goal_id", "is", null),
  ]);

  const goals = (goalsRes.data ?? []) as Goal[];

  // Sum tagged Nabung deposits per goal.
  const savedByGoal = new Map<string, number>();
  (depositsRes.data ?? []).forEach((d) => {
    if (!d.goal_id) return;
    savedByGoal.set(d.goal_id, (savedByGoal.get(d.goal_id) ?? 0) + Number(d.amount));
  });

  const goalsWithProgress: GoalWithProgress[] = goals.map((g) => ({
    ...g,
    saved: savedByGoal.get(g.id) ?? 0,
  }));

  return (
    <PageShell title="Goals Keluarga 🎯" subtitle="Target keuangan yang lagi dikejar">
      <GoalsClient
        householdId={householdId ?? ""}
        initialGoals={goalsWithProgress}
      />
    </PageShell>
  );
}

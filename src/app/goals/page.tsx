import { createClient } from "@/lib/supabase/server";
import { getCurrentHouseholdId } from "@/lib/supabase/household";
import { PageShell } from "@/components/page-shell";
import { GoalsClient } from "@/components/goals-client";
import type { Goal, GoalWithProgress } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function GoalsPage() {
  const supabase = await createClient();
  const householdId = await getCurrentHouseholdId();

  const [goalsRes, depositsRes, withdrawalsRes, hhRes, cpRes] = await Promise.all([
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
    supabase
      .from("incomes")
      .select("goal_id, amount")
      .eq("household_id", householdId ?? "")
      .not("goal_id", "is", null),
    supabase
      .from("households")
      .select("pay_day_of_month")
      .eq("id", householdId ?? "")
      .maybeSingle(),
    supabase
      .from("custom_periods")
      .select("label_month, start_date, end_date")
      .eq("household_id", householdId ?? ""),
  ]);

  const goals = (goalsRes.data ?? []) as Goal[];
  const payDay = hhRes.data?.pay_day_of_month ?? 25;
  const customPeriods = cpRes.data ?? [];

  // Sum tagged Nabung deposits minus withdrawals per goal.
  const savedByGoal = new Map<string, number>();
  (depositsRes.data ?? []).forEach((d) => {
    if (!d.goal_id) return;
    savedByGoal.set(d.goal_id, (savedByGoal.get(d.goal_id) ?? 0) + Number(d.amount));
  });
  (withdrawalsRes.data ?? []).forEach((w) => {
    if (!w.goal_id) return;
    savedByGoal.set(w.goal_id, (savedByGoal.get(w.goal_id) ?? 0) - Number(w.amount));
  });

  const goalsWithProgress: GoalWithProgress[] = goals.map((g) => ({
    ...g,
    saved: Math.max(0, savedByGoal.get(g.id) ?? 0),
  }));

  return (
    <PageShell title="Goals Keluarga" subtitle="Target keuangan yang lagi dikejar">
      <GoalsClient
        householdId={householdId ?? ""}
        initialGoals={goalsWithProgress}
        payDay={payDay}
        customPeriods={customPeriods}
      />
    </PageShell>
  );
}

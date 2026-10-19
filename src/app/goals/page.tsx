import { createClient } from "@/lib/supabase/server";
import { getCurrentHouseholdId } from "@/lib/supabase/household";
import { PageShell } from "@/components/page-shell";
import { GoalsClient } from "@/components/goals-client";
import type { Goal, GoalWithProgress } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function GoalsPage() {
  const supabase = await createClient();
  const householdId = await getCurrentHouseholdId();

  const [goalsRes, depositsRes, unallocatedRes, withdrawalsRes, hhRes, cpRes] = await Promise.all([
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
      .from("expenses")
      .select("id, amount, categories!inner(name)")
      .eq("household_id", householdId ?? "")
      .is("goal_id", null)
      .ilike("categories.name", "%nabung%"),
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

  let goals = (goalsRes.data ?? []) as Goal[];
  let generalGoal = goals.find((g) => /general|umum/i.test(g.name));

  // Auto-ensure Tabungan General exists for this household
  if (!generalGoal && householdId) {
    const { data: createdGeneral } = await supabase
      .from("goals")
      .insert({
        household_id: householdId,
        name: "Tabungan General",
        target_amount: 0,
        emoji: "coins",
        color: "#10b981",
        status: "active",
        sort_order: -1,
      })
      .select("*")
      .single();

    if (createdGeneral) {
      generalGoal = createdGeneral as Goal;
      goals = [generalGoal, ...goals];
    }
  }

  // Link any unallocated nabung expenses to Tabungan General
  const unallocated = (unallocatedRes.data ?? []);
  if (unallocated.length > 0 && generalGoal) {
    const ids = unallocated.map((u) => u.id);
    await supabase.from("expenses").update({ goal_id: generalGoal.id }).in("id", ids);
  }

  const payDay = hhRes.data?.pay_day_of_month ?? 25;
  const customPeriods = cpRes.data ?? [];

  // Sum tagged Nabung deposits minus withdrawals per goal.
  const savedByGoal = new Map<string, number>();
  (depositsRes.data ?? []).forEach((d) => {
    if (!d.goal_id) return;
    savedByGoal.set(d.goal_id, (savedByGoal.get(d.goal_id) ?? 0) + Number(d.amount));
  });

  // Also include unallocated amounts in generalGoal immediately if not already in depositsRes
  if (generalGoal && unallocated.length > 0) {
    const unallocatedSum = unallocated.reduce((sum, u) => sum + Number(u.amount), 0);
    savedByGoal.set(
      generalGoal.id,
      (savedByGoal.get(generalGoal.id) ?? 0) + unallocatedSum
    );
  }

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

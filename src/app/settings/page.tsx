import { createClient } from "@/lib/supabase/server";
import { getCurrentHouseholdId } from "@/lib/supabase/household";
import { PageShell } from "@/components/page-shell";
import { SettingsClient } from "@/components/settings-client";
import { currentPeriodLabelWithCustom, labelMonthKey } from "@/lib/period";
import type { Category, Goal, GoalWithProgress, Event } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const supabase = await createClient();
  const householdId = await getCurrentHouseholdId();

  const [
    catRes,
    hhRes,
    userRes,
    cpRes,
    goalsRes,
    depositsRes,
    withdrawalsRes,
    eventsRes,
    eventExpensesRes,
  ] = await Promise.all([
    supabase
      .from("categories")
      .select("*")
      .eq("household_id", householdId ?? "")
      .order("sort_order"),
    supabase
      .from("households")
      .select("id, pay_day_of_month")
      .eq("id", householdId ?? "")
      .maybeSingle(),
    supabase.auth.getUser(),
    supabase
      .from("custom_periods")
      .select("label_month, start_date, end_date")
      .eq("household_id", householdId ?? ""),
    supabase
      .from("goals")
      .select("*")
      .eq("household_id", householdId ?? "")
      .eq("status", "active")
      .order("sort_order"),
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
      .from("events")
      .select("*")
      .eq("household_id", householdId ?? "")
      .order("start_date", { ascending: false }),
    supabase
      .from("expenses")
      .select("event_id, amount")
      .eq("household_id", householdId ?? "")
      .not("event_id", "is", null),
  ]);

  const payDay = hhRes.data?.pay_day_of_month ?? 25;
  const customPeriods = cpRes.data ?? [];
  const initialLabelMonth = labelMonthKey(currentPeriodLabelWithCustom(payDay, customPeriods));
  const goals = (goalsRes.data ?? []) as Goal[];

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

  const spentByEvent = new Map<string, number>();
  (eventExpensesRes.data ?? []).forEach((exp) => {
    if (exp.event_id) {
      spentByEvent.set(exp.event_id, (spentByEvent.get(exp.event_id) || 0) + (exp.amount || 0));
    }
  });

  const eventsWithTotal = ((eventsRes.data ?? []) as Event[]).map((evt) => ({
    ...evt,
    totalSpent: spentByEvent.get(evt.id) || 0,
  }));

  return (
    <PageShell title="Pengaturan" subtitle="Periode, kategori, budget, income">
      <SettingsClient
        householdId={householdId ?? ""}
        categories={(catRes.data ?? []) as Category[]}
        payDay={payDay}
        initialLabelMonth={initialLabelMonth}
        email={userRes.data.user?.email ?? ""}
        customPeriods={customPeriods}
        initialGoals={goalsWithProgress}
        events={eventsWithTotal}
      />
    </PageShell>
  );
}

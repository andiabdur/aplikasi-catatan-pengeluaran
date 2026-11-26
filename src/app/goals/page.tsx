import { createClient } from "@/lib/supabase/server";
import { getCurrentHouseholdId } from "@/lib/supabase/household";
import {
  currentPeriodLabelWithCustom,
  getPeriodRange,
  isoDate,
  periodTitle,
} from "@/lib/period";
import { PageShell } from "@/components/page-shell";
import {
  GoalsClient,
  type GoalTransactionItem,
  type GoalWithDetails,
} from "@/components/goals-client";
import type { Goal } from "@/lib/types";

export const dynamic = "force-dynamic";

type RawDepositExpense = {
  id: string;
  goal_id: string | null;
  amount: number;
  description: string;
  spent_at: string;
  note: string | null;
};

type RawUnallocatedExpense = {
  id: string;
  amount: number;
  description: string;
  spent_at: string;
  note: string | null;
};

type RawWithdrawIncome = {
  id: string;
  goal_id: string | null;
  amount: number;
  source: string;
  month: string;
  created_at: string;
};

export default async function GoalsPage() {
  const supabase = await createClient();
  const householdId = await getCurrentHouseholdId();

  const [
    goalsRes,
    depositsRes,
    unallocatedRes,
    withdrawalsRes,
    categoriesRes,
    hhRes,
    cpRes,
  ] = householdId
    ? await Promise.all([
        supabase
          .from("goals")
          .select("*")
          .eq("household_id", householdId)
          .order("status")
          .order("sort_order")
          .order("created_at"),
        supabase
          .from("expenses")
          .select("id, goal_id, amount, description, spent_at, note")
          .eq("household_id", householdId)
          .not("goal_id", "is", null)
          .order("spent_at", { ascending: false })
          .order("created_at", { ascending: false }),
        supabase
          .from("expenses")
          .select("id, amount, description, spent_at, note, categories!inner(name)")
          .eq("household_id", householdId)
          .is("goal_id", null)
          .ilike("categories.name", "%nabung%"),
        supabase
          .from("incomes")
          .select("id, goal_id, amount, source, month, created_at")
          .eq("household_id", householdId)
          .not("goal_id", "is", null)
          .order("month", { ascending: false })
          .order("created_at", { ascending: false }),
        supabase
          .from("categories")
          .select("id, name")
          .eq("household_id", householdId)
          .eq("is_archived", false)
          .order("sort_order"),
        supabase
          .from("households")
          .select("pay_day_of_month")
          .eq("id", householdId)
          .maybeSingle(),
        supabase
          .from("custom_periods")
          .select("label_month, start_date, end_date")
          .eq("household_id", householdId),
      ])
    : [
        { data: [] },
        { data: [] },
        { data: [] },
        { data: [] },
        { data: [] },
        { data: null },
        { data: [] },
      ];

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
        color: "#0F766E",
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
  const unallocated = (unallocatedRes.data ?? []) as unknown as RawUnallocatedExpense[];
  if (unallocated.length > 0 && generalGoal) {
    const ids = unallocated.map((u) => u.id);
    await supabase.from("expenses").update({ goal_id: generalGoal.id }).in("id", ids);
  }

  const payDay = hhRes.data?.pay_day_of_month ?? 25;
  const customPeriods = cpRes.data ?? [];
  const today = new Date();
  const todayStr = isoDate(today);
  const currentPeriod = currentPeriodLabelWithCustom(payDay, customPeriods, today);
  const currentRange = getPeriodRange(currentPeriod, payDay, customPeriods);
  const currentPeriodTitle = periodTitle(currentPeriod);

  const savingsCategory = (categoriesRes.data ?? []).find((c) =>
    /nabung|tabung/i.test(c.name)
  );

  const depositedMap = new Map<string, number>();
  const withdrawnMap = new Map<string, number>();
  const depositCountMap = new Map<string, number>();
  const withdrawCountMap = new Map<string, number>();
  const periodDepositMap = new Map<string, number>();
  const txMap = new Map<string, GoalTransactionItem[]>();

  const pushTx = (goalId: string, tx: GoalTransactionItem) => {
    const list = txMap.get(goalId) ?? [];
    list.push(tx);
    txMap.set(goalId, list);
  };

  for (const d of (depositsRes.data ?? []) as RawDepositExpense[]) {
    if (!d.goal_id) continue;
    const amt = Number(d.amount) || 0;
    depositedMap.set(d.goal_id, (depositedMap.get(d.goal_id) ?? 0) + amt);
    depositCountMap.set(d.goal_id, (depositCountMap.get(d.goal_id) ?? 0) + 1);
    if (d.spent_at >= currentRange.from && d.spent_at <= currentRange.to) {
      periodDepositMap.set(d.goal_id, (periodDepositMap.get(d.goal_id) ?? 0) + amt);
    }
    pushTx(d.goal_id, {
      id: d.id,
      type: "deposit",
      date: d.spent_at,
      title: d.description || "Setoran Tabungan",
      note: d.note,
      amount: amt,
    });
  }

  if (generalGoal && unallocated.length > 0) {
    for (const u of unallocated) {
      const amt = Number(u.amount) || 0;
      depositedMap.set(generalGoal.id, (depositedMap.get(generalGoal.id) ?? 0) + amt);
      depositCountMap.set(generalGoal.id, (depositCountMap.get(generalGoal.id) ?? 0) + 1);
      if (u.spent_at >= currentRange.from && u.spent_at <= currentRange.to) {
        periodDepositMap.set(
          generalGoal.id,
          (periodDepositMap.get(generalGoal.id) ?? 0) + amt
        );
      }
      pushTx(generalGoal.id, {
        id: u.id,
        type: "deposit",
        date: u.spent_at,
        title: u.description || "Setoran Tabungan",
        note: u.note,
        amount: amt,
      });
    }
  }

  for (const w of (withdrawalsRes.data ?? []) as RawWithdrawIncome[]) {
    if (!w.goal_id) continue;
    const amt = Number(w.amount) || 0;
    withdrawnMap.set(w.goal_id, (withdrawnMap.get(w.goal_id) ?? 0) + amt);
    withdrawCountMap.set(w.goal_id, (withdrawCountMap.get(w.goal_id) ?? 0) + 1);
    pushTx(w.goal_id, {
      id: w.id,
      type: "withdraw",
      date: (w.created_at || w.month).slice(0, 10),
      monthKey: w.month,
      title: w.source || "Penarikan Tabungan",
      note: null,
      amount: amt,
    });
  }

  const goalsWithDetails: GoalWithDetails[] = goals.map((g) => {
    const totalDeposited = depositedMap.get(g.id) ?? 0;
    const totalWithdrawn = withdrawnMap.get(g.id) ?? 0;
    const saved = Math.max(0, totalDeposited - totalWithdrawn);
    const txs = (txMap.get(g.id) ?? []).slice().sort((a, b) => b.date.localeCompare(a.date));

    return {
      ...g,
      saved,
      totalDeposited,
      totalWithdrawn,
      depositCount: depositCountMap.get(g.id) ?? 0,
      withdrawCount: withdrawCountMap.get(g.id) ?? 0,
      depositedThisPeriod: periodDepositMap.get(g.id) ?? 0,
      transactions: txs,
    };
  });

  return (
    <PageShell
      title="Tabungan & Goals"
      subtitle="Pantau saldo, target & mutasi tabungan"
    >
      <GoalsClient
        householdId={householdId ?? ""}
        todayStr={todayStr}
        initialGoals={goalsWithDetails}
        savingsCategoryId={savingsCategory?.id ?? null}
        payDay={payDay}
        customPeriods={customPeriods}
        currentPeriodTitle={currentPeriodTitle}
      />
    </PageShell>
  );
}

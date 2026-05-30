import { createClient } from "@/lib/supabase/server";
import {
  currentPeriodLabelWithCustom,
  labelMonthKey,
  shiftPeriod,
  periodTitle,
} from "@/lib/period";
import type { MonthlySummaryRow } from "@/lib/types";

// Single source of truth for the "what does this family's money look like"
// digest. Used by both the AI advisor (structured analysis) and the AI chat
// (free-form Q&A) so they always reason over identical data.

type ServerClient = Awaited<ReturnType<typeof createClient>>;

export type FinancialContext = {
  digest: string;
  goalDigest: string;
  catList: { id: string; name: string }[];
  periodsAnalyzed: string[];
  nextLabelMonth: string;
  nextPeriodTitle: string;
};

export async function buildFinancialContext(
  supabase: ServerClient,
  householdId: string,
  periodsToAnalyze = 3,
): Promise<FinancialContext | null> {
  const [hhRes, cpRes, goalsRes, depositsRes] = await Promise.all([
    supabase.from("households").select("pay_day_of_month").eq("id", householdId).maybeSingle(),
    supabase.from("custom_periods").select("label_month, start_date, end_date").eq("household_id", householdId),
    supabase.from("goals").select("id,name,target_amount,target_date,status").eq("household_id", householdId).eq("status", "active"),
    supabase.from("expenses").select("goal_id, amount").eq("household_id", householdId).not("goal_id", "is", null),
  ]);

  const payDay = hhRes.data?.pay_day_of_month ?? 25;
  const customPeriods = cpRes.data ?? [];
  const goals = goalsRes.data ?? [];

  const savedByGoal = new Map<string, number>();
  (depositsRes.data ?? []).forEach((d) => {
    if (!d.goal_id) return;
    savedByGoal.set(d.goal_id, (savedByGoal.get(d.goal_id) ?? 0) + Number(d.amount));
  });

  const currentLabel = currentPeriodLabelWithCustom(payDay, customPeriods);
  const labels: Date[] = [];
  for (let i = periodsToAnalyze - 1; i >= 0; i--) {
    labels.push(shiftPeriod(currentLabel, -i));
  }
  const nextLabel = shiftPeriod(currentLabel, 1);

  const perPeriod = await Promise.all(
    labels.map(async (lbl) => {
      const key = labelMonthKey(lbl);
      const [sumRes, incRes] = await Promise.all([
        supabase.rpc("f_period_summary", { p_household_id: householdId, p_label_month: key }),
        supabase.from("incomes").select("source, amount").eq("household_id", householdId).eq("month", key),
      ]);
      const rows = (sumRes.data ?? []) as MonthlySummaryRow[];
      const income = (incRes.data ?? []).reduce((s, r) => s + Number(r.amount), 0);
      return { key, title: periodTitle(lbl), rows, income };
    }),
  );

  const latest = perPeriod[perPeriod.length - 1];
  const catList = (latest?.rows ?? []).map((r) => ({ id: r.category_id, name: r.category_name }));
  if (catList.length === 0) return null;

  const digest = perPeriod
    .map((p) => {
      const lines = p.rows
        .map(
          (r) =>
            `   - ${r.category_name}: budget ${Math.round(Number(r.budget))}, terpakai ${Math.round(
              Number(r.spent),
            )} (${Math.round(Number(r.usage_pct))}%)`,
        )
        .join("\n");
      return `${p.title} — pemasukan ${Math.round(p.income)}:\n${lines}`;
    })
    .join("\n\n");

  const goalDigest = goals.length
    ? goals
        .map((g) => {
          const saved = savedByGoal.get(g.id) ?? 0;
          const pct = g.target_amount > 0 ? Math.round((saved / Number(g.target_amount)) * 100) : 0;
          return `- ${g.name}: terkumpul ${Math.round(saved)} dari target ${Math.round(
            Number(g.target_amount),
          )} (${pct}%)${g.target_date ? `, target tanggal ${g.target_date}` : ""}`;
        })
        .join("\n")
    : "(belum ada goal)";

  return {
    digest,
    goalDigest,
    catList,
    periodsAnalyzed: perPeriod.map((p) => p.title),
    nextLabelMonth: labelMonthKey(nextLabel),
    nextPeriodTitle: periodTitle(nextLabel),
  };
}

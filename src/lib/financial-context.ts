import { createClient } from "@/lib/supabase/server";
import {
  currentPeriodLabelWithCustom,
  labelMonthKey,
  shiftPeriod,
  periodTitle,
  getPeriodRange,
} from "@/lib/period";
import type { MonthlySummaryRow } from "@/lib/types";

// Single source of truth for the "what does this family's money look like"
// digest. Used by both the AI advisor (structured analysis) and the AI chat
// (free-form Q&A) so they always reason over identical data.

type ServerClient = Awaited<ReturnType<typeof createClient>>;

export type FinancialContext = {
  digest: string;
  itemDigest: string;
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
      const range = getPeriodRange(lbl, payDay, customPeriods);
      const [sumRes, incRes, expRes] = await Promise.all([
        supabase.rpc("f_period_summary", { p_household_id: householdId, p_label_month: key }),
        supabase.from("incomes").select("source, amount").eq("household_id", householdId).eq("month", key),
        supabase
          .from("expenses")
          .select("spent_at, created_at, description, amount, category_id")
          .eq("household_id", householdId)
          .gte("spent_at", range.from)
          .lte("spent_at", range.to)
          .order("spent_at", { ascending: true })
          .order("created_at", { ascending: true }),
      ]);
      const rows = (sumRes.data ?? []) as MonthlySummaryRow[];
      const income = (incRes.data ?? []).reduce((s, r) => s + Number(r.amount), 0);
      const items = (expRes.data ?? []) as { spent_at: string; created_at: string; description: string; amount: number; category_id: string }[];
      return { key, title: periodTitle(lbl), rows, income, items };
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

  const ID_DAYS = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  const ID_MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

  function fmtDateLabel(spent_at: string) {
    const [y, m, d] = spent_at.split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    return `${ID_DAYS[dt.getDay()]}, ${d} ${ID_MONTHS[m - 1]} ${y}`;
  }

  function fmtTime(created_at: string) {
    // created_at is UTC — convert to WIB (UTC+7)
    const dt = new Date(created_at);
    const wib = new Date(dt.getTime() + 7 * 60 * 60 * 1000);
    const hh = String(wib.getUTCHours()).padStart(2, "0");
    const mm = String(wib.getUTCMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
  }

  const itemDigest = perPeriod
    .map((p) => {
      if (p.items.length === 0) return `${p.title}:\n   (tidak ada transaksi)`;
      const catNameMap = new Map(p.rows.map((r) => [r.category_id, r.category_name]));

      // Group by spent_at date
      const byDate = new Map<string, string[]>();
      p.items.forEach((item) => {
        const catName = catNameMap.get(item.category_id) ?? "Lainnya";
        const time = fmtTime(item.created_at);
        const line = `     ${time} — ${item.description || "(no desc)"} [${catName}]: ${Math.round(Number(item.amount)).toLocaleString("id-ID")}`;
        if (!byDate.has(item.spent_at)) byDate.set(item.spent_at, []);
        byDate.get(item.spent_at)!.push(line);
      });

      const dayBlocks = Array.from(byDate.entries())
        .map(([date, lines]) => `   ${fmtDateLabel(date)}:\n${lines.join("\n")}`)
        .join("\n");

      return `${p.title}:\n${dayBlocks}`;
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
    itemDigest,
    goalDigest,
    catList,
    periodsAnalyzed: perPeriod.map((p) => p.title),
    nextLabelMonth: labelMonthKey(nextLabel),
    nextPeriodTitle: periodTitle(nextLabel),
  };
}

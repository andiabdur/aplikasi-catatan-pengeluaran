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
  eventDigest: string;
  memoryDigest: string;
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
  const [hhRes, cpRes, goalsRes, depositsRes, eventsRes, eventExpensesRes, memoriesRes] = await Promise.all([
    supabase.from("households").select("pay_day_of_month").eq("id", householdId).maybeSingle(),
    supabase.from("custom_periods").select("label_month, start_date, end_date").eq("household_id", householdId),
    supabase.from("goals").select("id,name,target_amount,target_date,status").eq("household_id", householdId).eq("status", "active"),
    supabase.from("expenses").select("goal_id, amount").eq("household_id", householdId).not("goal_id", "is", null),
    supabase.from("events").select("id,name,status,start_date,end_date").eq("household_id", householdId),
    supabase.from("expenses").select("event_id, amount, description, spent_at").eq("household_id", householdId).not("event_id", "is", null),
    supabase.from("ai_memories").select("id, content, created_at").eq("household_id", householdId).order("created_at", { ascending: false }).limit(25),
  ]);

  const payDay = hhRes.data?.pay_day_of_month ?? 25;
  const customPeriods = cpRes.data ?? [];
  const goals = goalsRes.data ?? [];
  const memories = memoriesRes.data ?? [];

  const memoryDigest = memories.length
    ? memories.map((m) => `- (id: ${m.id}) ${m.content}`).join("\n")
    : "(belum ada catatan memori tersimpan)";

  const savedByGoal = new Map<string, number>();
  (depositsRes.data ?? []).forEach((d) => {
    if (!d.goal_id) return;
    savedByGoal.set(d.goal_id, (savedByGoal.get(d.goal_id) ?? 0) + Number(d.amount));
  });

  const eventExpenseMap = new Map<string, { totalSpent: number; count: number; items: string[] }>();
  (eventExpensesRes.data ?? []).forEach((exp) => {
    if (!exp.event_id) return;
    const cur = eventExpenseMap.get(exp.event_id) ?? { totalSpent: 0, count: 0, items: [] };
    cur.totalSpent += Number(exp.amount || 0);
    cur.count += 1;
    if (cur.items.length < 5) {
      cur.items.push(`${exp.spent_at}: ${exp.description || "Pengeluaran"} (Rp ${Math.round(Number(exp.amount)).toLocaleString("id-ID")})`);
    }
    eventExpenseMap.set(exp.event_id, cur);
  });

  const currentLabel = currentPeriodLabelWithCustom(payDay, customPeriods);
  const labels: Date[] = [];
  for (let i = periodsToAnalyze - 1; i >= 0; i--) {
    labels.push(shiftPeriod(currentLabel, -i));
  }
  const nextLabel = shiftPeriod(currentLabel, 1);
  
  const events = eventsRes.data ?? [];
  const eventDigest = events.length
    ? events
        .map((e) => {
          const expData = eventExpenseMap.get(e.id) ?? { totalSpent: 0, count: 0, items: [] };
          const statusText = e.status === "completed" ? `selesai (berakhir ${e.end_date || e.start_date})` : "sedang aktif";
          const itemLines = expData.items.length > 0 ? `\n    Detail transaksi:\n    ` + expData.items.join("\n    ") : "";
          return `- Event "${e.name}": status ${statusText}, mulai ${e.start_date}, total pengeluaran Rp ${Math.round(expData.totalSpent).toLocaleString("id-ID")} (${expData.count} transaksi)${itemLines}`;
        })
        .join("\n")
    : "(belum ada event/kegiatan)";
  

  const perPeriod = await Promise.all(
    labels.map(async (lbl) => {
      const key = labelMonthKey(lbl);
      const range = getPeriodRange(lbl, payDay, customPeriods);
      const [sumRes, incRes, expRes] = await Promise.all([
        supabase.rpc("f_period_summary", { p_household_id: householdId, p_label_month: key }),
        supabase.from("incomes").select("source, amount").eq("household_id", householdId).eq("month", key),
        supabase
          .from("expenses")
          .select("spent_at, created_at, description, amount, category_id, event_id")
          .eq("household_id", householdId)
          .gte("spent_at", range.from)
          .lte("spent_at", range.to)
          .order("spent_at", { ascending: true })
          .order("created_at", { ascending: true }),
      ]);
      const rows = (sumRes.data ?? []) as MonthlySummaryRow[];
      const income = (incRes.data ?? []).reduce((s, r) => s + Number(r.amount), 0);
      const items = (expRes.data ?? []) as { spent_at: string; created_at: string; description: string; amount: number; category_id: string; event_id: string | null }[];
      return { key, title: periodTitle(lbl), rows, income, items };
    }),
  );

  const latest = perPeriod[perPeriod.length - 1];
  const catList = (latest?.rows ?? []).map((r) => ({ id: r.category_id, name: r.category_name }));
  if (catList.length === 0) return null;

  // Compute Financial Indicators (Savings Rate %, Surplus/Deficit, Overbudget categories, Goal monthly requirements)
  const periodMetrics = perPeriod.map((p) => {
    const totalSpent = p.rows.reduce((sum, r) => sum + Number(r.spent || 0), 0);
    const totalBudget = p.rows.reduce((sum, r) => sum + Number(r.budget || 0), 0);
    const netSavings = p.income - totalSpent;
    const savingsRate = p.income > 0 ? Math.round((netSavings / p.income) * 100) : 0;
    const overbudgets = p.rows
      .filter((r) => Number(r.spent) > Number(r.budget) && Number(r.budget) > 0)
      .map((r) => `${r.category_name} (terpakai ${Math.round((Number(r.spent) / Number(r.budget)) * 100)}%)`);

    return {
      title: p.title,
      income: p.income,
      totalSpent,
      totalBudget,
      netSavings,
      savingsRate,
      overbudgets,
    };
  });

  const avgSavingsRate = Math.round(
    periodMetrics.reduce((acc, m) => acc + m.savingsRate, 0) / (periodMetrics.length || 1),
  );
  const avgIncome = Math.round(
    periodMetrics.reduce((acc, m) => acc + m.income, 0) / (periodMetrics.length || 1),
  );
  const avgSpent = Math.round(
    periodMetrics.reduce((acc, m) => acc + m.totalSpent, 0) / (periodMetrics.length || 1),
  );

  const now = new Date();
  const goalAnalysisLines = goals.map((g) => {
    const saved = savedByGoal.get(g.id) ?? 0;
    const target = Number(g.target_amount || 0);
    const remaining = Math.max(0, target - saved);
    const pct = target > 0 ? Math.round((saved / target) * 100) : 0;

    let targetDateInfo = "";
    if (g.target_date) {
      const tDate = new Date(g.target_date);
      const monthsLeft = Math.max(
        1,
        (tDate.getFullYear() - now.getFullYear()) * 12 + (tDate.getMonth() - now.getMonth()),
      );
      const reqMonthly = Math.ceil(remaining / monthsLeft);
      targetDateInfo = ` | Target: ${g.target_date} (${monthsLeft} bulan lagi -> butuh Rp ${reqMonthly.toLocaleString("id-ID")}/bulan)`;
    }

    return `- ${g.name}: terkumpul Rp ${Math.round(saved).toLocaleString("id-ID")} / Rp ${Math.round(target).toLocaleString("id-ID")} (${pct}%)${targetDateInfo}`;
  });

  const metricsDigest = [
    `=== RANGKUMAN INDIKATOR KEUANGAN KELUARGA (CFP METRICS) ===`,
    `- Rata-rata Pemasukan: Rp ${avgIncome.toLocaleString("id-ID")}/periode`,
    `- Rata-rata Pengeluaran: Rp ${avgSpent.toLocaleString("id-ID")}/periode`,
    `- Rata-rata Rasio Tabungan (Savings Rate): ${avgSavingsRate}% ${avgSavingsRate < 10 ? "(BAHAYA: Di bawah target ideal 15-20%)" : avgSavingsRate < 20 ? "(CUKUP: Masih bisa ditingkatkan)" : "(SEHAT: Di atas 20%)"}`,
    ...periodMetrics.map(
      (m) =>
        `- ${m.title}: Pemasukan Rp ${Math.round(m.income).toLocaleString("id-ID")} | Pengeluaran Rp ${Math.round(m.totalSpent).toLocaleString("id-ID")} | ${m.netSavings >= 0 ? "Surplus" : "DEFISIT"} Rp ${Math.abs(Math.round(m.netSavings)).toLocaleString("id-ID")} (Savings Rate: ${m.savingsRate}%)${m.overbudgets.length > 0 ? ` | Overbudget: ${m.overbudgets.join(", ")}` : ""}`,
    ),
  ].join("\n");

  const digest = [
    metricsDigest,
    "",
    "=== BREAKDOWN PERIODE (BUDGET VS REALISASI PER KATEGORI) ===",
    ...perPeriod.map((p) => {
      const lines = p.rows
        .map(
          (r) =>
            `   - ${r.category_name}: budget Rp ${Math.round(Number(r.budget)).toLocaleString("id-ID")}, terpakai Rp ${Math.round(
              Number(r.spent),
            ).toLocaleString("id-ID")} (${Math.round(Number(r.usage_pct))}%)`,
        )
        .join("\n");
      return `${p.title} — pemasukan Rp ${Math.round(p.income).toLocaleString("id-ID")}:\n${lines}`;
    }),
  ].join("\n\n");

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
      const eventNameMap = new Map(events.map(e => [e.id, e.name]));

      // Group by spent_at date
      const byDate = new Map<string, string[]>();
      p.items.forEach((item) => {
        const catName = catNameMap.get(item.category_id) ?? "Lainnya";
        const eventName = item.event_id ? eventNameMap.get(item.event_id) : null;
        const eventTag = eventName ? ` [Event: ${eventName}]` : "";
        const time = fmtTime(item.created_at);
        const line = `     ${time} — ${item.description || "(no desc)"} [${catName}]${eventTag}: Rp ${Math.round(Number(item.amount)).toLocaleString("id-ID")}`;
        if (!byDate.has(item.spent_at)) byDate.set(item.spent_at, []);
        byDate.get(item.spent_at)!.push(line);
      });

      const dayBlocks = Array.from(byDate.entries())
        .map(([date, lines]) => `   ${fmtDateLabel(date)}:\n${lines.join("\n")}`)
        .join("\n");

      return `${p.title}:\n${dayBlocks}`;
    })
    .join("\n\n");

  const goalDigest = goalAnalysisLines.length
    ? goalAnalysisLines.join("\n")
    : "(belum ada goal)";

  return {
    digest,
    itemDigest,
    goalDigest,
    eventDigest,
    memoryDigest,
    catList,
    periodsAnalyzed: perPeriod.map((p) => p.title),
    nextLabelMonth: labelMonthKey(nextLabel),
    nextPeriodTitle: periodTitle(nextLabel),
  };
}

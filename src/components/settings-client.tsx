"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { formatIDR, formatIDRInput, parseIDRInput } from "@/lib/format";
import {
  currentPeriodLabelWithCustom,
  labelMonthKey,
  periodTitle,
  getPeriodRange,
  periodRangeTextWithCustom,
  shiftPeriod,
} from "@/lib/period";
import { PeriodSelector } from "@/components/period-selector";
import {
  BudgetPlanner,
  type CategoryHistory,
  type PeriodSnapshot,
} from "@/components/budget-planner";
import type {
  Category,
  Budget,
  Income,
  MonthlySummaryRow,
  GoalWithProgress,
  Goal,
  Event,
} from "@/lib/types";
import {
  Plus,
  Trash2,
  LogOut,
  Save,
  CalendarCog,
  Edit3,
  RotateCcw,
  Tent,
  Target,
  AlertCircle,
  X,
  Check,
  Loader2,
  ArrowUpRight,
  Wallet,
  Key,
  Copy,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ApiTokensManager } from "@/components/api-tokens-manager";

const COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e", "#06b6d4",
  "#3b82f6", "#a855f7", "#ec4899", "#14b8a6", "#64748b",
];

type SettingsTab = "budget" | "period" | "system";

function parseLabelMonth(str: string): Date {
  const [y, m, d] = (str || "").split("-").map(Number);
  return new Date(y || new Date().getFullYear(), (m || 1) - 1, d || 1);
}

function shortMonthLabel(d: Date): string {
  return d.toLocaleDateString("id-ID", { month: "short" });
}

function formatDisplayDate(dateStr: string) {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function getEventPeriodKey(
  startDateStr: string,
  payDay: number,
  customPeriods: { label_month: string; start_date: string; end_date: string }[]
): string {
  const [y, m, d] = (startDateStr || "").split("-").map(Number);
  const targetDate = !isNaN(y) && !isNaN(m) && !isNaN(d) ? new Date(y, m - 1, d) : new Date();
  const periodDate = currentPeriodLabelWithCustom(payDay, customPeriods, targetDate);
  return labelMonthKey(periodDate);
}

export function SettingsClient({
  householdId,
  categories: initialCats,
  payDay: initialPayDay,
  initialLabelMonth,
  email,
  customPeriods: initialCustomPeriods,
  initialGoals = [],
  events = [],
}: {
  householdId: string;
  categories: Category[];
  payDay: number;
  initialLabelMonth: string;
  email: string;
  customPeriods: { label_month: string; start_date: string; end_date: string }[];
  initialGoals?: GoalWithProgress[];
  events?: (Event & { totalSpent?: number })[];
}) {
  const router = useRouter();
  const supabase = createClient();

  const [activeTab, setActiveTab] = useState<SettingsTab>("budget");
  const [cats, setCats] = useState(initialCats.filter((c) => !c.is_archived));
  const [payDay, setPayDay] = useState(initialPayDay);
  const [customPeriods, setCustomPeriods] = useState(initialCustomPeriods);
  const [labelMonth, setLabelMonth] = useState<Date>(() => parseLabelMonth(initialLabelMonth));

  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [draftAmounts, setDraftAmounts] = useState<Record<string, number>>({});
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [prevIncomes, setPrevIncomes] = useState<Income[]>([]);
  const [goals, setGoals] = useState<GoalWithProgress[]>(initialGoals);
  const [incomeModalOpen, setIncomeModalOpen] = useState(false);

  const [summary, setSummary] = useState<MonthlySummaryRow[]>([]);
  const [prevSummaries, setPrevSummaries] = useState<{
    p1: MonthlySummaryRow[];
    p2: MonthlySummaryRow[];
    p3: MonthlySummaryRow[];
  }>({ p1: [], p2: [], p3: [] });

  const [loadingPeriod, setLoadingPeriod] = useState(true);
  const [periodError, setPeriodError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const saveTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const labelKey = labelMonthKey(labelMonth);
  const currentPeriodDate = currentPeriodLabelWithCustom(payDay, customPeriods);
  const currentPeriodKey = labelMonthKey(currentPeriodDate);
  const nextPeriodDate = shiftPeriod(currentPeriodDate, 1);

  useEffect(() => {
    const timers = saveTimersRef.current;
    return () => {
      Object.values(timers).forEach(clearTimeout);
    };
  }, []);

  // Reload budgets, incomes, current summary, and 3 previous summaries when period changes
  useEffect(() => {
    if (!householdId) return;
    let cancelled = false;

    Object.values(saveTimersRef.current).forEach(clearTimeout);
    saveTimersRef.current = {};

    const p1 = shiftPeriod(labelMonth, -1);
    const p2 = shiftPeriod(labelMonth, -2);
    const p3 = shiftPeriod(labelMonth, -3);
    const p1Key = labelMonthKey(p1);
    const p2Key = labelMonthKey(p2);
    const p3Key = labelMonthKey(p3);

    setLoadingPeriod(true);
    setPeriodError(null);

    Promise.all([
      supabase.from("budgets").select("*").eq("household_id", householdId).eq("month", labelKey),
      supabase.from("incomes").select("*").eq("household_id", householdId).eq("month", labelKey),
      supabase.from("incomes").select("*").eq("household_id", householdId).eq("month", p1Key),
      supabase.rpc("f_period_summary", { p_household_id: householdId, p_label_month: labelKey }),
      supabase.rpc("f_period_summary", { p_household_id: householdId, p_label_month: p1Key }),
      supabase.rpc("f_period_summary", { p_household_id: householdId, p_label_month: p2Key }),
      supabase.rpc("f_period_summary", { p_household_id: householdId, p_label_month: p3Key }),
    ])
      .then(([bRes, iRes, prevIRes, sRes, s1Res, s2Res, s3Res]) => {
        if (cancelled) return;
        const firstErr = bRes.error || iRes.error || sRes.error;
        if (firstErr) {
          setPeriodError(firstErr.message || "Gagal memuat data periode.");
          setLoadingPeriod(false);
          return;
        }

        const loadedBudgets = (bRes.data ?? []) as Budget[];
        setBudgets(loadedBudgets);
        const nextDrafts: Record<string, number> = {};
        loadedBudgets.forEach((b) => {
          nextDrafts[b.category_id] = Number(b.amount);
        });
        setDraftAmounts(nextDrafts);

        setIncomes((iRes.data ?? []) as Income[]);
        setPrevIncomes((prevIRes.data ?? []) as Income[]);
        setSummary((sRes.data ?? []) as MonthlySummaryRow[]);
        setPrevSummaries({
          p1: (s1Res.data ?? []) as MonthlySummaryRow[],
          p2: (s2Res.data ?? []) as MonthlySummaryRow[],
          p3: (s3Res.data ?? []) as MonthlySummaryRow[],
        });
        setLoadingPeriod(false);
      })
      .catch(() => {
        if (cancelled) return;
        setPeriodError("Koneksi terganggu saat memuat data budget.");
        setLoadingPeriod(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [labelKey, householdId, reloadNonce]);

  const historyByCategory = useMemo<Record<string, CategoryHistory>>(() => {
    const p1Date = shiftPeriod(labelMonth, -1);
    const p2Date = shiftPeriod(labelMonth, -2);
    const p3Date = shiftPeriod(labelMonth, -3);
    const p1Key = labelMonthKey(p1Date);
    const p2Key = labelMonthKey(p2Date);
    const p3Key = labelMonthKey(p3Date);

    const p1Range = periodRangeTextWithCustom(p1Date, payDay, customPeriods);
    const p2Range = periodRangeTextWithCustom(p2Date, payDay, customPeriods);
    const p3Range = periodRangeTextWithCustom(p3Date, payDay, customPeriods);

    const curMap = new Map(summary.map((r) => [r.category_id, r]));
    const p1Map = new Map(prevSummaries.p1.map((r) => [r.category_id, r]));
    const p2Map = new Map(prevSummaries.p2.map((r) => [r.category_id, r]));
    const p3Map = new Map(prevSummaries.p3.map((r) => [r.category_id, r]));

    const p1HasAny = prevSummaries.p1.some((r) => Number(r.spent) > 0);
    const p2HasAny = prevSummaries.p2.some((r) => Number(r.spent) > 0);
    const p3HasAny = prevSummaries.p3.some((r) => Number(r.spent) > 0);
    const activePeriodCount = Math.max(1, (p1HasAny ? 1 : 0) + (p2HasAny ? 1 : 0) + (p3HasAny ? 1 : 0));

    const result: Record<string, CategoryHistory> = {};
    for (const c of cats) {
      const rCur = curMap.get(c.id);
      const r1 = p1Map.get(c.id);
      const r2 = p2Map.get(c.id);
      const r3 = p3Map.get(c.id);

      const snap1: PeriodSnapshot = {
        labelKey: p1Key,
        shortLabel: shortMonthLabel(p1Date),
        rangeText: p1Range,
        monthDate: p1Date,
        budget: Number(r1?.budget ?? 0),
        spent: Number(r1?.spent ?? 0),
      };
      const snap2: PeriodSnapshot = {
        labelKey: p2Key,
        shortLabel: shortMonthLabel(p2Date),
        rangeText: p2Range,
        monthDate: p2Date,
        budget: Number(r2?.budget ?? 0),
        spent: Number(r2?.spent ?? 0),
      };
      const snap3: PeriodSnapshot = {
        labelKey: p3Key,
        shortLabel: shortMonthLabel(p3Date),
        rangeText: p3Range,
        monthDate: p3Date,
        budget: Number(r3?.budget ?? 0),
        spent: Number(r3?.spent ?? 0),
      };

      const total3m = snap1.spent + snap2.spent + snap3.spent;
      result[c.id] = {
        currentSpent: Number(rCur?.spent ?? 0),
        prev1: snap1,
        prev2: snap2,
        prev3: snap3,
        avgSpent3m: Math.round(total3m / activePeriodCount),
        activePeriodCount,
      };
    }
    return result;
  }, [cats, summary, prevSummaries, labelMonth, payDay, customPeriods]);

  function budgetFor(catId: string): Budget | undefined {
    return budgets.find((b) => b.category_id === catId);
  }

  async function persistBudget(cat: Category, amount: number) {
    setActionError(null);
    setSavingKey(`b-${cat.id}`);
    const { data, error } = await supabase
      .from("budgets")
      .upsert(
        {
          household_id: householdId,
          category_id: cat.id,
          month: labelKey,
          amount,
        },
        { onConflict: "category_id,month" },
      )
      .select()
      .single();

    setSavingKey(null);
    if (error) {
      setActionError(`Gagal menyimpan budget ${cat.name}: ${error.message}`);
      return;
    }
    if (data) {
      const saved = data as Budget;
      setBudgets((bs) => {
        const exists = bs.some((b) => b.category_id === saved.category_id);
        return exists
          ? bs.map((b) => (b.category_id === saved.category_id ? saved : b))
          : [...bs, saved];
      });
    }
  }

  function handleDraftChange(catId: string, amount: number) {
    setDraftAmounts((prev) => ({ ...prev, [catId]: amount }));
  }

  function commitBudget(cat: Category, amount: number, immediate = true) {
    const existingTimer = saveTimersRef.current[cat.id];
    if (existingTimer) {
      clearTimeout(existingTimer);
      delete saveTimersRef.current[cat.id];
    }

    if (!immediate) {
      saveTimersRef.current[cat.id] = setTimeout(() => {
        delete saveTimersRef.current[cat.id];
        persistBudget(cat, amount);
      }, 400);
      return;
    }

    const currentSaved = Number(budgetFor(cat.id)?.amount ?? 0);
    if (currentSaved === amount) return;
    persistBudget(cat, amount);
  }

  async function copyBudgetsFromPrevPeriod() {
    const prev = shiftPeriod(labelMonth, -1);
    const prevKey = labelMonthKey(prev);
    const { data: prevBudgets, error } = await supabase
      .from("budgets")
      .select("category_id, amount")
      .eq("household_id", householdId)
      .eq("month", prevKey);

    if (error) {
      setActionError(error.message);
      return;
    }
    if (!prevBudgets || prevBudgets.length === 0) {
      alert(`Tidak ada budget di ${periodTitle(prev)}.`);
      return;
    }
    if (!confirm(`Salin ${prevBudgets.length} budget dari ${periodTitle(prev)} ke ${periodTitle(labelMonth)}?`)) {
      return;
    }

    setSavingKey("copy-budgets");
    const rows = prevBudgets.map((b) => ({
      household_id: householdId,
      category_id: b.category_id,
      month: labelKey,
      amount: b.amount,
    }));

    const { error: upsertErr } = await supabase
      .from("budgets")
      .upsert(rows, { onConflict: "category_id,month" });

    if (upsertErr) {
      setSavingKey(null);
      setActionError(upsertErr.message);
      return;
    }

    const { data: reloaded } = await supabase
      .from("budgets")
      .select("*")
      .eq("household_id", householdId)
      .eq("month", labelKey);

    const loaded = (reloaded ?? []) as Budget[];
    setBudgets(loaded);
    const nextDrafts: Record<string, number> = {};
    loaded.forEach((b) => {
      nextDrafts[b.category_id] = Number(b.amount);
    });
    setDraftAmounts(nextDrafts);
    setSavingKey(null);
  }

  async function copyIncomesFromPrevPeriod() {
    const regularPrev = prevIncomes.filter((i) => !i.goal_id);
    if (regularPrev.length === 0) return;
    const prev = shiftPeriod(labelMonth, -1);
    if (!confirm(`Salin ${regularPrev.length} sumber pemasukan reguler dari ${periodTitle(prev)}?`)) {
      return;
    }
    setSavingKey("copy-incomes");
    const payload = regularPrev.map((i) => ({
      household_id: householdId,
      month: labelKey,
      source: i.source,
      amount: i.amount,
      goal_id: null,
    }));
    const { data, error } = await supabase.from("incomes").insert(payload).select();
    setSavingKey(null);
    if (error) {
      setActionError("Gagal menyalin pemasukan: " + error.message);
      return;
    }
    if (data) {
      setIncomes((is) => [...is, ...(data as Income[])]);
    }
  }

  async function addCategory() {
    const name = prompt("Nama kategori baru:");
    if (!name?.trim()) return;
    const color = COLORS[cats.length % COLORS.length];
    const { data, error } = await supabase
      .from("categories")
      .insert({
        household_id: householdId,
        name: name.trim(),
        color,
        sort_order: cats.length + 1,
      })
      .select()
      .single();
    if (error) return alert(error.message);
    if (data) setCats((cs) => [...cs, data]);
  }

  async function deleteCategory(cat: Category) {
    if (
      !confirm(
        `Hapus kategori "${cat.name}"? Pengeluaran yang sudah dicatat dengan kategori ini juga akan ikut terhapus.`,
      )
    )
      return;
    const { error } = await supabase.from("categories").delete().eq("id", cat.id);
    if (error) return alert(error.message);
    setCats((cs) => cs.filter((c) => c.id !== cat.id));
  }

  async function reloadGoals() {
    if (!householdId) return;
    const [goalsRes, depositsRes, withdrawalsRes] = await Promise.all([
      supabase
        .from("goals")
        .select("*")
        .eq("household_id", householdId)
        .eq("status", "active")
        .order("sort_order"),
      supabase
        .from("expenses")
        .select("goal_id, amount")
        .eq("household_id", householdId)
        .not("goal_id", "is", null),
      supabase
        .from("incomes")
        .select("goal_id, amount")
        .eq("household_id", householdId)
        .not("goal_id", "is", null),
    ]);
    const gList = (goalsRes.data ?? []) as Goal[];
    const savedByGoal = new Map<string, number>();
    (depositsRes.data ?? []).forEach((d) => {
      if (!d.goal_id) return;
      savedByGoal.set(d.goal_id, (savedByGoal.get(d.goal_id) ?? 0) + Number(d.amount));
    });
    (withdrawalsRes.data ?? []).forEach((w) => {
      if (!w.goal_id) return;
      savedByGoal.set(w.goal_id, (savedByGoal.get(w.goal_id) ?? 0) - Number(w.amount));
    });
    setGoals(
      gList.map((g) => ({
        ...g,
        saved: Math.max(0, savedByGoal.get(g.id) ?? 0),
      })),
    );
  }

  async function setIncomeAmount(inc: Income, amount: number) {
    setSavingKey("i-" + inc.id);
    const { data } = await supabase
      .from("incomes")
      .update({ amount })
      .eq("id", inc.id)
      .select()
      .single();
    if (data) setIncomes((is) => is.map((i) => (i.id === data.id ? data : i)));
    if (inc.goal_id) {
      await reloadGoals();
      router.refresh();
    }
    setSavingKey(null);
  }

  async function handleSaveIncome(source: string, amount: number, goalId?: string | null) {
    setSavingKey("add-income");
    const payload: {
      household_id: string;
      month: string;
      source: string;
      amount: number;
      goal_id: string | null;
    } = {
      household_id: householdId,
      month: labelKey,
      source,
      amount,
      goal_id: goalId || null,
    };
    const { data, error } = await supabase
      .from("incomes")
      .insert(payload)
      .select()
      .single();
    setSavingKey(null);
    if (error) {
      alert("Gagal menyimpan income: " + error.message);
      return;
    }
    if (data) {
      setIncomes((is) => [...is, data as Income]);
      setIncomeModalOpen(false);
      if (goalId) {
        await reloadGoals();
        router.refresh();
      }
    }
  }

  async function deleteIncome(inc: Income) {
    const isGoal = Boolean(inc.goal_id);
    const msg = isGoal
      ? `Hapus income "${inc.source}"? Saldo penarikan sebesar ${formatIDR(inc.amount)} akan otomatis dikembalikan ke Tabungan.`
      : `Hapus income "${inc.source}"?`;
    if (!confirm(msg)) return;
    await supabase.from("incomes").delete().eq("id", inc.id);
    setIncomes((is) => is.filter((i) => i.id !== inc.id));
    if (isGoal) {
      await reloadGoals();
      router.refresh();
    }
  }

  async function savePayDay(v: number) {
    if (v < 1 || v > 28) return alert("Pay day harus antara 1-28.");
    setSavingKey("pd");
    const { error } = await supabase
      .from("households")
      .update({ pay_day_of_month: v })
      .eq("id", householdId);
    setSavingKey(null);
    if (error) return alert(error.message);
    setPayDay(v);
    router.refresh();
  }

  async function saveCustomPeriod(start: string, end: string) {
    if (!start || !end) return alert("Tanggal start dan end harus diisi.");
    if (new Date(start) > new Date(end)) {
      return alert("Tanggal mulai tidak boleh melebihi tanggal selesai.");
    }
    setSavingKey("cp");
    const { data, error } = await supabase
      .from("custom_periods")
      .upsert(
        {
          household_id: householdId,
          label_month: labelKey,
          start_date: start,
          end_date: end,
        },
        {
          onConflict: "household_id,label_month",
        },
      )
      .select()
      .single();

    setSavingKey(null);
    if (error) return alert(error.message);

    setCustomPeriods((prev) => {
      const filtered = prev.filter((p) => p.label_month !== labelKey);
      if (data) {
        filtered.push({
          label_month: data.label_month,
          start_date: data.start_date,
          end_date: data.end_date,
        });
      }
      return filtered;
    });

    router.refresh();
  }

  async function resetCustomPeriod() {
    if (!confirm("Kembalikan tanggal gajian periode ini ke default?")) return;
    setSavingKey("cp");
    const { error } = await supabase
      .from("custom_periods")
      .delete()
      .eq("household_id", householdId)
      .eq("label_month", labelKey);

    setSavingKey(null);
    if (error) return alert(error.message);

    setCustomPeriods((prev) => prev.filter((p) => p.label_month !== labelKey));
    router.refresh();
  }

  async function logout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  const liveTotalBudget = cats.reduce((sum, c) => sum + Number(draftAmounts[c.id] ?? 0), 0);
  const totalIncome = incomes.reduce((s, i) => s + Number(i.amount), 0);
  const vsIncome = totalIncome - liveTotalBudget;
  const allocPct = totalIncome > 0 ? Math.round((liveTotalBudget / totalIncome) * 100) : 0;
  const prevRegularIncomes = prevIncomes.filter((i) => !i.goal_id);

  return (
    <div className="space-y-4 pb-20">
      {/* Segmented Tabs (3 Tabs) */}
      <div
        role="tablist"
        aria-label="Menu Pengaturan"
        className="grid grid-cols-3 gap-1.5 bg-white dark:bg-surface-dark border-4 border-slate-950 dark:border-slate-100 p-1.5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)]"
      >
        {(
          [
            { id: "budget", label: "Budget", icon: Wallet },
            { id: "period", label: "Periode", icon: CalendarCog },
            { id: "system", label: "Sistem", icon: Key },
          ] as const
        ).map(({ id, label, icon: Icon }) => {
          const active = activeTab === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setActiveTab(id)}
              className={cn(
                "min-h-[44px] px-2 py-2 flex items-center justify-center gap-1.5 text-xs font-headline font-bold uppercase tracking-wider transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500",
                active
                  ? "bg-slate-950 text-white dark:bg-slate-100 dark:text-slate-950 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,1)]"
                  : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{label}</span>
            </button>
          );
        })}
      </div>

      {actionError && (
        <div
          role="alert"
          className="p-3 bg-rose-100 dark:bg-rose-950/60 border-2 border-rose-600 text-rose-900 dark:text-rose-200 text-xs font-mono font-bold flex items-center justify-between gap-2"
        >
          <span className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            {actionError}
          </span>
          <button
            type="button"
            onClick={() => setActionError(null)}
            aria-label="Tutup pesan error"
            className="p-1 hover:bg-rose-200 dark:hover:bg-rose-900"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* TAB 1: BUDGET & INCOME (Default) */}
      {activeTab === "budget" && (
        <div role="tabpanel" className="space-y-4">
          {/* Period Switcher + Quick Jumps */}
          <div className="bg-white dark:bg-surface-dark border-4 border-slate-950 dark:border-slate-100 rounded-none p-3.5 space-y-2.5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)]">
            <PeriodSelector
              labelMonth={labelMonth}
              payDay={payDay}
              onChange={setLabelMonth}
              customRangeText={periodRangeTextWithCustom(labelMonth, payDay, customPeriods)}
            />
            <div className="flex items-center justify-center gap-3 pt-1 flex-wrap">
              {labelKey !== currentPeriodKey && (
                <button
                  type="button"
                  onClick={() => setLabelMonth(currentPeriodDate)}
                  className="text-[11px] font-mono font-bold uppercase text-brand-700 dark:text-brand-400 hover:underline px-2 py-1"
                >
                  Ke Periode Sekarang
                </button>
              )}
              {labelKey !== labelMonthKey(nextPeriodDate) && (
                <button
                  type="button"
                  onClick={() => setLabelMonth(nextPeriodDate)}
                  className="text-[11px] font-mono font-bold uppercase text-slate-700 dark:text-slate-300 border border-slate-950 dark:border-slate-100 px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-brand-400 hover:text-slate-950 transition-colors"
                >
                  Susun Periode Depan ({shortMonthLabel(nextPeriodDate)})
                </button>
              )}
            </div>
          </div>

          {/* Sticky Live Budget Allocator Bar */}
          <div className="sticky top-[68px] z-20 bg-slate-950 text-slate-50 dark:bg-slate-900 border-4 border-slate-950 dark:border-slate-100 p-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)] space-y-2">
            <div className="grid grid-cols-3 gap-2">
              <div className="min-w-0">
                <p className="text-[10px] font-headline font-bold uppercase tracking-wider text-slate-400">
                  Income
                </p>
                <p className="text-xs sm:text-sm font-mono font-black text-white truncate">
                  {formatIDR(totalIncome)}
                </p>
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-headline font-bold uppercase tracking-wider text-slate-400">
                  Total Budget
                </p>
                <p className="text-xs sm:text-sm font-mono font-black text-brand-400 truncate">
                  {formatIDR(liveTotalBudget)}
                </p>
              </div>
              <div className="min-w-0 text-right">
                <p className="text-[10px] font-headline font-bold uppercase tracking-wider text-slate-400">
                  {vsIncome >= 0 ? "Sisa Alokasi" : "Defisit"}
                </p>
                <p
                  className={cn(
                    "text-xs sm:text-sm font-mono font-black truncate",
                    totalIncome === 0
                      ? "text-slate-300"
                      : vsIncome >= 0
                        ? "text-emerald-400"
                        : "text-rose-400"
                  )}
                >
                  {totalIncome === 0 ? "-" : formatIDR(Math.abs(vsIncome))}
                </p>
              </div>
            </div>

            {totalIncome > 0 && (
              <div className="space-y-1">
                <div className="h-2 w-full bg-slate-800 border border-slate-700 overflow-hidden">
                  <div
                    className={cn(
                      "h-full transition-all duration-200",
                      allocPct > 100 ? "bg-rose-500" : "bg-brand-500"
                    )}
                    style={{ width: `${Math.min(100, allocPct)}%` }}
                  />
                </div>
                <p className="text-[10px] font-mono text-slate-300 flex items-center justify-between">
                  <span>{allocPct}% dari income dialokasikan</span>
                  {savingKey && savingKey.startsWith("b-") && (
                    <span className="text-brand-400">Menyimpan...</span>
                  )}
                </p>
              </div>
            )}
          </div>

          {/* Income / Pemasukan Section */}
          <section className="space-y-2">
            <div className="flex items-center justify-between gap-2 px-0.5">
              <h2 className="text-xs font-headline font-bold uppercase tracking-wider text-slate-950 dark:text-slate-100">
                Income / Pemasukan
              </h2>
              <div className="flex items-center gap-2">
                {incomes.length === 0 && prevRegularIncomes.length > 0 && (
                  <button
                    type="button"
                    onClick={copyIncomesFromPrevPeriod}
                    disabled={savingKey === "copy-incomes"}
                    className="min-h-[34px] px-2.5 py-1 text-[11px] font-mono font-bold uppercase bg-white dark:bg-surface-dark border-2 border-slate-950 dark:border-slate-100 text-slate-950 dark:text-slate-100 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center gap-1 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <Copy className="w-3 h-3" />
                    Salin Lalu
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIncomeModalOpen(true)}
                  className="min-h-[34px] px-2.5 py-1 text-[11px] font-headline font-bold uppercase bg-brand-400 text-slate-950 border-2 border-slate-950 dark:border-slate-100 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center gap-1 hover:bg-brand-300"
                >
                  <Plus className="w-3.5 h-3.5" /> Tambah
                </button>
              </div>
            </div>

            <div className="bg-white dark:bg-surface-dark border-4 border-slate-950 dark:border-slate-100 rounded-none divide-y-2 divide-slate-100 dark:divide-slate-800 p-0 overflow-hidden shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)]">
              {incomes.length === 0 && (
                <p className="p-4 text-xs font-mono uppercase text-slate-500 dark:text-slate-400">
                  Belum ada income di periode ini.
                </p>
              )}
              {incomes.map((inc) => (
                <IncomeRow
                  key={inc.id}
                  income={inc}
                  goal={goals.find((g) => g.id === inc.goal_id)}
                  saving={savingKey === "i-" + inc.id}
                  onChange={(v) => setIncomeAmount(inc, v)}
                  onDelete={() => deleteIncome(inc)}
                />
              ))}
            </div>
          </section>

          {/* Smart Budget Planner */}
          <BudgetPlanner
            householdId={householdId}
            labelKey={labelKey}
            payDay={payDay}
            customPeriods={customPeriods}
            categories={cats}
            draftAmounts={draftAmounts}
            historyByCategory={historyByCategory}
            savingKey={savingKey}
            loading={loadingPeriod}
            error={periodError}
            onRetry={() => setReloadNonce((n) => n + 1)}
            onDraftChange={handleDraftChange}
            onCommitBudget={commitBudget}
            onCopyPrevBudgets={copyBudgetsFromPrevPeriod}
            onAddCategory={addCategory}
            onDeleteCategory={deleteCategory}
          />
        </div>
      )}

      {/* TAB 2: PERIODE & EVENT */}
      {activeTab === "period" && (
        <div role="tabpanel" className="space-y-4">
          {/* Pay day setting */}
          <section>
            <div className="bg-white dark:bg-surface-dark border-4 border-slate-950 dark:border-slate-100 rounded-none p-4 flex items-center gap-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)]">
              <div className="w-10 h-10 rounded-none bg-brand-400 text-slate-950 border-2 border-slate-950 flex items-center justify-center shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] shrink-0">
                <CalendarCog className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <label
                  htmlFor="pay-day-input"
                  className="text-xs font-headline font-bold uppercase tracking-wider text-slate-950 dark:text-slate-100 block"
                >
                  Pay Day (Tanggal Gajian)
                </label>
                <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                  Periode dihitung dari tanggal ini setiap bulan
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <input
                  id="pay-day-input"
                  type="number"
                  min={1}
                  max={28}
                  defaultValue={payDay}
                  onBlur={(e) => {
                    const v = Number(e.target.value);
                    if (v !== payDay) savePayDay(v);
                  }}
                  className="w-16 min-h-[42px] border-2 border-slate-950 dark:border-slate-100 bg-slate-50 dark:bg-slate-950 text-slate-950 dark:text-slate-100 rounded-none px-2 py-1.5 text-center text-base sm:text-xs font-mono font-bold focus:outline-none shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                />
                {savingKey === "pd" && <Save className="w-4 h-4 text-brand-500 animate-pulse" />}
              </div>
            </div>
          </section>

          {/* Period selector & Custom Period Editor */}
          <div className="bg-white dark:bg-surface-dark border-4 border-slate-950 dark:border-slate-100 rounded-none p-4 space-y-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)]">
            <PeriodSelector
              labelMonth={labelMonth}
              payDay={payDay}
              onChange={setLabelMonth}
              customRangeText={periodRangeTextWithCustom(labelMonth, payDay, customPeriods)}
            />
            {labelKey !== currentPeriodKey && (
              <button
                type="button"
                onClick={() => setLabelMonth(currentPeriodDate)}
                className="mt-2 text-xs font-mono font-bold uppercase text-brand-600 dark:text-brand-400 w-full text-center hover:underline"
              >
                Ke periode sekarang
              </button>
            )}
            <CustomPeriodEditor
              labelMonth={labelMonth}
              payDay={payDay}
              customPeriods={customPeriods}
              onSave={saveCustomPeriod}
              onReset={resetCustomPeriod}
              saving={savingKey === "cp"}
            />
          </div>

          {/* Events Management */}
          <section className="space-y-2">
            <Link
              href="/events"
              className="bg-white dark:bg-surface-dark border-4 border-slate-950 dark:border-slate-100 rounded-none p-4 flex items-center justify-between shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)] hover:bg-slate-950 hover:text-white dark:hover:bg-slate-100 dark:hover:text-slate-950 group transition-all"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-none bg-indigo-200 text-indigo-950 border-2 border-slate-950 flex items-center justify-center shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] shrink-0">
                  <Tent className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-headline font-bold uppercase tracking-wider text-slate-950 dark:text-slate-100 group-hover:text-white dark:group-hover:text-slate-950">
                    Kelola Event &amp; Perjalanan
                  </p>
                  <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400 group-hover:text-slate-300 dark:group-hover:text-slate-700">
                    Grup pengeluaran untuk liburan, renovasi, dsb.
                  </p>
                </div>
              </div>
              <p className="font-headline font-black text-xl shrink-0">›</p>
            </Link>

            {events && events.length > 0 && (
              <div className="space-y-2 pt-1">
                <p className="text-[10px] font-headline font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-1">
                  Event Aktif &amp; Terakhir (Klik untuk ke Riwayat Periode)
                </p>
                <div className="grid gap-2">
                  {events.slice(0, 3).map((evt) => {
                    const periodKey = getEventPeriodKey(evt.start_date, payDay, customPeriods);
                    const historyHref = `/history?event=${evt.id}&period=${periodKey}`;
                    return (
                      <Link
                        key={evt.id}
                        href={historyHref}
                        className="bg-white dark:bg-surface-dark border-2 border-slate-950 dark:border-slate-100 rounded-none p-3 flex items-center justify-between gap-3 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,1)] hover:bg-slate-50 dark:hover:bg-slate-900 group transition-all"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-headline font-bold text-xs uppercase tracking-wider text-slate-950 dark:text-slate-100 group-hover:text-brand-600 dark:group-hover:text-brand-400 truncate">
                              {evt.name}
                            </span>
                            <span
                              className={cn(
                                "text-[9px] font-headline font-bold px-1.5 py-0.5 rounded-none border",
                                evt.status === "active"
                                  ? "bg-emerald-400 text-slate-950 border-slate-950 shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]"
                                  : "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-950 dark:border-slate-100"
                              )}
                            >
                              {evt.status === "active" ? "Sedang Berjalan" : "Selesai"}
                            </span>
                          </div>
                          <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400 mt-0.5 uppercase">
                            {formatDisplayDate(evt.start_date)}
                            {evt.end_date ? ` - ${formatDisplayDate(evt.end_date)}` : " - Sekarang"}
                          </p>
                        </div>
                        <div className="text-right shrink-0 flex items-center gap-2">
                          <div>
                            <p className="font-headline font-black text-brand-600 dark:text-brand-400 text-xs">
                              {formatIDR(evt.totalSpent || 0)}
                            </p>
                            <span className="text-[9px] font-headline font-bold uppercase text-slate-400 group-hover:text-brand-600 dark:group-hover:text-brand-400 group-hover:underline flex items-center gap-0.5 justify-end">
                              Riwayat <ArrowUpRight className="w-3 h-3" />
                            </span>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}
          </section>
        </div>
      )}

      {/* TAB 3: SISTEM & AKUN */}
      {activeTab === "system" && (
        <div role="tabpanel" className="space-y-4">
          {/* Integrasi AI & MCP Access Tokens */}
          <section>
            <ApiTokensManager />
          </section>

          {/* Account */}
          <section>
            <div className="bg-white dark:bg-surface-dark border-4 border-slate-950 dark:border-slate-100 rounded-none p-4 flex items-center justify-between gap-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)]">
              <div className="min-w-0">
                <p className="text-xs font-headline font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Masuk Sebagai
                </p>
                <p className="font-mono font-bold truncate text-xs text-slate-950 dark:text-slate-100 mt-0.5">
                  {email}
                </p>
              </div>
              <button
                type="button"
                onClick={logout}
                className="min-h-[44px] text-xs font-headline font-bold uppercase px-3.5 py-2 rounded-none border-2 border-rose-600 bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none flex items-center gap-1.5 transition-all shrink-0"
              >
                <LogOut className="w-4 h-4" /> Keluar
              </button>
            </div>
          </section>
        </div>
      )}

      <AddIncomeModal
        isOpen={incomeModalOpen}
        onClose={() => setIncomeModalOpen(false)}
        onSave={handleSaveIncome}
        goals={goals}
        saving={savingKey === "add-income"}
      />
    </div>
  );
}

function IncomeRow({
  income,
  goal,
  saving,
  onChange,
  onDelete,
}: {
  income: Income;
  goal?: GoalWithProgress | Goal;
  saving: boolean;
  onChange: (v: number) => void;
  onDelete: () => void;
}) {
  const [text, setText] = useState(
    income.amount ? Number(income.amount).toLocaleString("id-ID") : "",
  );
  const isFocused = useRef(false);
  useEffect(() => {
    if (!isFocused.current) {
      setText(income.amount ? Number(income.amount).toLocaleString("id-ID") : "");
    }
  }, [income.amount]);
  return (
    <div className="flex items-center gap-2.5 p-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-headline font-bold uppercase text-slate-950 dark:text-slate-100 truncate">
            {income.source}
          </span>
          {income.goal_id && (
            <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold uppercase px-1.5 py-0.5 bg-amber-200 dark:bg-amber-900/60 text-amber-950 dark:text-amber-200 border border-slate-950 dark:border-slate-100 shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]">
              <Target className="w-3 h-3 text-amber-700 dark:text-amber-400" />
              Tabungan{goal ? `: ${goal.name}` : ""}
            </span>
          )}
        </div>
      </div>
      <div className="relative w-32 sm:w-36 shrink-0">
        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-headline font-black text-slate-950 dark:text-slate-100 pointer-events-none">
          Rp
        </span>
        <input
          type="text"
          inputMode="numeric"
          value={text}
          onChange={(e) => setText(formatIDRInput(e.target.value))}
          onFocus={() => {
            isFocused.current = true;
          }}
          onBlur={() => {
            isFocused.current = false;
            onChange(parseIDRInput(text));
          }}
          className="w-full min-h-[42px] border-2 border-slate-950 dark:border-slate-100 bg-slate-50 dark:bg-slate-950 text-slate-950 dark:text-slate-100 rounded-none pl-8 pr-2 py-1.5 text-base sm:text-xs font-mono font-bold text-right focus:outline-none shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
          placeholder="0"
        />
      </div>
      {saving && <Save className="w-4 h-4 text-brand-500 animate-pulse shrink-0" />}
      <button
        type="button"
        onClick={onDelete}
        className="min-h-[40px] min-w-[40px] flex items-center justify-center text-slate-600 hover:text-rose-600 rounded-none border border-transparent hover:border-rose-600 transition-colors shrink-0"
        title="Hapus income"
        aria-label={`Hapus income ${income.source}`}
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}

function CustomPeriodEditor({
  labelMonth,
  payDay,
  customPeriods,
  onSave,
  onReset,
  saving,
}: {
  labelMonth: Date;
  payDay: number;
  customPeriods: { label_month: string; start_date: string; end_date: string }[];
  onSave: (start: string, end: string) => Promise<void>;
  onReset: () => Promise<void>;
  saving: boolean;
}) {
  const range = getPeriodRange(labelMonth, payDay, customPeriods);
  const [isEditing, setIsEditing] = useState(false);
  const [start, setStart] = useState(range.from);
  const [end, setEnd] = useState(range.to);

  useEffect(() => {
    setStart(range.from);
    setEnd(range.to);
  }, [range.from, range.to]);

  if (!isEditing) {
    return (
      <div className="flex items-center justify-between border-t-2 border-slate-950 dark:border-slate-100 pt-3">
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {range.isCustom ? (
            <span className="inline-flex items-center gap-1 text-amber-900 bg-amber-300 border-2 border-slate-950 px-2 py-0.5 rounded-none font-headline font-bold uppercase text-[10px]">
              Custom Range
            </span>
          ) : (
            <span className="text-slate-500 font-mono text-xs uppercase">Rentang default</span>
          )}
        </span>
        <div className="flex items-center gap-2">
          {range.isCustom && (
            <button
              type="button"
              onClick={onReset}
              className="min-h-[38px] text-xs font-headline font-bold uppercase text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1.5 px-2.5 py-1 rounded-none border border-slate-950 transition"
              disabled={saving}
            >
              <RotateCcw className="w-3 h-3" /> Reset
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="min-h-[38px] text-xs font-headline font-bold uppercase text-slate-950 dark:text-slate-950 bg-brand-400 border-2 border-slate-950 px-2.5 py-1.5 rounded-none shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition flex items-center gap-1.5"
            disabled={saving}
          >
            <Edit3 className="w-3 h-3" /> Ubah Range
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="border-t-2 border-slate-950 dark:border-slate-100 pt-3 space-y-3">
      <p className="text-xs font-headline font-bold uppercase tracking-wider text-slate-950 dark:text-slate-100">
        Custom Rentang Tanggal
      </p>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] font-headline font-bold text-slate-950 dark:text-slate-100 block mb-1 uppercase">
            Mulai
          </label>
          <input
            type="date"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className="w-full min-h-[42px] border-2 border-slate-950 dark:border-slate-100 bg-slate-50 dark:bg-slate-950 text-slate-950 dark:text-slate-100 rounded-none px-2.5 py-2 text-base sm:text-xs font-mono font-bold focus:outline-none shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
          />
        </div>
        <div>
          <label className="text-[10px] font-headline font-bold text-slate-950 dark:text-slate-100 block mb-1 uppercase">
            Selesai
          </label>
          <input
            type="date"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            className="w-full min-h-[42px] border-2 border-slate-950 dark:border-slate-100 bg-slate-50 dark:bg-slate-950 text-slate-950 dark:text-slate-100 rounded-none px-2.5 py-2 text-base sm:text-xs font-mono font-bold focus:outline-none shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
          />
        </div>
      </div>
      <div className="flex gap-2 justify-end pt-1">
        <button
          type="button"
          onClick={() => setIsEditing(false)}
          className="min-h-[40px] text-xs font-headline font-bold uppercase text-slate-950 dark:text-slate-100 px-3 py-1.5 rounded-none border-2 border-slate-950 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          disabled={saving}
        >
          Batal
        </button>
        <button
          type="button"
          onClick={async () => {
            await onSave(start, end);
            setIsEditing(false);
          }}
          className="min-h-[40px] text-xs font-headline font-bold uppercase px-4 py-1.5 rounded-none bg-brand-500 text-slate-950 border-2 border-slate-950 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none flex items-center gap-1.5"
          disabled={saving}
        >
          {saving ? "Menyimpan..." : "Simpan"}
        </button>
      </div>
    </div>
  );
}

function AddIncomeModal({
  isOpen,
  onClose,
  onSave,
  goals,
  saving,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSave: (source: string, amount: number, goalId?: string | null) => Promise<void>;
  goals: GoalWithProgress[];
  saving: boolean;
}) {
  const [tab, setTab] = useState<"regular" | "goal">("regular");
  const [source, setSource] = useState("");
  const [amountText, setAmountText] = useState("");
  const [selectedGoalId, setSelectedGoalId] = useState(goals[0]?.id ?? "");
  const [customGoalSource, setCustomGoalSource] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setTab("regular");
      setSource("");
      setAmountText("");
      const firstWithSaved = goals.find((g) => g.saved > 0) ?? goals[0];
      if (firstWithSaved) {
        setSelectedGoalId(firstWithSaved.id);
        setCustomGoalSource(`Tarik Tabungan: ${firstWithSaved.name}`);
      }
      setError(null);
    }
  }, [isOpen, goals]);

  useEffect(() => {
    if (!isOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const selectedGoal = goals.find((g) => g.id === selectedGoalId);

  const handleGoalChange = (gid: string) => {
    setSelectedGoalId(gid);
    const g = goals.find((item) => item.id === gid);
    if (g) {
      setCustomGoalSource(`Tarik Tabungan: ${g.name}`);
    }
  };

  const handleSetQuickAmount = (val: number) => {
    setAmountText(formatIDRInput(String(val)));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const amount = parseIDRInput(amountText);
    if (amount <= 0) {
      setError("Nominal harus lebih dari 0");
      return;
    }

    if (tab === "regular") {
      if (!source.trim()) {
        setError("Nama sumber pemasukan wajib diisi");
        return;
      }
      await onSave(source.trim(), amount, null);
    } else {
      if (!selectedGoal) {
        setError("Pilih target tabungan terlebih dahulu");
        return;
      }
      const goalSource = customGoalSource.trim() || `Tarik Tabungan: ${selectedGoal.name}`;
      await onSave(goalSource, amount, selectedGoal.id);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-income-title"
        className="bg-white dark:bg-surface-dark border-4 border-slate-950 dark:border-slate-100 w-full max-w-md p-5 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:shadow-[8px_8px_0px_0px_rgba(255,255,255,1)] space-y-4 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between border-b-2 border-slate-950 dark:border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-none bg-brand-500 text-slate-950 border-2 border-slate-950 flex items-center justify-center font-bold">
              <Plus className="w-5 h-5" />
            </div>
            <div>
              <h3
                id="add-income-title"
                className="font-headline font-black text-base uppercase tracking-wider text-slate-950 dark:text-slate-100"
              >
                Tambah Pemasukan
              </h3>
              <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                Catat cashflow masuk ke periode ini
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup modal pemasukan"
            className="min-h-[36px] min-w-[36px] flex items-center justify-center text-slate-600 hover:text-slate-950 dark:text-slate-400 dark:hover:text-slate-100 border border-transparent hover:border-slate-950"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switch */}
        <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-900 border-2 border-slate-950 dark:border-slate-100">
          <button
            type="button"
            onClick={() => {
              setTab("regular");
              setError(null);
            }}
            className={cn(
              "min-h-[40px] py-2 px-3 text-xs font-headline font-bold uppercase tracking-wider transition-all",
              tab === "regular"
                ? "bg-brand-500 text-slate-950 border-2 border-slate-950 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white"
            )}
          >
            Pemasukan Baru
          </button>
          <button
            type="button"
            onClick={() => {
              setTab("goal");
              setError(null);
            }}
            className={cn(
              "min-h-[40px] py-2 px-3 text-xs font-headline font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5",
              tab === "goal"
                ? "bg-amber-400 text-slate-950 border-2 border-slate-950 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white"
            )}
          >
            <Target className="w-3.5 h-3.5" /> Dari Tabungan
          </button>
        </div>

        {error && (
          <div className="p-2.5 bg-rose-100 dark:bg-rose-950/60 border-2 border-rose-600 text-rose-900 dark:text-rose-200 text-xs font-mono font-bold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {tab === "regular" ? (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-headline font-bold uppercase tracking-wider text-slate-950 dark:text-slate-100 block mb-1">
                  Sumber Pemasukan
                </label>
                <input
                  type="text"
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  placeholder="Contoh: Gaji Pokok, Bonus, Freelance, THR"
                  className="w-full min-h-[44px] border-2 border-slate-950 dark:border-slate-100 bg-slate-50 dark:bg-slate-950 text-slate-950 dark:text-slate-100 rounded-none px-3 py-2 text-base sm:text-xs font-mono font-bold focus:outline-none shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                  autoFocus
                />
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {goals.length === 0 ? (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border-2 border-amber-600 text-amber-900 dark:text-amber-200 text-xs font-mono">
                  Belum ada Target/Tabungan aktif. Buat tabungan dulu di menu Goals.
                </div>
              ) : (
                <>
                  <div>
                    <label className="text-xs font-headline font-bold uppercase tracking-wider text-slate-950 dark:text-slate-100 block mb-1">
                      Pilih Tabungan / Goal yang Dicairkan
                    </label>
                    <select
                      value={selectedGoalId}
                      onChange={(e) => handleGoalChange(e.target.value)}
                      className="w-full min-h-[44px] border-2 border-slate-950 dark:border-slate-100 bg-slate-50 dark:bg-slate-950 text-slate-950 dark:text-slate-100 rounded-none px-3 py-2 text-base sm:text-xs font-mono font-bold focus:outline-none shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                    >
                      {goals.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name} (Tersedia: {formatIDR(g.saved)})
                        </option>
                      ))}
                    </select>
                  </div>

                  {selectedGoal && (
                    <div className="p-3 bg-amber-50 dark:bg-slate-900 border-2 border-slate-950 dark:border-slate-100 rounded-none space-y-1.5 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-headline font-bold uppercase text-slate-700 dark:text-slate-300">
                          Saldo Tabungan Tersedia:
                        </span>
                        <span className="font-mono text-sm font-black text-emerald-700 dark:text-emerald-400">
                          {formatIDR(selectedGoal.saved)}
                        </span>
                      </div>
                      <p className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                        Saldo &quot;{selectedGoal.name}&quot; akan otomatis terpotong saat penarikan ini disimpan.
                      </p>
                    </div>
                  )}

                  <div>
                    <label className="text-xs font-headline font-bold uppercase tracking-wider text-slate-950 dark:text-slate-100 block mb-1">
                      Label Catatan Pemasukan
                    </label>
                    <input
                      type="text"
                      value={customGoalSource}
                      onChange={(e) => setCustomGoalSource(e.target.value)}
                      placeholder="Tarik Tabungan: ..."
                      className="w-full min-h-[44px] border-2 border-slate-950 dark:border-slate-100 bg-slate-50 dark:bg-slate-950 text-slate-950 dark:text-slate-100 rounded-none px-3 py-2 text-base sm:text-xs font-mono font-bold focus:outline-none shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                    />
                  </div>
                </>
              )}
            </div>
          )}

          {/* Nominal input */}
          <div className="space-y-2">
            <label className="text-xs font-headline font-bold uppercase tracking-wider text-slate-950 dark:text-slate-100 block">
              Nominal {tab === "goal" ? "Penarikan" : "Pemasukan"}
            </label>
            <div className="flex items-center bg-slate-50 dark:bg-slate-950 border-2 border-slate-950 dark:border-slate-100 rounded-none px-3 py-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              <span className="font-headline text-lg font-black text-slate-950 dark:text-slate-100 mr-2">
                Rp
              </span>
              <input
                type="text"
                inputMode="numeric"
                value={amountText}
                onChange={(e) => setAmountText(formatIDRInput(e.target.value))}
                placeholder="0"
                className="w-full bg-transparent font-headline text-xl font-black text-slate-950 dark:text-slate-100 focus:outline-none placeholder-slate-400"
              />
            </div>

            {/* Quick amount chips */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {[100000, 250000, 500000, 1000000].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => handleSetQuickAmount(val)}
                  className="min-h-[34px] px-2.5 py-1 text-[11px] font-mono font-bold bg-white dark:bg-slate-900 border border-slate-950 dark:border-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]"
                >
                  +{formatIDR(val).replace(",00", "").replace("Rp ", "")}
                </button>
              ))}
              {tab === "goal" && selectedGoal && selectedGoal.saved > 0 && (
                <button
                  type="button"
                  onClick={() => handleSetQuickAmount(selectedGoal.saved)}
                  className="min-h-[34px] px-2.5 py-1 text-[11px] font-mono font-bold bg-amber-300 text-slate-950 border border-slate-950 hover:bg-amber-200 shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]"
                >
                  Tarik Semua Saldo
                </button>
              )}
            </div>
          </div>

          <div className="flex gap-2 justify-end pt-3 border-t-2 border-slate-950 dark:border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[42px] text-xs font-headline font-bold uppercase text-slate-950 dark:text-slate-100 px-4 py-2 rounded-none border-2 border-slate-950 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              disabled={saving}
            >
              Batal
            </button>
            <button
              type="submit"
              className="min-h-[42px] text-xs font-headline font-black uppercase px-5 py-2 rounded-none bg-brand-500 text-slate-950 hover:bg-brand-400 border-2 border-slate-950 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none flex items-center gap-1.5 transition-all"
              disabled={saving || (tab === "goal" && goals.length === 0)}
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Menyimpan...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" /> Simpan Pemasukan
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

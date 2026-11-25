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
  ChevronRight,
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
      {/* Segmented Tabs (Shadcn Style) */}
      <div
        role="tablist"
        aria-label="Menu Pengaturan"
        className="grid grid-cols-3 gap-1 bg-muted border border-border rounded-2xl p-1"
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
                "min-h-[44px] px-2 py-2 rounded-xl flex items-center justify-center gap-1.5 text-xs transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                active
                  ? "bg-card text-foreground font-semibold shadow-sm"
                  : "text-muted-foreground font-medium hover:text-foreground"
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
          className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 rounded-xl text-rose-700 dark:text-rose-300 text-xs font-medium flex items-center justify-between gap-2"
        >
          <span className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {actionError}
          </span>
          <button
            type="button"
            onClick={() => setActionError(null)}
            aria-label="Tutup pesan error"
            className="p-1 rounded-lg hover:bg-rose-100 dark:hover:bg-rose-900"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* TAB 1: BUDGET & INCOME */}
      {activeTab === "budget" && (
        <div role="tabpanel" className="space-y-4">
          <div className="bg-card border border-border rounded-2xl p-3.5 space-y-2.5 shadow-sm">
            <PeriodSelector
              labelMonth={labelMonth}
              payDay={payDay}
              onChange={setLabelMonth}
              customRangeText={periodRangeTextWithCustom(labelMonth, payDay, customPeriods)}
            />
            <div className="flex items-center justify-center gap-2 pt-1 flex-wrap">
              {labelKey !== currentPeriodKey && (
                <button
                  type="button"
                  onClick={() => setLabelMonth(currentPeriodDate)}
                  className="text-xs font-medium text-primary hover:underline px-2.5 py-1 rounded-lg hover:bg-accent"
                >
                  Ke periode sekarang
                </button>
              )}
              {labelKey !== labelMonthKey(nextPeriodDate) && (
                <button
                  type="button"
                  onClick={() => setLabelMonth(nextPeriodDate)}
                  className="text-xs font-medium text-foreground border border-border rounded-xl px-3 py-1 bg-secondary hover:bg-accent hover:text-accent-foreground transition-colors"
                >
                  Susun periode depan ({shortMonthLabel(nextPeriodDate)})
                </button>
              )}
            </div>
          </div>

          {/* Sticky Live Budget Allocator Bar */}
          <div className="sticky top-[68px] z-20 bg-card/95 backdrop-blur-md border border-border rounded-2xl p-3.5 shadow-md space-y-2">
            <div className="grid grid-cols-3 gap-2">
              <div className="min-w-0">
                <p className="text-[11px] font-medium text-muted-foreground">
                  Income
                </p>
                <p className="text-xs sm:text-sm font-mono font-semibold text-foreground truncate tabular-nums">
                  {formatIDR(totalIncome)}
                </p>
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-medium text-muted-foreground">
                  Total Budget
                </p>
                <p className="text-xs sm:text-sm font-mono font-semibold text-primary truncate tabular-nums">
                  {formatIDR(liveTotalBudget)}
                </p>
              </div>
              <div className="min-w-0 text-right">
                <p className="text-[11px] font-medium text-muted-foreground">
                  {vsIncome >= 0 ? "Sisa Alokasi" : "Defisit"}
                </p>
                <p
                  className={cn(
                    "text-xs sm:text-sm font-mono font-semibold truncate tabular-nums",
                    totalIncome === 0
                      ? "text-muted-foreground"
                      : vsIncome >= 0
                        ? "text-teal-700 dark:text-teal-300"
                        : "text-rose-700 dark:text-rose-300"
                  )}
                >
                  {totalIncome === 0 ? "-" : formatIDR(Math.abs(vsIncome))}
                </p>
              </div>
            </div>

            {totalIncome > 0 && (
              <div className="space-y-1">
                <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-200",
                      allocPct > 100 ? "bg-rose-600 dark:bg-rose-400" : "bg-primary"
                    )}
                    style={{ width: `${Math.min(100, allocPct)}%` }}
                  />
                </div>
                <p className="text-[11px] font-mono text-muted-foreground flex items-center justify-between">
                  <span>{allocPct}% dari income dialokasikan</span>
                  {savingKey && savingKey.startsWith("b-") && (
                    <span className="text-primary font-medium">Menyimpan...</span>
                  )}
                </p>
              </div>
            )}
          </div>

          {/* Income / Pemasukan Section */}
          <section className="space-y-2">
            <div className="flex items-center justify-between gap-2 px-0.5">
              <h2 className="text-sm font-semibold text-foreground">
                Income / Pemasukan
              </h2>
              <div className="flex items-center gap-2">
                {incomes.length === 0 && prevRegularIncomes.length > 0 && (
                  <button
                    type="button"
                    onClick={copyIncomesFromPrevPeriod}
                    disabled={savingKey === "copy-incomes"}
                    className="min-h-[34px] px-3 py-1 rounded-xl text-xs font-medium bg-card border border-border text-foreground flex items-center gap-1 hover:bg-muted transition-colors"
                  >
                    <Copy className="w-3 h-3" />
                    Salin Lalu
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIncomeModalOpen(true)}
                  className="min-h-[34px] px-3 py-1 rounded-xl text-xs font-semibold bg-primary text-primary-foreground flex items-center gap-1 hover:bg-primary/90 shadow-sm transition-all"
                >
                  <Plus className="w-3.5 h-3.5" /> Tambah
                </button>
              </div>
            </div>

            <div className="bg-card border border-border rounded-2xl divide-y divide-border p-0 overflow-hidden shadow-sm">
              {incomes.length === 0 && (
                <p className="p-4 text-xs text-muted-foreground">
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
          <section>
            <div className="bg-card border border-border rounded-2xl p-4 flex items-center gap-3 shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-accent text-primary border border-brand-200/70 dark:border-brand-800/40 flex items-center justify-center shrink-0">
                <CalendarCog className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <label
                  htmlFor="pay-day-input"
                  className="text-xs font-semibold text-foreground block"
                >
                  Pay Day (Tanggal Gajian)
                </label>
                <p className="text-xs text-muted-foreground">
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
                  className="w-16 min-h-[42px] border border-input bg-background text-foreground rounded-xl px-2 py-1.5 text-center text-base sm:text-xs font-mono font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                {savingKey === "pd" && <Save className="w-4 h-4 text-primary animate-pulse" />}
              </div>
            </div>
          </section>

          <div className="bg-card border border-border rounded-2xl p-4 space-y-4 shadow-sm">
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
                className="text-xs font-medium text-primary w-full text-center hover:underline py-1"
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

          <section className="space-y-2.5">
            <Link
              href="/events"
              className="bg-card border border-border rounded-2xl p-4 flex items-center justify-between shadow-sm hover:border-primary/40 transition-colors group"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60 flex items-center justify-center shrink-0">
                  <Tent className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">
                    Kelola Event &amp; Perjalanan
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Grup pengeluaran untuk liburan, renovasi, dsb.
                  </p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-foreground shrink-0" />
            </Link>

            {events && events.length > 0 && (
              <div className="space-y-2 pt-1">
                <p className="text-xs font-medium text-muted-foreground px-1">
                  Event aktif &amp; terakhir (klik untuk lihat riwayat)
                </p>
                <div className="grid gap-2">
                  {events.slice(0, 3).map((evt) => {
                    const periodKey = getEventPeriodKey(evt.start_date, payDay, customPeriods);
                    const historyHref = `/history?event=${evt.id}&period=${periodKey}`;
                    return (
                      <Link
                        key={evt.id}
                        href={historyHref}
                        className="bg-card border border-border rounded-xl p-3 flex items-center justify-between gap-3 shadow-sm hover:border-primary/40 group transition-colors"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-xs text-foreground group-hover:text-primary truncate">
                              {evt.name}
                            </span>
                            <span
                              className={cn(
                                "text-[11px] font-medium px-2 py-0.5 rounded-full border",
                                evt.status === "active"
                                  ? "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-800/60"
                                  : "bg-muted text-muted-foreground border-border"
                              )}
                            >
                              {evt.status === "active" ? "Sedang berjalan" : "Selesai"}
                            </span>
                          </div>
                          <p className="text-xs font-mono text-muted-foreground mt-0.5">
                            {formatDisplayDate(evt.start_date)}
                            {evt.end_date ? ` - ${formatDisplayDate(evt.end_date)}` : " - Sekarang"}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-mono font-semibold text-primary text-xs tabular-nums">
                            {formatIDR(evt.totalSpent || 0)}
                          </p>
                          <span className="text-[11px] font-medium text-muted-foreground group-hover:text-primary flex items-center gap-0.5 justify-end">
                            Riwayat <ArrowUpRight className="w-3 h-3" />
                          </span>
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
          <section>
            <ApiTokensManager />
          </section>

          <section>
            <div className="bg-card border border-border rounded-2xl p-4 flex items-center justify-between gap-3 shadow-sm">
              <div className="min-w-0">
                <p className="text-xs font-medium text-muted-foreground">
                  Masuk sebagai
                </p>
                <p className="font-mono font-medium truncate text-xs text-foreground mt-0.5">
                  {email}
                </p>
              </div>
              <button
                type="button"
                onClick={logout}
                className="min-h-[44px] text-xs font-semibold px-3.5 py-2 rounded-xl border border-rose-200 dark:border-rose-800/60 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 hover:bg-rose-600 hover:text-white active:scale-95 flex items-center gap-1.5 transition-all shrink-0"
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
    <div className="flex items-center gap-2.5 p-3.5 hover:bg-muted/40 transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-semibold text-foreground truncate">
            {income.source}
          </span>
          {income.goal_id && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60">
              <Target className="w-3 h-3" />
              Tabungan{goal ? `: ${goal.name}` : ""}
            </span>
          )}
        </div>
      </div>
      <div className="relative w-32 sm:w-36 shrink-0">
        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground pointer-events-none">
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
          className="w-full min-h-[42px] border border-input bg-background text-foreground rounded-xl pl-8 pr-2.5 py-1.5 text-base sm:text-xs font-mono font-semibold text-right tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          placeholder="0"
        />
      </div>
      {saving && <Save className="w-4 h-4 text-primary animate-pulse shrink-0" />}
      <button
        type="button"
        onClick={onDelete}
        className="min-h-[40px] min-w-[40px] rounded-xl flex items-center justify-center text-muted-foreground hover:text-rose-700 dark:hover:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors shrink-0"
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
      <div className="flex items-center justify-between border-t border-border pt-3">
        <span className="text-xs text-muted-foreground">
          {range.isCustom ? (
            <span className="inline-flex items-center gap-1 text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 px-2.5 py-0.5 rounded-full font-medium text-xs">
              Custom Range
            </span>
          ) : (
            <span>Rentang default</span>
          )}
        </span>
        <div className="flex items-center gap-2">
          {range.isCustom && (
            <button
              type="button"
              onClick={onReset}
              className="min-h-[38px] text-xs font-medium text-foreground hover:bg-muted flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border transition-colors"
              disabled={saving}
            >
              <RotateCcw className="w-3 h-3" /> Reset
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="min-h-[38px] text-xs font-semibold text-primary-foreground bg-primary hover:bg-primary/90 px-3 py-1.5 rounded-xl shadow-sm transition-all flex items-center gap-1.5"
            disabled={saving}
          >
            <Edit3 className="w-3 h-3" /> Ubah Range
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="border-t border-border pt-3 space-y-3">
      <p className="text-xs font-semibold text-foreground">
        Custom Rentang Tanggal
      </p>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs font-medium text-muted-foreground block mb-1">
            Mulai
          </label>
          <input
            type="date"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className="w-full min-h-[42px] border border-input bg-background text-foreground rounded-xl px-2.5 py-2 text-base sm:text-xs font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground block mb-1">
            Selesai
          </label>
          <input
            type="date"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            className="w-full min-h-[42px] border border-input bg-background text-foreground rounded-xl px-2.5 py-2 text-base sm:text-xs font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
      </div>
      <div className="flex gap-2 justify-end pt-1">
        <button
          type="button"
          onClick={() => setIsEditing(false)}
          className="min-h-[40px] text-xs font-medium text-foreground px-3.5 py-1.5 rounded-xl border border-border hover:bg-muted transition-colors"
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
          className="min-h-[40px] text-xs font-semibold px-4 py-1.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm flex items-center gap-1.5"
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-income-title"
        className="bg-card border border-border rounded-2xl w-full max-w-md p-5 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-accent text-primary flex items-center justify-center">
              <Plus className="w-5 h-5" />
            </div>
            <div>
              <h3
                id="add-income-title"
                className="font-semibold text-base text-foreground"
              >
                Tambah Pemasukan
              </h3>
              <p className="text-xs text-muted-foreground">
                Catat cashflow masuk ke periode ini
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup modal pemasukan"
            className="min-h-[36px] min-w-[36px] rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-1 p-1 bg-muted rounded-xl border border-border">
          <button
            type="button"
            onClick={() => {
              setTab("regular");
              setError(null);
            }}
            className={cn(
              "min-h-[40px] py-2 px-3 rounded-lg text-xs font-semibold transition-all",
              tab === "regular"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
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
              "min-h-[40px] py-2 px-3 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5",
              tab === "goal"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Target className="w-3.5 h-3.5" /> Dari Tabungan
          </button>
        </div>

        {error && (
          <div className="p-2.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 rounded-xl text-rose-700 dark:text-rose-300 text-xs font-medium flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {tab === "regular" ? (
            <div className="space-y-2">
              <label className="text-xs font-semibold text-foreground block">
                Sumber Pemasukan
              </label>
              <input
                type="text"
                value={source}
                onChange={(e) => setSource(e.target.value)}
                placeholder="Contoh: Gaji Pokok, Bonus, Freelance, THR"
                className="w-full min-h-[44px] border border-input bg-background text-foreground rounded-xl px-3 py-2 text-base sm:text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                autoFocus
              />
            </div>
          ) : (
            <div className="space-y-3">
              {goals.length === 0 ? (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl text-amber-800 dark:text-amber-300 text-xs">
                  Belum ada Target/Tabungan aktif. Buat tabungan dulu di menu Goals.
                </div>
              ) : (
                <>
                  <div>
                    <label className="text-xs font-semibold text-foreground block mb-1.5">
                      Pilih Tabungan / Goal yang Dicairkan
                    </label>
                    <select
                      value={selectedGoalId}
                      onChange={(e) => handleGoalChange(e.target.value)}
                      className="w-full min-h-[44px] border border-input bg-background text-foreground rounded-xl px-3 py-2 text-base sm:text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {goals.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name} (Tersedia: {formatIDR(g.saved)})
                        </option>
                      ))}
                    </select>
                  </div>

                  {selectedGoal && (
                    <div className="p-3 bg-muted/60 border border-border rounded-xl space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-muted-foreground">
                          Saldo tabungan tersedia:
                        </span>
                        <span className="font-mono text-sm font-semibold text-teal-700 dark:text-teal-300">
                          {formatIDR(selectedGoal.saved)}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Saldo &quot;{selectedGoal.name}&quot; akan otomatis terpotong saat penarikan ini disimpan.
                      </p>
                    </div>
                  )}

                  <div>
                    <label className="text-xs font-semibold text-foreground block mb-1.5">
                      Label Catatan Pemasukan
                    </label>
                    <input
                      type="text"
                      value={customGoalSource}
                      onChange={(e) => setCustomGoalSource(e.target.value)}
                      placeholder="Tarik Tabungan: ..."
                      className="w-full min-h-[44px] border border-input bg-background text-foreground rounded-xl px-3 py-2 text-base sm:text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  </div>
                </>
              )}
            </div>
          )}

          <div className="space-y-2">
            <label className="text-xs font-semibold text-foreground block">
              Nominal {tab === "goal" ? "Penarikan" : "Pemasukan"}
            </label>
            <div className="flex items-center bg-background border border-input rounded-xl px-3 py-2 focus-within:ring-2 focus-within:ring-ring">
              <span className="text-lg font-bold text-muted-foreground mr-2">
                Rp
              </span>
              <input
                type="text"
                inputMode="numeric"
                value={amountText}
                onChange={(e) => setAmountText(formatIDRInput(e.target.value))}
                placeholder="0"
                className="w-full bg-transparent font-mono text-xl font-bold text-foreground focus:outline-none placeholder:text-muted-foreground/60 tabular-nums"
              />
            </div>

            <div className="flex flex-wrap gap-1.5 pt-1">
              {[100000, 250000, 500000, 1000000].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => handleSetQuickAmount(val)}
                  className="min-h-[34px] px-2.5 py-1 rounded-lg text-xs font-mono font-medium bg-secondary border border-border text-secondary-foreground hover:bg-muted"
                >
                  +{formatIDR(val).replace(",00", "").replace("Rp ", "")}
                </button>
              ))}
              {tab === "goal" && selectedGoal && selectedGoal.saved > 0 && (
                <button
                  type="button"
                  onClick={() => handleSetQuickAmount(selectedGoal.saved)}
                  className="min-h-[34px] px-2.5 py-1 rounded-lg text-xs font-medium bg-accent text-accent-foreground border border-brand-200 dark:border-brand-800/50 hover:bg-primary hover:text-primary-foreground transition-colors"
                >
                  Tarik semua saldo
                </button>
              )}
            </div>
          </div>

          <div className="flex gap-2 justify-end pt-3 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[42px] text-xs font-medium text-foreground px-4 py-2 rounded-xl border border-border hover:bg-muted transition-colors"
              disabled={saving}
            >
              Batal
            </button>
            <button
              type="submit"
              className="min-h-[42px] text-xs font-semibold px-5 py-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm flex items-center gap-1.5 transition-all"
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

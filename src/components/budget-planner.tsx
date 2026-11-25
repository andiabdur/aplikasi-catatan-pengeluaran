"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { formatIDR, formatIDRInput, parseIDRInput } from "@/lib/format";
import { getPeriodRange } from "@/lib/period";
import { getCategoryIcon } from "@/components/category-icon";
import type { Category } from "@/lib/types";
import {
  Plus,
  Trash2,
  Copy,
  ChevronDown,
  Loader2,
  Check,
  AlertCircle,
  ArrowUpRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type PeriodSnapshot = {
  labelKey: string;
  shortLabel: string;
  rangeText: string;
  monthDate: Date;
  budget: number;
  spent: number;
};

export type CategoryHistory = {
  currentSpent: number;
  prev1: PeriodSnapshot;
  prev2: PeriodSnapshot;
  prev3: PeriodSnapshot;
  avgSpent3m: number;
  activePeriodCount: number;
};

type DrilldownExpense = {
  id: string;
  description: string;
  amount: number;
  spent_at: string;
};

type DrilldownEntry = {
  loading: boolean;
  error: string | null;
  items: DrilldownExpense[];
};

function compactIDR(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) {
    const val = (n / 1_000_000).toFixed(2).replace(/\.?0+$/, "").replace(".", ",");
    return `${val}jt`;
  }
  if (abs >= 1_000) {
    const val = (n / 1_000).toFixed(0);
    return `${val}rb`;
  }
  return `Rp ${n}`;
}

function roundToStep(n: number): number {
  if (n <= 0) return 0;
  if (n >= 50_000) return Math.round(n / 50_000) * 50_000;
  return Math.round(n / 10_000) * 10_000;
}

function formatShortDate(dateStr: string): string {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
  });
}

export function BudgetPlanner({
  householdId,
  labelKey,
  payDay,
  customPeriods,
  categories,
  draftAmounts,
  historyByCategory,
  savingKey,
  loading,
  error,
  onRetry,
  onDraftChange,
  onCommitBudget,
  onCopyPrevBudgets,
  onAddCategory,
  onDeleteCategory,
}: {
  householdId: string;
  labelKey: string;
  payDay: number;
  customPeriods: { label_month: string; start_date: string; end_date: string }[];
  categories: Category[];
  draftAmounts: Record<string, number>;
  historyByCategory: Record<string, CategoryHistory>;
  savingKey: string | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onDraftChange: (catId: string, amount: number) => void;
  onCommitBudget: (cat: Category, amount: number, immediate?: boolean) => void;
  onCopyPrevBudgets: () => void;
  onAddCategory: () => void;
  onDeleteCategory: (cat: Category) => void;
}) {
  const [expandedCatId, setExpandedCatId] = useState<string | null>(null);
  const [drilldownCache, setDrilldownCache] = useState<Record<string, DrilldownEntry>>({});

  async function loadDrilldown(catId: string, snap: PeriodSnapshot, force = false) {
    if (!householdId) return;
    const cacheKey = `${catId}:${snap.labelKey}`;
    const existing = drilldownCache[cacheKey];
    if (!force && existing && (existing.loading || existing.error === null)) {
      return;
    }

    setDrilldownCache((prev) => ({
      ...prev,
      [cacheKey]: { loading: true, error: null, items: existing?.items ?? [] },
    }));

    try {
      const supabase = createClient();
      const range = getPeriodRange(snap.monthDate, payDay, customPeriods);
      const { data, error: fetchErr } = await supabase
        .from("expenses")
        .select("id, description, amount, spent_at")
        .eq("household_id", householdId)
        .eq("category_id", catId)
        .gte("spent_at", range.from)
        .lte("spent_at", range.to)
        .order("spent_at", { ascending: false })
        .limit(40);

      if (fetchErr) {
        setDrilldownCache((prev) => ({
          ...prev,
          [cacheKey]: { loading: false, error: fetchErr.message, items: [] },
        }));
        return;
      }

      setDrilldownCache((prev) => ({
        ...prev,
        [cacheKey]: {
          loading: false,
          error: null,
          items: (data ?? []) as DrilldownExpense[],
        },
      }));
    } catch {
      setDrilldownCache((prev) => ({
        ...prev,
        [cacheKey]: { loading: false, error: "Gagal memuat transaksi periode ini.", items: [] },
      }));
    }
  }

  return (
    <section className="space-y-2.5">
      <div className="flex items-center justify-between gap-2 flex-wrap px-0.5">
        <div className="flex items-center gap-2">
          <h2 className="text-xs font-headline font-bold uppercase tracking-wider text-slate-950 dark:text-slate-100">
            Penyusun Budget
          </h2>
          <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-950 dark:border-slate-100">
            {categories.length}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCopyPrevBudgets}
            className="min-h-[36px] px-2.5 py-1 text-[11px] font-mono font-bold uppercase bg-white dark:bg-surface-dark border-2 border-slate-950 dark:border-slate-100 text-slate-950 dark:text-slate-100 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,1)] hover:bg-slate-950 hover:text-white dark:hover:bg-slate-100 dark:hover:text-slate-950 active:translate-x-[1px] active:translate-y-[1px] active:shadow-none flex items-center gap-1 transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
            title="Salin semua budget dari periode sebelumnya"
          >
            <Copy className="w-3 h-3" />
            Copy Lalu
          </button>
          <button
            type="button"
            onClick={onAddCategory}
            className="min-h-[36px] px-2.5 py-1 text-[11px] font-headline font-bold uppercase bg-brand-400 text-slate-950 border-2 border-slate-950 dark:border-slate-100 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,1)] hover:bg-brand-300 active:translate-x-[1px] active:translate-y-[1px] active:shadow-none flex items-center gap-1 transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          >
            <Plus className="w-3.5 h-3.5" />
            Kategori
          </button>
        </div>
      </div>

      {loading ? (
        <div className="bg-white dark:bg-surface-dark border-4 border-slate-950 dark:border-slate-100 p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)] space-y-3">
          <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase text-slate-600 dark:text-slate-300">
            <Loader2 className="w-4 h-4 animate-spin" />
            Memuat budget dan referensi 3 periode terakhir...
          </div>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="border-2 border-slate-200 dark:border-slate-800 p-3 space-y-2 animate-pulse">
              <div className="flex items-center justify-between gap-3">
                <div className="h-4 w-32 bg-slate-200 dark:bg-slate-800" />
                <div className="h-9 w-36 bg-slate-200 dark:bg-slate-800" />
              </div>
              <div className="h-3 w-48 bg-slate-100 dark:bg-slate-800/70" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="bg-rose-50 dark:bg-rose-950/50 border-4 border-rose-600 p-4 space-y-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <div className="flex items-start gap-2 text-xs font-mono font-bold text-rose-800 dark:text-rose-200">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={onRetry}
            className="min-h-[40px] px-4 py-1.5 text-xs font-headline font-bold uppercase bg-white dark:bg-slate-900 border-2 border-slate-950 dark:border-slate-100 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
          >
            Coba Lagi
          </button>
        </div>
      ) : categories.length === 0 ? (
        <div className="bg-white dark:bg-surface-dark border-4 border-slate-950 dark:border-slate-100 p-6 text-center space-y-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)]">
          <p className="text-xs font-mono uppercase text-slate-600 dark:text-slate-300">
            Belum ada kategori pengeluaran aktif.
          </p>
          <button
            type="button"
            onClick={onAddCategory}
            className="min-h-[44px] px-4 py-2 text-xs font-headline font-black uppercase bg-brand-500 text-slate-950 border-2 border-slate-950 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] inline-flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            Tambah Kategori Pertama
          </button>
        </div>
      ) : (
        <div className="bg-white dark:bg-surface-dark border-4 border-slate-950 dark:border-slate-100 rounded-none divide-y-2 divide-slate-950 dark:divide-slate-100 overflow-hidden shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)]">
          {categories.map((c) => {
            const history = historyByCategory[c.id];
            const isOpen = expandedCatId === c.id;
            return (
              <BudgetCategoryRow
                key={`${c.id}-${labelKey}`}
                category={c}
                draftAmount={draftAmounts[c.id] ?? 0}
                history={history}
                saving={savingKey === `b-${c.id}`}
                isOpen={isOpen}
                onToggleOpen={() => {
                  const nextOpen = !isOpen;
                  setExpandedCatId(nextOpen ? c.id : null);
                  if (nextOpen && history) {
                    loadDrilldown(c.id, history.prev1);
                  }
                }}
                drilldownCache={drilldownCache}
                onLoadDrilldown={(snap, force) => loadDrilldown(c.id, snap, force)}
                onDraftChange={(val) => onDraftChange(c.id, val)}
                onCommitBudget={(val, immediate) => onCommitBudget(c, val, immediate)}
                onDelete={() => onDeleteCategory(c)}
              />
            );
          })}
        </div>
      )}
    </section>
  );
}

function BudgetCategoryRow({
  category,
  draftAmount,
  history,
  saving,
  isOpen,
  onToggleOpen,
  drilldownCache,
  onLoadDrilldown,
  onDraftChange,
  onCommitBudget,
  onDelete,
}: {
  category: Category;
  draftAmount: number;
  history?: CategoryHistory;
  saving: boolean;
  isOpen: boolean;
  onToggleOpen: () => void;
  drilldownCache: Record<string, DrilldownEntry>;
  onLoadDrilldown: (snap: PeriodSnapshot, force?: boolean) => void;
  onDraftChange: (amount: number) => void;
  onCommitBudget: (amount: number, immediate?: boolean) => void;
  onDelete: () => void;
}) {
  const [text, setText] = useState(draftAmount ? Number(draftAmount).toLocaleString("id-ID") : "");
  const [selectedHistIdx, setSelectedHistIdx] = useState<0 | 1 | 2>(2); // 0=prev3, 1=prev2, 2=prev1
  const [sortBy, setSortBy] = useState<"amount" | "date">("amount");
  const isFocused = useRef(false);

  useEffect(() => {
    if (!isFocused.current) {
      setText(draftAmount ? Number(draftAmount).toLocaleString("id-ID") : "");
    }
  }, [draftAmount]);

  const Icon = getCategoryIcon(category.name);
  const prev1 = history?.prev1;
  const prev2 = history?.prev2;
  const prev3 = history?.prev3;
  const avgSpent3m = history?.avgSpent3m ?? 0;
  const activeCount = history?.activePeriodCount ?? 0;
  const currentSpent = history?.currentSpent ?? 0;

  const prev1Diff = prev1 && prev1.budget > 0 ? prev1.spent - prev1.budget : 0;
  const snaps = prev3 && prev2 && prev1 ? [prev3, prev2, prev1] : [];
  const selectedSnap = snaps[selectedHistIdx] ?? prev1;
  const maxSnapSpent = snaps.length > 0 ? Math.max(...snaps.map((s) => s.spent), 1) : 1;

  const cacheKey = selectedSnap ? `${category.id}:${selectedSnap.labelKey}` : "";
  const drilldown = cacheKey ? drilldownCache[cacheKey] : undefined;
  const sortedItems = drilldown?.items
    ? [...drilldown.items].sort((a, b) =>
        sortBy === "amount"
          ? Number(b.amount) - Number(a.amount)
          : b.spent_at.localeCompare(a.spent_at),
      )
    : [];

  function applyAmount(nextVal: number, immediate = false) {
    const safeVal = Math.max(0, Math.round(nextVal));
    setText(safeVal ? safeVal.toLocaleString("id-ID") : "");
    onDraftChange(safeVal);
    onCommitBudget(safeVal, immediate);
  }

  const roundedAvg = roundToStep(avgSpent3m);

  return (
    <div className="transition-colors">
      {/* Baris Utama Kategori */}
      <div className="p-3.5 space-y-2.5">
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-none flex items-center justify-center border-2 border-slate-950 dark:border-slate-100 shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] shrink-0"
            style={{ backgroundColor: category.color ?? "#16a34a" }}
          >
            <Icon className="w-4 h-4 text-white shrink-0" />
          </div>

          <div className="min-w-0 flex-1">
            <label
              htmlFor={`budget-${category.id}`}
              className="text-xs font-headline font-bold uppercase text-slate-950 dark:text-slate-100 break-words leading-snug block cursor-pointer"
            >
              {category.name}
            </label>
          </div>

          <div className="relative w-32 sm:w-36 shrink-0">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-headline font-black text-slate-950 dark:text-slate-100 pointer-events-none">
              Rp
            </span>
            <input
              id={`budget-${category.id}`}
              name={`budget-${category.id}`}
              type="text"
              inputMode="numeric"
              value={text}
              onChange={(e) => {
                const formatted = formatIDRInput(e.target.value);
                setText(formatted);
                onDraftChange(parseIDRInput(formatted));
              }}
              onFocus={() => {
                isFocused.current = true;
              }}
              onBlur={() => {
                isFocused.current = false;
                onCommitBudget(parseIDRInput(text), true);
              }}
              className="w-full min-h-[42px] border-2 border-slate-950 dark:border-slate-100 bg-slate-50 dark:bg-slate-950 text-slate-950 dark:text-slate-100 rounded-none pl-8 pr-2 py-1.5 text-base sm:text-xs font-mono font-bold text-right shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
              placeholder="0"
            />
          </div>

          <button
            type="button"
            onClick={onToggleOpen}
            aria-expanded={isOpen}
            aria-label={`Lihat referensi historis ${category.name}`}
            className={cn(
              "min-h-[42px] min-w-[42px] shrink-0 border-2 border-slate-950 dark:border-slate-100 flex items-center justify-center transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500",
              isOpen
                ? "bg-slate-950 text-white dark:bg-slate-100 dark:text-slate-950"
                : "bg-slate-100 dark:bg-slate-900 text-slate-950 dark:text-slate-100 hover:bg-slate-200 dark:hover:bg-slate-800"
            )}
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <ChevronDown
                className={cn("w-4 h-4 transition-transform duration-200", isOpen && "rotate-180")}
              />
            )}
          </button>
        </div>

        {/* Strip Referensi Singkat (Selalu terlihat tanpa pindah halaman) */}
        {history && (
          <button
            type="button"
            onClick={onToggleOpen}
            className="w-full text-left flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] font-mono text-slate-600 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          >
            <span>
              Lalu ({prev1?.shortLabel}):{" "}
              <strong className="text-slate-950 dark:text-slate-100">
                {formatIDR(prev1?.spent ?? 0)}
              </strong>
            </span>

            {prev1 && prev1.budget > 0 && (
              <span
                className={cn(
                  "px-1.5 py-0.5 text-[10px] font-bold uppercase border border-slate-950 dark:border-slate-100",
                  prev1Diff > 0
                    ? "bg-rose-100 text-rose-900 dark:bg-rose-950/70 dark:text-rose-200"
                    : prev1.budget - prev1.spent >= 50_000
                      ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/70 dark:text-emerald-200"
                      : "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200"
                )}
              >
                {prev1Diff > 0
                  ? `Over +${compactIDR(prev1Diff)}`
                  : prev1.budget - prev1.spent >= 50_000
                    ? `Sisa ${compactIDR(prev1.budget - prev1.spent)}`
                    : "Pas"}
              </span>
            )}

            {avgSpent3m > 0 && (
              <span>
                Rata2 {activeCount}B:{" "}
                <strong className="text-slate-950 dark:text-slate-100">
                  {formatIDR(avgSpent3m)}
                </strong>
              </span>
            )}

            {currentSpent > 0 && (
              <span
                className={cn(
                  draftAmount > 0 && draftAmount < currentSpent
                    ? "text-rose-700 dark:text-rose-300 font-bold"
                    : "text-slate-500 dark:text-slate-400"
                )}
              >
                Jalan: {formatIDR(currentSpent)}
                {draftAmount > 0 && draftAmount < currentSpent ? " (Melebihi draft)" : ""}
              </span>
            )}
          </button>
        )}
      </div>

      {/* Panel Referensi Historis & Penyesuaian Fluktuasi (Expanded) */}
      {isOpen && history && (
        <div className="bg-slate-50 dark:bg-slate-900/70 border-t-2 border-slate-950 dark:border-slate-100 p-3.5 space-y-3.5">
          {/* Quick-Fill & Stepper Fluktuasi */}
          <div className="space-y-2">
            <p className="text-[10px] font-headline font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
              Isi Cepat &amp; Sesuaikan Fluktuasi
            </p>
            <div className="flex flex-wrap gap-1.5">
              {prev1 && prev1.spent > 0 && (
                <button
                  type="button"
                  onClick={() => applyAmount(prev1.spent, true)}
                  className="min-h-[38px] px-2.5 py-1 text-[11px] font-mono font-bold bg-white dark:bg-surface-dark border-2 border-slate-950 dark:border-slate-100 text-slate-950 dark:text-slate-100 hover:bg-brand-400 hover:text-slate-950 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all"
                >
                  Realisasi Lalu ({compactIDR(prev1.spent)})
                </button>
              )}
              {roundedAvg > 0 && (
                <button
                  type="button"
                  onClick={() => applyAmount(roundedAvg, true)}
                  className="min-h-[38px] px-2.5 py-1 text-[11px] font-mono font-bold bg-white dark:bg-surface-dark border-2 border-slate-950 dark:border-slate-100 text-slate-950 dark:text-slate-100 hover:bg-brand-400 hover:text-slate-950 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all"
                >
                  Rata2 {activeCount}B ({compactIDR(roundedAvg)})
                </button>
              )}
              {prev1 && prev1.budget > 0 && (
                <button
                  type="button"
                  onClick={() => applyAmount(prev1.budget, true)}
                  className="min-h-[38px] px-2.5 py-1 text-[11px] font-mono font-bold bg-white dark:bg-surface-dark border-2 border-slate-950 dark:border-slate-100 text-slate-950 dark:text-slate-100 hover:bg-brand-400 hover:text-slate-950 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all"
                >
                  Budget Lalu ({compactIDR(prev1.budget)})
                </button>
              )}
            </div>

            <div className="grid grid-cols-4 gap-1.5">
              {[-100_000, -50_000, 50_000, 100_000].map((delta) => (
                <button
                  key={delta}
                  type="button"
                  onClick={() => applyAmount(draftAmount + delta, false)}
                  disabled={delta < 0 && draftAmount === 0}
                  className={cn(
                    "min-h-[40px] px-2 text-xs font-mono font-bold border-2 border-slate-950 dark:border-slate-100 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all disabled:opacity-40",
                    delta > 0
                      ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-950 dark:text-emerald-200 hover:bg-emerald-200"
                      : "bg-rose-100 dark:bg-rose-950/60 text-rose-950 dark:text-rose-200 hover:bg-rose-200"
                  )}
                >
                  {delta > 0 ? `+${delta / 1000}rb` : `${delta / 1000}rb`}
                </button>
              ))}
            </div>
          </div>

          {/* Perbandingan 3 Periode Terakhir */}
          <div className="space-y-1.5">
            <p className="text-[10px] font-headline font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
              Tren 3 Periode (Ketuk untuk lihat rincian transaksi)
            </p>
            <div className="grid grid-cols-3 gap-2">
              {snaps.map((snap, idx) => {
                const isSelected = selectedHistIdx === idx;
                const barPct = snap.spent > 0 ? Math.max(8, Math.round((snap.spent / maxSnapSpent) * 100)) : 0;
                return (
                  <button
                    key={snap.labelKey}
                    type="button"
                    onClick={() => {
                      setSelectedHistIdx(idx as 0 | 1 | 2);
                      onLoadDrilldown(snap);
                    }}
                    className={cn(
                      "p-2 text-left border-2 border-slate-950 dark:border-slate-100 transition-all space-y-1 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-500",
                      isSelected
                        ? "bg-slate-950 text-white dark:bg-slate-100 dark:text-slate-950 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,1)]"
                        : "bg-white dark:bg-surface-dark text-slate-950 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800"
                    )}
                  >
                    <div className="flex items-center justify-between text-[10px] font-headline font-bold uppercase">
                      <span>{snap.shortLabel}</span>
                      {snap.budget > 0 && snap.spent > snap.budget && (
                        <span className={isSelected ? "text-rose-300 dark:text-rose-700" : "text-rose-600 dark:text-rose-400"}>
                          Over
                        </span>
                      )}
                    </div>
                    <p className="text-xs font-mono font-black truncate">
                      {compactIDR(snap.spent)}
                    </p>
                    <p
                      className={cn(
                        "text-[10px] font-mono truncate",
                        isSelected ? "text-slate-300 dark:text-slate-600" : "text-slate-500 dark:text-slate-400"
                      )}
                    >
                      B: {snap.budget > 0 ? compactIDR(snap.budget) : "-"}
                    </p>
                    <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                      <div
                        className={cn(
                          "h-full",
                          isSelected ? "bg-brand-400 dark:bg-brand-600" : "bg-slate-950 dark:bg-slate-100"
                        )}
                        style={{ width: `${barPct}%` }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Rincian Transaksi Periode Terpilih (Inline Drilldown) */}
          {selectedSnap && (
            <div className="bg-white dark:bg-surface-dark border-2 border-slate-950 dark:border-slate-100 p-2.5 space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap border-b border-slate-200 dark:border-slate-800 pb-2">
                <div className="min-w-0">
                  <p className="text-[11px] font-headline font-bold uppercase text-slate-950 dark:text-slate-100">
                    Rincian {selectedSnap.shortLabel} ({drilldown?.items.length ?? 0})
                  </p>
                  <p className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                    {selectedSnap.rangeText}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setSortBy((s) => (s === "amount" ? "date" : "amount"))}
                    className="px-2 py-1 text-[10px] font-mono font-bold uppercase border border-slate-950 dark:border-slate-100 bg-slate-100 dark:bg-slate-800 text-slate-950 dark:text-slate-100"
                  >
                    Urut: {sortBy === "amount" ? "Terbesar" : "Terbaru"}
                  </button>
                  <Link
                    href={`/history?category=${category.id}&period=${selectedSnap.labelKey}`}
                    className="px-2 py-1 text-[10px] font-headline font-bold uppercase border border-slate-950 dark:border-slate-100 bg-brand-400 text-slate-950 flex items-center gap-0.5 hover:bg-brand-300"
                  >
                    Riwayat
                    <ArrowUpRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>

              {drilldown?.loading ? (
                <div className="py-4 flex items-center justify-center gap-2 text-xs font-mono text-slate-500">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Memuat rincian transaksi...
                </div>
              ) : drilldown?.error ? (
                <div className="py-2 flex items-center justify-between gap-2 text-xs font-mono text-rose-700 dark:text-rose-300">
                  <span>{drilldown.error}</span>
                  <button
                    type="button"
                    onClick={() => onLoadDrilldown(selectedSnap, true)}
                    className="underline font-bold uppercase"
                  >
                    Ulangi
                  </button>
                </div>
              ) : sortedItems.length === 0 ? (
                <p className="py-3 text-center text-[11px] font-mono text-slate-500 dark:text-slate-400">
                  Tidak ada pengeluaran di periode {selectedSnap.shortLabel}.
                </p>
              ) : (
                <div className="max-h-48 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 pr-1">
                  {sortedItems.map((item) => (
                    <div
                      key={item.id}
                      className="py-1.5 flex items-start justify-between gap-2 text-xs"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-headline font-bold text-slate-900 dark:text-slate-100 break-words leading-snug">
                          {item.description}
                        </p>
                        <p className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                          {formatShortDate(item.spent_at)}
                        </p>
                      </div>
                      <span className="font-mono font-bold text-slate-950 dark:text-slate-100 shrink-0">
                        {formatIDR(Number(item.amount))}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Hapus Kategori (Dipindah ke dalam panel agar tidak salah pencet) */}
          <div className="flex justify-end pt-1">
            <button
              type="button"
              onClick={onDelete}
              className="min-h-[38px] px-3 py-1 text-[11px] font-mono font-bold uppercase text-rose-700 dark:text-rose-300 border-2 border-rose-600 bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-600 hover:text-white transition-colors inline-flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Hapus Kategori
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

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
          <h2 className="text-sm font-semibold text-foreground">
            Penyusun Budget
          </h2>
          <span className="text-xs font-mono font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">
            {categories.length}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCopyPrevBudgets}
            className="min-h-[36px] px-3 py-1.5 rounded-xl text-xs font-medium bg-card border border-border text-foreground hover:bg-muted active:scale-95 flex items-center gap-1.5 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            title="Salin semua budget dari periode sebelumnya"
          >
            <Copy className="w-3.5 h-3.5" />
            Copy Lalu
          </button>
          <button
            type="button"
            onClick={onAddCategory}
            className="min-h-[36px] px-3 py-1.5 rounded-xl text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 active:scale-95 flex items-center gap-1 shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Plus className="w-3.5 h-3.5" />
            Kategori
          </button>
        </div>
      </div>

      {loading ? (
        <div className="bg-card border border-border rounded-2xl p-4 shadow-sm space-y-3">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
            Memuat budget dan referensi 3 periode terakhir...
          </div>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="border border-border rounded-xl p-3 space-y-2 animate-pulse">
              <div className="flex items-center justify-between gap-3">
                <div className="h-4 w-32 bg-muted rounded-md" />
                <div className="h-9 w-36 bg-muted rounded-xl" />
              </div>
              <div className="h-3 w-48 bg-muted/60 rounded-md" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 rounded-2xl p-4 space-y-3">
          <div className="flex items-start gap-2 text-xs font-medium text-rose-700 dark:text-rose-300">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={onRetry}
            className="min-h-[40px] px-4 py-1.5 rounded-xl text-xs font-semibold bg-card border border-border text-foreground hover:bg-muted"
          >
            Coba Lagi
          </button>
        </div>
      ) : categories.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-6 text-center space-y-3 shadow-sm">
          <p className="text-xs text-muted-foreground">
            Belum ada kategori pengeluaran aktif.
          </p>
          <button
            type="button"
            onClick={onAddCategory}
            className="min-h-[44px] px-4 py-2 rounded-xl text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-1.5 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Tambah Kategori Pertama
          </button>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-2xl divide-y divide-border overflow-hidden shadow-sm">
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
  const [selectedHistIdx, setSelectedHistIdx] = useState<0 | 1 | 2>(2);
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
      <div className="p-3.5 space-y-2.5">
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: category.color ?? "#B85138" }}
          >
            <Icon className="w-4 h-4 text-white shrink-0" />
          </div>

          <div className="min-w-0 flex-1">
            <label
              htmlFor={`budget-${category.id}`}
              className="text-xs font-semibold text-foreground break-words leading-snug block cursor-pointer"
            >
              {category.name}
            </label>
          </div>

          <div className="relative w-32 sm:w-36 shrink-0">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground pointer-events-none">
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
              className="w-full min-h-[42px] border border-input bg-background text-foreground rounded-xl pl-8 pr-2.5 py-1.5 text-base sm:text-xs font-mono font-semibold text-right tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="0"
            />
          </div>

          <button
            type="button"
            onClick={onToggleOpen}
            aria-expanded={isOpen}
            aria-label={`Lihat referensi historis ${category.name}`}
            className={cn(
              "min-h-[42px] min-w-[42px] rounded-xl shrink-0 border flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              isOpen
                ? "bg-accent text-accent-foreground border-primary/50"
                : "bg-secondary text-secondary-foreground border-border hover:bg-muted"
            )}
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
            ) : (
              <ChevronDown
                className={cn("w-4 h-4 transition-transform duration-200", isOpen && "rotate-180")}
              />
            )}
          </button>
        </div>

        {history && (
          <button
            type="button"
            onClick={onToggleOpen}
            className="w-full text-left flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs font-mono text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg"
          >
            <span>
              Lalu ({prev1?.shortLabel}):{" "}
              <strong className="text-foreground">
                {formatIDR(prev1?.spent ?? 0)}
              </strong>
            </span>

            {prev1 && prev1.budget > 0 && (
              <span
                className={cn(
                  "px-2 py-0.5 rounded-full text-[11px] font-medium border",
                  prev1Diff > 0
                    ? "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/60"
                    : prev1.budget - prev1.spent >= 50_000
                      ? "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-800/60"
                      : "bg-muted text-muted-foreground border-border"
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
                <strong className="text-foreground">
                  {formatIDR(avgSpent3m)}
                </strong>
              </span>
            )}

            {currentSpent > 0 && (
              <span
                className={cn(
                  draftAmount > 0 && draftAmount < currentSpent
                    ? "text-rose-700 dark:text-rose-300 font-semibold"
                    : "text-muted-foreground"
                )}
              >
                Jalan: {formatIDR(currentSpent)}
                {draftAmount > 0 && draftAmount < currentSpent ? " (Melebihi draft)" : ""}
              </span>
            )}
          </button>
        )}
      </div>

      {isOpen && history && (
        <div className="bg-muted/40 border-t border-border p-3.5 space-y-3.5">
          {/* Quick-Fill & Stepper Fluktuasi */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">
              Isi cepat &amp; sesuaikan fluktuasi
            </p>
            <div className="flex flex-wrap gap-1.5">
              {prev1 && prev1.spent > 0 && (
                <button
                  type="button"
                  onClick={() => applyAmount(prev1.spent, true)}
                  className="min-h-[38px] px-3 py-1 rounded-xl text-xs font-mono font-medium bg-card border border-border text-foreground hover:bg-accent hover:text-accent-foreground hover:border-primary/40 active:scale-95 transition-all"
                >
                  Realisasi Lalu ({compactIDR(prev1.spent)})
                </button>
              )}
              {roundedAvg > 0 && (
                <button
                  type="button"
                  onClick={() => applyAmount(roundedAvg, true)}
                  className="min-h-[38px] px-3 py-1 rounded-xl text-xs font-mono font-medium bg-card border border-border text-foreground hover:bg-accent hover:text-accent-foreground hover:border-primary/40 active:scale-95 transition-all"
                >
                  Rata2 {activeCount}B ({compactIDR(roundedAvg)})
                </button>
              )}
              {prev1 && prev1.budget > 0 && (
                <button
                  type="button"
                  onClick={() => applyAmount(prev1.budget, true)}
                  className="min-h-[38px] px-3 py-1 rounded-xl text-xs font-mono font-medium bg-card border border-border text-foreground hover:bg-accent hover:text-accent-foreground hover:border-primary/40 active:scale-95 transition-all"
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
                    "min-h-[40px] px-2 rounded-xl text-xs font-mono font-semibold border active:scale-95 transition-all disabled:opacity-40",
                    delta > 0
                      ? "bg-teal-50 dark:bg-teal-950/40 text-teal-800 dark:text-teal-200 border-teal-200 dark:border-teal-800/60 hover:bg-teal-100 dark:hover:bg-teal-950/70"
                      : "bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200 border-rose-200 dark:border-rose-800/60 hover:bg-rose-100 dark:hover:bg-rose-950/70"
                  )}
                >
                  {delta > 0 ? `+${delta / 1000}rb` : `${delta / 1000}rb`}
                </button>
              ))}
            </div>
          </div>

          {/* Perbandingan 3 Periode Terakhir */}
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">
              Tren 3 periode (ketuk untuk rincian transaksi)
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
                      "p-2.5 text-left rounded-xl border transition-all space-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      isSelected
                        ? "bg-accent text-accent-foreground border-primary ring-1 ring-primary"
                        : "bg-card text-foreground border-border hover:bg-muted/60"
                    )}
                  >
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span>{snap.shortLabel}</span>
                      {snap.budget > 0 && snap.spent > snap.budget && (
                        <span className="text-[10px] font-medium text-rose-700 dark:text-rose-300">
                          Over
                        </span>
                      )}
                    </div>
                    <p className="text-xs font-mono font-bold truncate tabular-nums">
                      {compactIDR(snap.spent)}
                    </p>
                    <p className="text-[11px] font-mono text-muted-foreground truncate">
                      B: {snap.budget > 0 ? compactIDR(snap.budget) : "-"}
                    </p>
                    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full",
                          isSelected ? "bg-primary" : "bg-muted-foreground/50"
                        )}
                        style={{ width: `${barPct}%` }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Rincian Transaksi Periode Terpilih */}
          {selectedSnap && (
            <div className="bg-card border border-border rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap border-b border-border pb-2">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-foreground">
                    Rincian {selectedSnap.shortLabel} ({drilldown?.items.length ?? 0})
                  </p>
                  <p className="text-[11px] font-mono text-muted-foreground">
                    {selectedSnap.rangeText}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setSortBy((s) => (s === "amount" ? "date" : "amount"))}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-medium border border-border bg-secondary text-secondary-foreground hover:bg-muted"
                  >
                    Urut: {sortBy === "amount" ? "Terbesar" : "Terbaru"}
                  </button>
                  <Link
                    href={`/history?category=${category.id}&period=${selectedSnap.labelKey}`}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-accent text-accent-foreground border border-brand-200 dark:border-brand-800/50 flex items-center gap-0.5 hover:bg-primary hover:text-primary-foreground transition-colors"
                  >
                    Riwayat
                    <ArrowUpRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>

              {drilldown?.loading ? (
                <div className="py-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  Memuat rincian transaksi...
                </div>
              ) : drilldown?.error ? (
                <div className="py-2 flex items-center justify-between gap-2 text-xs text-rose-700 dark:text-rose-300">
                  <span>{drilldown.error}</span>
                  <button
                    type="button"
                    onClick={() => onLoadDrilldown(selectedSnap, true)}
                    className="underline font-semibold"
                  >
                    Ulangi
                  </button>
                </div>
              ) : sortedItems.length === 0 ? (
                <p className="py-3 text-center text-xs text-muted-foreground">
                  Tidak ada pengeluaran di periode {selectedSnap.shortLabel}.
                </p>
              ) : (
                <div className="max-h-48 overflow-y-auto divide-y divide-border pr-1">
                  {sortedItems.map((item) => (
                    <div
                      key={item.id}
                      className="py-2 flex items-start justify-between gap-2 text-xs"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-foreground break-words leading-snug">
                          {item.description}
                        </p>
                        <p className="text-[11px] font-mono text-muted-foreground">
                          {formatShortDate(item.spent_at)}
                        </p>
                      </div>
                      <span className="font-mono font-semibold text-foreground shrink-0 tabular-nums">
                        {formatIDR(Number(item.amount))}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Hapus Kategori */}
          <div className="flex justify-end pt-1">
            <button
              type="button"
              onClick={onDelete}
              className="min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-medium text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-600 hover:text-white transition-colors inline-flex items-center gap-1.5"
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

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, TrendingUp, TrendingDown, Wallet, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatIDR } from "@/lib/format";
import {
  currentPeriodLabelWithCustom,
  labelMonthKey,
  isoDate,
  getPeriodRange,
  periodRangeTextWithCustom,
} from "@/lib/period";
import { getCategoryIcon } from "@/components/category-icon";
import { PeriodSelector } from "@/components/period-selector";
import { cn } from "@/lib/utils";
import type { MonthlySummaryRow, Income, Expense } from "@/lib/types";

type Recent = Expense & {
  categories: { name: string; color: string | null } | null;
};

export function DashboardClient({
  householdId,
  payDay,
  initialLabelMonth,
  customPeriods: initialCustomPeriods,
}: {
  householdId: string;
  payDay: number;
  initialLabelMonth: string;
  customPeriods: { label_month: string; start_date: string; end_date: string }[];
}) {
  const [customPeriods, setCustomPeriods] = useState(initialCustomPeriods);
  const [labelMonth, setLabelMonth] = useState<Date>(new Date(initialLabelMonth));
  const [summary, setSummary] = useState<MonthlySummaryRow[]>([]);
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [recent, setRecent] = useState<Recent[]>([]);
  const [loading, setLoading] = useState(true);


  useEffect(() => {
    if (!householdId) return;
    const supabase = createClient();
    const labelKey = labelMonthKey(labelMonth);
    const range = getPeriodRange(labelMonth, payDay, customPeriods);
    const ps = range.from;
    const pe = range.to;

    setLoading(true);
    Promise.all([
      supabase.rpc("f_period_summary", {
        p_household_id: householdId,
        p_label_month: labelKey,
      }),
      supabase
        .from("incomes")
        .select("*")
        .eq("household_id", householdId)
        .eq("month", labelKey),
      supabase
        .from("expenses")
        .select("id,description,amount,spent_at,category_id,categories(name,color)")
        .eq("household_id", householdId)
        .gte("spent_at", ps)
        .lte("spent_at", pe)
        .order("spent_at", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(5),
    ]).then(([sumRes, incRes, recRes]) => {
      setSummary((sumRes.data ?? []) as MonthlySummaryRow[]);
      setIncomes((incRes.data ?? []) as Income[]);
      setRecent((recRes.data ?? []) as unknown as Recent[]);
      setLoading(false);
    });
  }, [householdId, payDay, labelMonth, customPeriods]);

  const totalSpent = summary.reduce((s, r) => s + Number(r.spent), 0);
  const totalBudget = summary.reduce((s, r) => s + Number(r.budget), 0);
  const totalIncome = incomes.reduce((s, r) => s + Number(r.amount), 0);
  const sisa = totalIncome - totalSpent;
  const isCurrent = labelMonthKey(labelMonth) === labelMonthKey(currentPeriodLabelWithCustom(payDay, customPeriods));

  return (
    <>
      <div className="neo-card p-4">
        <PeriodSelector
          labelMonth={labelMonth}
          payDay={payDay}
          onChange={setLabelMonth}
          customRangeText={periodRangeTextWithCustom(labelMonth, payDay, customPeriods)}
        />
        {!isCurrent && (
          <button
            onClick={() => setLabelMonth(currentPeriodLabelWithCustom(payDay, customPeriods))}
            className="mt-2 text-xs font-semibold text-brand-600 dark:text-brand-400 w-full text-center hover:underline"
          >
            Ke periode sekarang
          </button>
        )}
      </div>

      {/* Hero summary (Stitch Style) */}
      <div className="neo-card-lg bg-slate-950 text-slate-50 dark:bg-slate-900 border-2 border-slate-800 p-5 rounded-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-brand-500/5 rounded-bl-full pointer-events-none" />
        <div className="flex flex-col gap-1">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Wallet className="w-3.5 h-3.5 text-brand-400" /> Sisa uang periode ini
          </span>
          <h3 className="text-3xl font-bold tracking-tight text-brand-400 mt-1">{formatIDR(sisa)}</h3>
        </div>

        {/* Progress Section */}
        {totalBudget > 0 && (
          <div className="mt-4 space-y-1.5">
            <div className="flex justify-between items-end text-xs">
              <span className="font-semibold text-slate-300">Total Budget</span>
              <span className="font-mono text-slate-400">{formatIDR(totalBudget)}</span>
            </div>
            <div className="h-3 w-full bg-slate-800 border border-slate-700/60 rounded-full overflow-hidden flex">
              <div
                className="h-full bg-brand-500 rounded-full transition-all"
                style={{ width: `${Math.min(100, (totalSpent / totalBudget) * 100)}%` }}
              />
            </div>
            <div className="flex justify-end">
              <span className="font-mono text-[11px] font-semibold text-brand-400">
                {((totalSpent / totalBudget) * 100).toFixed(1)}% Terpakai
              </span>
            </div>
          </div>
        )}

        {/* Income/Spent Mini Stats */}
        <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-slate-800 border-dashed">
          <div className="bg-slate-900/80 dark:bg-slate-950/80 border border-slate-800 rounded-xl p-3">
            <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
              <TrendingUp className="w-3 h-3 text-emerald-400" /> Pemasukan
            </span>
            <span className="font-mono text-sm font-bold text-slate-100 mt-1 block">{formatIDR(totalIncome)}</span>
          </div>
          <div className="bg-slate-900/80 dark:bg-slate-950/80 border border-slate-800 rounded-xl p-3">
            <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
              <TrendingDown className="w-3 h-3 text-rose-400" /> Pengeluaran
            </span>
            <span className="font-mono text-sm font-bold text-slate-100 mt-1 block">{formatIDR(totalSpent)}</span>
          </div>
        </div>
      </div>

      {/* AI CFO Banner */}
      <Link
        href="/asisten"
        className="neo-card p-4 flex items-center gap-3.5 hover:border-brand-500/50 active:scale-[0.99] transition-all"
      >
        <div className="w-11 h-11 rounded-xl bg-slate-900 text-white dark:bg-slate-950 border border-slate-800 flex items-center justify-center shrink-0 shadow-sm">
          <Sparkles className="w-5 h-5 text-brand-400" />
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 tracking-tight">Audit CFO AI</h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Diagnosa kesehatan cashflow & usulan budget periode depan
          </p>
        </div>
        <ArrowUpRight className="w-4 h-4 text-slate-400 shrink-0" />
      </Link>

      {/* Categories Breakdown */}
      <section className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-slate-900 dark:text-slate-100 text-sm uppercase tracking-wider">
            Alokasi Budget
          </h2>
          <Link href="/settings" className="text-xs font-bold text-brand-600 dark:text-brand-400 uppercase tracking-wider hover:underline">
            Atur Budget
          </Link>
        </div>
        <div className="neo-card divide-y divide-slate-100 dark:divide-slate-800/80 p-0 overflow-hidden">
          {loading && (
            <p className="p-5 text-sm text-slate-500 dark:text-slate-400 text-center font-medium">Memuat...</p>
          )}
          {!loading && summary.length === 0 && (
            <p className="p-5 text-sm text-slate-500 dark:text-slate-400">Belum ada kategori.</p>
          )}
          {summary.map((row) => {
            const pct = Math.min(100, Number(row.usage_pct));
            const overBudget = Number(row.spent) > Number(row.budget) && Number(row.budget) > 0;
            const href = `/history?cat=${row.category_id}&period=${labelMonthKey(labelMonth)}`;
            return (
              <Link
                key={row.category_id}
                href={href}
                prefetch={false}
                className="block p-4 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 active:bg-slate-100 dark:active:bg-slate-800/70 transition-colors"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center border border-slate-200 dark:border-slate-800 shadow-sm"
                      style={{ backgroundColor: `${row.color ?? "#16a34a"}15` }}
                    >
                      {(() => {
                        const Icon = getCategoryIcon(row.category_name);
                        return (
                          <Icon
                            className="w-4 h-4 shrink-0"
                            style={{ color: row.color ?? "#16a34a" }}
                          />
                        );
                      })()}
                    </div>
                    <span className="font-semibold text-sm text-slate-900 dark:text-slate-100">{row.category_name}</span>
                  </div>
                  <span className={cn("font-mono text-xs font-bold", overBudget ? "text-rose-500" : pct > 80 ? "text-amber-500" : "text-brand-600 dark:text-brand-400")}>
                    {Number(row.usage_pct).toFixed(0)}%
                  </span>
                </div>
                <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      overBudget ? "bg-rose-500" : pct > 80 ? "bg-amber-500" : "bg-brand-500",
                    )}
                    style={{
                      width: `${pct}%`,
                      background:
                        !overBudget && pct <= 80 ? (row.color ?? undefined) : undefined,
                    }}
                  />
                </div>
                <div className="flex justify-between items-center mt-1.5 text-xs font-mono text-slate-500 dark:text-slate-400">
                  <span className={cn(overBudget && "text-rose-600 dark:text-rose-400 font-bold")}>
                    {formatIDR(row.spent)} terpakai
                  </span>
                  <span>dari {formatIDR(row.budget)}</span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Recent expenses */}
      <section className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-slate-900 dark:text-slate-100 text-sm uppercase tracking-wider">
            Pengeluaran Terbaru
          </h2>
          <Link href="/history" className="text-xs font-bold text-brand-600 dark:text-brand-400 flex items-center gap-0.5 uppercase tracking-wider hover:underline">
            Lihat semua <ArrowUpRight className="w-3 h-3" />
          </Link>
        </div>
        <div className="neo-card divide-y divide-slate-100 dark:divide-slate-800/80 p-0 overflow-hidden">
          {recent.length === 0 && !loading && (
            <p className="p-5 text-sm text-slate-500 dark:text-slate-400 text-center font-medium">
              Belum ada pengeluaran di periode ini.
            </p>
          )}
          {recent.map((e) => (
            <div key={e.id} className="flex items-center justify-between p-4 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center border border-slate-200 dark:border-slate-800 shadow-sm shrink-0"
                    style={{ backgroundColor: `${e.categories?.color ?? "#94a3b8"}15` }}
                  >
                    {(() => {
                      const Icon = getCategoryIcon(e.categories?.name ?? "");
                      return (
                        <Icon
                          className="w-4 h-4 shrink-0"
                          style={{ color: e.categories?.color ?? "#94a3b8" }}
                        />
                      );
                    })()}
                  </div>
                  <p className="font-semibold text-sm text-slate-900 dark:text-slate-100 truncate">{e.description}</p>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 ml-10 mt-0.5">
                  {e.categories?.name} ·{" "}
                  {new Date(e.spent_at).toLocaleDateString("id-ID", {
                    day: "numeric",
                    month: "short",
                  })}
                </p>
              </div>
              <p className="font-mono font-bold text-sm text-slate-900 dark:text-slate-100 shrink-0 ml-3">{formatIDR(e.amount)}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

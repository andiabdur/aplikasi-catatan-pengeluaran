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
      <div className="bg-white dark:bg-surface-dark border-4 border-slate-950 dark:border-slate-100 p-3 rounded-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)] transition-all">
        <PeriodSelector
          labelMonth={labelMonth}
          payDay={payDay}
          onChange={setLabelMonth}
          customRangeText={periodRangeTextWithCustom(labelMonth, payDay, customPeriods)}
        />
        {!isCurrent && (
          <button
            onClick={() => setLabelMonth(currentPeriodLabelWithCustom(payDay, customPeriods))}
            className="mt-2 text-xs font-mono font-bold uppercase tracking-wider text-brand-600 dark:text-brand-400 w-full text-center hover:underline"
          >
            Ke periode sekarang
          </button>
        )}
      </div>

      {/* Hero summary (Bauhaus V2 Style) */}
      <section className="bg-slate-950 text-slate-50 dark:bg-slate-900 border-4 border-slate-950 dark:border-slate-100 p-5 rounded-none shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] dark:shadow-[6px_6px_0px_0px_rgba(255,255,255,1)] flex flex-col gap-4 relative overflow-hidden transition-all">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-bl-full pointer-events-none" />
        <div className="flex flex-col gap-1 z-10">
          <span className="text-xs font-headline font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Wallet className="w-4 h-4 text-brand-400" /> Sisa uang periode ini
          </span>
          <h3 className="font-headline text-3xl font-black tracking-tight text-brand-400 mt-1">
            {formatIDR(sisa)}
          </h3>
        </div>

        {/* Progress Section */}
        {totalBudget > 0 && (
          <div className="flex flex-col gap-2 mt-1 z-10">
            <div className="flex justify-between items-end">
              <span className="text-xs font-headline font-bold uppercase text-slate-300">Total Budget</span>
              <span className="font-mono text-xs font-bold text-slate-300">{formatIDR(totalBudget)}</span>
            </div>
            <div className="h-5 w-full bg-slate-900 border-2 border-slate-100 rounded-none overflow-hidden flex shadow-[inset_2px_2px_0px_0px_rgba(0,0,0,0.5)]">
              <div
                className="h-full bg-brand-500 border-r-2 border-slate-100 transition-all"
                style={{ width: `${Math.min(100, (totalSpent / totalBudget) * 100)}%` }}
              />
            </div>
            <div className="flex justify-end">
              <span className="font-mono text-[11px] font-bold bg-white text-slate-950 px-2 py-0.5 uppercase tracking-widest border border-slate-950 shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]">
                {((totalSpent / totalBudget) * 100).toFixed(1)}% Terpakai
              </span>
            </div>
          </div>
        )}

        {/* Income/Spent Mini Stats */}
        <div className="grid grid-cols-2 gap-3 mt-1 pt-3 border-t-4 border-slate-800 border-dashed z-10">
          <div className="bg-slate-900 border-2 border-slate-800 p-2.5">
            <span className="text-[10px] font-headline font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400" /> Pemasukan
            </span>
            <span className="font-mono text-xs font-bold text-white mt-0.5 block">{formatIDR(totalIncome)}</span>
          </div>
          <div className="bg-slate-900 border-2 border-slate-800 p-2.5">
            <span className="text-[10px] font-headline font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
              <TrendingDown className="w-3.5 h-3.5 text-rose-400" /> Pengeluaran
            </span>
            <span className="font-mono text-xs font-bold text-white mt-0.5 block">{formatIDR(totalSpent)}</span>
          </div>
        </div>
      </section>

      {/* AI CFO Banner */}
      <Link
        href="/asisten"
        className="w-full bg-white dark:bg-surface-dark border-4 border-slate-950 dark:border-slate-100 rounded-none p-4 flex items-center gap-3.5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)] hover:bg-slate-950 dark:hover:bg-slate-100 hover:text-white dark:hover:text-slate-950 group active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all text-left"
      >
        <div className="w-11 h-11 rounded-none bg-slate-950 dark:bg-slate-100 text-white dark:text-slate-950 border-2 border-slate-950 dark:border-slate-100 flex items-center justify-center shrink-0 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,1)] group-hover:border-white dark:group-hover:border-slate-950 transition-all">
          <Sparkles className="w-5 h-5 text-brand-400 group-hover:text-brand-300" />
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="font-headline text-sm font-bold uppercase tracking-wider text-slate-950 dark:text-slate-100 group-hover:text-white dark:group-hover:text-slate-950 transition-colors">
            Audit CFO AI
          </h4>
          <p className="text-xs text-slate-600 dark:text-slate-400 group-hover:text-slate-300 dark:group-hover:text-slate-700 mt-0.5 transition-colors">
            Diagnosa kesehatan cashflow & rekomendasi
          </p>
        </div>
        <ArrowUpRight className="w-5 h-5 text-slate-950 dark:text-slate-100 group-hover:text-white dark:group-hover:text-slate-950 transition-colors shrink-0" />
      </Link>

      {/* Categories Breakdown */}
      <section className="space-y-3 mt-1">
        <div className="flex items-center justify-between">
          <h2 className="font-headline font-bold text-slate-950 dark:text-slate-100 text-sm uppercase tracking-wider">
            Alokasi Budget
          </h2>
          <Link
            href="/settings"
            className="font-mono text-xs font-bold text-slate-950 dark:text-slate-100 bg-white dark:bg-surface-dark border-2 border-slate-950 dark:border-slate-100 px-2 py-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,1)] hover:bg-slate-950 hover:text-white dark:hover:bg-slate-100 dark:hover:text-slate-950 active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all uppercase tracking-wider"
          >
            Atur Budget
          </Link>
        </div>
        <div className="flex flex-col gap-3">
          {loading && (
            <div className="bg-white dark:bg-surface-dark border-4 border-slate-950 dark:border-slate-100 p-6 text-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)]">
              <p className="text-xs font-mono uppercase tracking-wider text-slate-500">Memuat alokasi budget...</p>
            </div>
          )}
          {!loading && summary.length === 0 && (
            <div className="bg-white dark:bg-surface-dark border-4 border-slate-950 dark:border-slate-100 p-6 text-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)]">
              <p className="text-xs font-mono uppercase tracking-wider text-slate-500">Belum ada kategori budget.</p>
            </div>
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
                className="bg-white dark:bg-surface-dark border-4 border-slate-950 dark:border-slate-100 rounded-none p-4 flex flex-col gap-2.5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all"
              >
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-10 h-10 rounded-none border-2 border-slate-950 dark:border-slate-100 flex items-center justify-center shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,1)] shrink-0"
                      style={{ backgroundColor: row.color ?? "#16a34a" }}
                    >
                      {(() => {
                        const Icon = getCategoryIcon(row.category_name);
                        return <Icon className="w-5 h-5 text-white" />;
                      })()}
                    </div>
                    <span className="font-headline font-bold text-sm text-slate-950 dark:text-slate-100 uppercase tracking-wider">
                      {row.category_name}
                    </span>
                  </div>
                  <span
                    className={cn(
                      "font-mono text-xs px-2 py-0.5 border-2 border-slate-950 dark:border-slate-100 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,1)] font-black",
                      overBudget
                        ? "bg-rose-500 text-white"
                        : pct > 80
                        ? "bg-amber-400 text-slate-950"
                        : "bg-slate-950 dark:bg-slate-100 text-white dark:text-slate-950"
                    )}
                  >
                    {Number(row.usage_pct).toFixed(0)}%
                  </span>
                </div>
                <div className="h-3.5 w-full bg-slate-100 dark:bg-slate-800 border-2 border-slate-950 dark:border-slate-100 rounded-none overflow-hidden shadow-[inset_2px_2px_0px_0px_rgba(0,0,0,0.15)]">
                  <div
                    className={cn(
                      "h-full border-r-2 border-slate-950 dark:border-slate-100 transition-all",
                      overBudget ? "bg-rose-500" : pct > 80 ? "bg-amber-400" : "bg-brand-500"
                    )}
                    style={{
                      width: `${pct}%`,
                      background: !overBudget && pct <= 80 ? (row.color ?? undefined) : undefined,
                    }}
                  />
                </div>
                <div className="flex justify-between items-center text-[11px] font-mono font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                  <span className={cn(overBudget && "text-rose-600 dark:text-rose-400")}>
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
      <section className="space-y-3 mt-2">
        <div className="flex items-center justify-between">
          <h2 className="font-headline font-bold text-slate-950 dark:text-slate-100 text-sm uppercase tracking-wider">
            Transaksi Terakhir
          </h2>
          <Link
            href="/history"
            className="font-mono text-xs font-bold text-slate-950 dark:text-slate-100 flex items-center gap-1 uppercase tracking-wider hover:underline"
          >
            Lihat semua <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        <div className="bg-white dark:bg-surface-dark border-4 border-slate-950 dark:border-slate-100 rounded-none overflow-hidden shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)]">
          {recent.length === 0 && !loading && (
            <p className="p-5 text-xs font-mono text-slate-500 dark:text-slate-400 text-center uppercase tracking-wider">
              Belum ada pengeluaran di periode ini.
            </p>
          )}
          {recent.map((e, idx) => (
            <div
              key={e.id}
              className={cn(
                "flex items-center justify-between p-3.5 hover:bg-slate-950 dark:hover:bg-slate-100 hover:text-white dark:hover:text-slate-950 group transition-all",
                idx !== recent.length - 1 && "border-b-4 border-slate-950 dark:border-slate-100"
              )}
            >
              <div className="min-w-0 flex-1 flex items-start gap-3">
                <div
                  className="w-10 h-10 rounded-none border-2 border-slate-950 dark:border-slate-100 flex items-center justify-center shrink-0 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,1)] mt-0.5"
                  style={{ backgroundColor: e.categories?.color ?? "#16a34a" }}
                >
                  {(() => {
                    const Icon = getCategoryIcon(e.categories?.name ?? "");
                    return <Icon className="w-5 h-5 text-white" />;
                  })()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-headline font-bold text-sm uppercase tracking-wider text-slate-950 dark:text-slate-100 group-hover:text-white dark:group-hover:text-slate-950 whitespace-normal break-words leading-snug">
                    {e.description}
                  </p>
                  <p className="text-[10px] font-mono text-slate-500 dark:text-slate-400 group-hover:text-slate-300 dark:group-hover:text-slate-700 tracking-wider uppercase mt-0.5">
                    {e.categories?.name} ·{" "}
                    {new Date(e.spent_at).toLocaleDateString("id-ID", {
                      day: "numeric",
                      month: "short",
                    })}
                  </p>
                </div>
              </div>
              <p className="font-mono font-black text-sm text-slate-950 dark:text-slate-100 group-hover:text-white dark:group-hover:text-slate-950 shrink-0 ml-3 self-center sm:self-start sm:pt-0.5">
                - {formatIDR(e.amount)}
              </p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

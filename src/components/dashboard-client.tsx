"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, TrendingUp, TrendingDown, Wallet, Sparkles, MessageCircle, BarChart3 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatIDR } from "@/lib/format";
import {
  currentPeriodLabelWithCustom,
  labelMonthKey,
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
  const [customPeriods] = useState(initialCustomPeriods);
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
  const totalIncome = incomes.reduce((s, i) => s + Number(i.amount), 0);
  const sisa = totalIncome - totalSpent;
  const isCurrent = labelMonthKey(labelMonth) === labelMonthKey(currentPeriodLabelWithCustom(payDay, customPeriods));
  const budgetPct = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

  return (
    <>
      <div className="bg-card border border-border p-3 rounded-2xl shadow-sm transition-colors">
        <PeriodSelector
          labelMonth={labelMonth}
          payDay={payDay}
          onChange={setLabelMonth}
          customRangeText={periodRangeTextWithCustom(labelMonth, payDay, customPeriods)}
        />
        {!isCurrent && (
          <button
            type="button"
            onClick={() => setLabelMonth(currentPeriodLabelWithCustom(payDay, customPeriods))}
            className="mt-2 text-xs font-medium text-primary w-full text-center hover:underline py-1"
          >
            Ke periode sekarang
          </button>
        )}
      </div>

      {/* Hero Summary Card (Soft Warm Shadcn Surface) */}
      <section className="bg-card text-card-foreground border border-border rounded-2xl p-5 shadow-sm flex flex-col gap-4 transition-colors">
        <div className="rounded-xl bg-accent/80 border border-brand-200/70 dark:border-brand-800/40 p-4 space-y-1">
          <span className="text-xs font-medium text-accent-foreground flex items-center gap-1.5">
            <Wallet className="w-4 h-4 text-primary" /> Sisa uang periode ini
          </span>
          <h3
            className={cn(
              "text-3xl font-bold tracking-tight font-mono tabular-nums",
              sisa < 0 ? "text-rose-700 dark:text-rose-300" : "text-foreground"
            )}
          >
            {formatIDR(sisa)}
          </h3>
        </div>

        {/* Budget Progress */}
        {totalBudget > 0 && (
          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-center text-xs">
              <span className="font-medium text-muted-foreground">Pemakaian budget</span>
              <span className="font-mono font-semibold text-foreground tabular-nums">
                {formatIDR(totalSpent)} / {formatIDR(totalBudget)}
              </span>
            </div>
            <div className="h-2.5 w-full bg-muted rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-300",
                  budgetPct > 100 ? "bg-rose-600 dark:bg-rose-400" : budgetPct > 80 ? "bg-amber-600 dark:bg-amber-400" : "bg-primary"
                )}
                style={{ width: `${Math.min(100, budgetPct)}%` }}
              />
            </div>
            <div className="flex justify-end">
              <span
                className={cn(
                  "text-xs font-mono font-medium px-2 py-0.5 rounded-full border",
                  budgetPct > 100
                    ? "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/60"
                    : budgetPct > 80
                      ? "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/60"
                      : "bg-muted text-muted-foreground border-border"
                )}
              >
                {budgetPct.toFixed(1)}% terpakai
              </span>
            </div>
          </div>
        )}

        {/* Income/Spent Mini Stats */}
        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border">
          <div className="bg-muted/60 rounded-xl p-3 border border-border/60">
            <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5 text-teal-700 dark:text-teal-300" /> Pemasukan
            </span>
            <span className="font-mono text-sm font-semibold text-teal-700 dark:text-teal-300 mt-1 block tabular-nums">
              {formatIDR(totalIncome)}
            </span>
          </div>
          <div className="bg-muted/60 rounded-xl p-3 border border-border/60">
            <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <TrendingDown className="w-3.5 h-3.5 text-rose-700 dark:text-rose-300" /> Pengeluaran
            </span>
            <span className="font-mono text-sm font-semibold text-rose-700 dark:text-rose-300 mt-1 block tabular-nums">
              {formatIDR(totalSpent)}
            </span>
          </div>
        </div>
      </section>

      {/* Asisten Keuangan AI (Direct Chat & Audit CFO) */}
      <section className="w-full bg-card border border-border rounded-2xl p-4 space-y-3 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent text-primary border border-brand-200/70 dark:border-brand-800/40 flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="text-sm font-semibold text-foreground">
              Asisten Keuangan AI
            </h4>
            <p className="text-xs text-muted-foreground mt-0.5">
              Tanya cashflow, catat cepat, atau audit CFO
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <Link
            href="/asisten?tab=chat"
            className="min-h-[44px] px-3 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm active:scale-[0.98] flex items-center justify-center gap-1.5 font-semibold text-xs transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <MessageCircle className="w-4 h-4" />
            <span>Chat AI</span>
          </Link>
          <Link
            href="/asisten?tab=analisa"
            className="min-h-[44px] px-3 py-2 rounded-xl bg-secondary hover:bg-muted text-secondary-foreground border border-border active:scale-[0.98] flex items-center justify-center gap-1.5 font-semibold text-xs transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <BarChart3 className="w-4 h-4" />
            <span>Audit CFO</span>
          </Link>
        </div>
      </section>

      {/* Categories Breakdown */}
      <section className="space-y-3 mt-1">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-foreground text-sm">
            Alokasi Budget
          </h2>
          <Link
            href="/settings"
            className="text-xs font-medium text-primary hover:underline px-2 py-1 rounded-lg hover:bg-accent transition-colors"
          >
            Atur Budget
          </Link>
        </div>
        <div className="flex flex-col gap-2.5">
          {loading && (
            <div className="bg-card border border-border rounded-2xl p-6 text-center shadow-sm">
              <p className="text-xs text-muted-foreground">Memuat alokasi budget...</p>
            </div>
          )}
          {!loading && summary.length === 0 && (
            <div className="bg-card border border-border rounded-2xl p-6 text-center shadow-sm">
              <p className="text-xs text-muted-foreground">Belum ada kategori budget.</p>
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
                className="bg-card border border-border rounded-2xl p-4 flex flex-col gap-2.5 shadow-sm hover:border-primary/40 active:scale-[0.99] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="flex justify-between items-center gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                      style={{ backgroundColor: row.color ?? "#B85138" }}
                    >
                      {(() => {
                        const Icon = getCategoryIcon(row.category_name);
                        return <Icon className="w-4 h-4 text-white" />;
                      })()}
                    </div>
                    <span className="font-semibold text-sm text-foreground truncate">
                      {row.category_name}
                    </span>
                  </div>
                  <span
                    className={cn(
                      "font-mono text-xs px-2.5 py-0.5 rounded-full border font-semibold shrink-0 tabular-nums",
                      overBudget
                        ? "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/60"
                        : pct > 80
                          ? "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/60"
                          : "bg-muted text-muted-foreground border-border"
                    )}
                  >
                    {Number(row.usage_pct).toFixed(0)}%
                  </span>
                </div>
                <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      overBudget ? "bg-rose-600 dark:bg-rose-400" : pct > 80 ? "bg-amber-500" : "bg-primary"
                    )}
                    style={{
                      width: `${pct}%`,
                      background: !overBudget && pct <= 80 ? (row.color ?? undefined) : undefined,
                    }}
                  />
                </div>
                <div className="flex justify-between items-center text-xs font-mono text-muted-foreground tabular-nums">
                  <span className={cn(overBudget && "text-rose-700 dark:text-rose-300 font-semibold")}>
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
          <h2 className="font-semibold text-foreground text-sm">
            Transaksi Terakhir
          </h2>
          <Link
            href="/history"
            className="text-xs font-medium text-primary flex items-center gap-1 hover:underline px-2 py-1 rounded-lg hover:bg-accent transition-colors"
          >
            Lihat semua <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm divide-y divide-border">
          {recent.length === 0 && !loading && (
            <p className="p-5 text-xs text-muted-foreground text-center">
              Belum ada pengeluaran di periode ini.
            </p>
          )}
          {recent.map((e) => (
            <div
              key={e.id}
              className="flex items-center justify-between p-3.5 hover:bg-muted/50 transition-colors"
            >
              <div className="min-w-0 flex-1 flex items-start gap-3">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                  style={{ backgroundColor: e.categories?.color ?? "#B85138" }}
                >
                  {(() => {
                    const Icon = getCategoryIcon(e.categories?.name ?? "");
                    return <Icon className="w-4 h-4 text-white" />;
                  })()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm text-foreground whitespace-normal break-words leading-snug">
                    {e.description}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {e.categories?.name} ·{" "}
                    {new Date(e.spent_at).toLocaleDateString("id-ID", {
                      day: "numeric",
                      month: "short",
                    })}
                  </p>
                </div>
              </div>
              <p className="font-mono font-semibold text-sm text-foreground shrink-0 ml-3 tabular-nums">
                -{formatIDR(e.amount)}
              </p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

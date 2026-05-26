"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, TrendingUp, TrendingDown, Wallet } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatIDR } from "@/lib/format";
import {
  currentPeriodLabelWithCustom,
  labelMonthKey,
  isoDate,
  getPeriodRange,
  periodRangeTextWithCustom,
} from "@/lib/period";
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
      <div className="card">
        <PeriodSelector
          labelMonth={labelMonth}
          payDay={payDay}
          onChange={setLabelMonth}
          customRangeText={periodRangeTextWithCustom(labelMonth, payDay, customPeriods)}
        />
        {!isCurrent && (
          <button
            onClick={() => setLabelMonth(currentPeriodLabelWithCustom(payDay, customPeriods))}
            className="mt-2 text-xs text-brand-600 w-full text-center"
          >
            Ke periode sekarang
          </button>
        )}
      </div>


      {/* Hero summary */}
      <section className="rounded-2xl bg-gradient-to-br from-brand-600 to-brand-700 text-white p-5 shadow-lg shadow-brand-600/20">
        <div className="flex items-center gap-2 text-sm text-brand-100">
          <Wallet className="w-4 h-4" />
          Sisa uang periode ini
        </div>
        <div className="text-3xl font-bold mt-1">{formatIDR(sisa)}</div>
        <div className="grid grid-cols-2 gap-3 mt-4 text-sm">
          <div className="bg-white/10 rounded-xl p-3">
            <div className="flex items-center gap-1 text-brand-100">
              <TrendingUp className="w-3.5 h-3.5" />
              Income
            </div>
            <div className="font-semibold mt-0.5">{formatIDR(totalIncome)}</div>
          </div>
          <div className="bg-white/10 rounded-xl p-3">
            <div className="flex items-center gap-1 text-brand-100">
              <TrendingDown className="w-3.5 h-3.5" />
              Terpakai
            </div>
            <div className="font-semibold mt-0.5">{formatIDR(totalSpent)}</div>
          </div>
        </div>
        {totalBudget > 0 && (
          <div className="mt-4">
            <div className="flex justify-between text-xs text-brand-100 mb-1">
              <span>Pemakaian budget</span>
              <span>
                {((totalSpent / totalBudget) * 100).toFixed(1)}% dari {formatIDR(totalBudget)}
              </span>
            </div>
            <div className="h-2 bg-white/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-white rounded-full"
                style={{ width: `${Math.min(100, (totalSpent / totalBudget) * 100)}%` }}
              />
            </div>
          </div>
        )}
      </section>

      {/* Categories */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Budget per Kategori</h2>
          <Link href="/settings" className="text-xs text-brand-600">
            Atur
          </Link>
        </div>
        <div className="card divide-y divide-slate-100 p-0">
          {loading && (
            <p className="p-4 text-sm text-slate-500 text-center">Memuat...</p>
          )}
          {!loading && summary.length === 0 && (
            <p className="p-4 text-sm text-slate-500">Belum ada kategori.</p>
          )}
          {summary.map((row) => {
            const pct = Math.min(100, Number(row.usage_pct));
            const overBudget = Number(row.spent) > Number(row.budget) && Number(row.budget) > 0;
            return (
              <div key={row.category_id} className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ background: row.color ?? "#94a3b8" }}
                    />
                    <span className="font-medium text-sm">{row.category_name}</span>
                  </div>
                  <span className="text-xs text-slate-500">
                    {formatIDR(row.spent)} / {formatIDR(row.budget)}
                  </span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      overBudget ? "bg-red-500" : pct > 80 ? "bg-amber-500" : "bg-brand-500",
                    )}
                    style={{
                      width: `${pct}%`,
                      background:
                        !overBudget && pct <= 80 ? (row.color ?? undefined) : undefined,
                    }}
                  />
                </div>
                <div className="flex justify-between mt-1.5 text-xs">
                  <span className={cn(overBudget ? "text-red-600" : "text-slate-500")}>
                    {overBudget
                      ? `Lebih ${formatIDR(Number(row.spent) - Number(row.budget))}`
                      : `Sisa ${formatIDR(row.remaining)}`}
                  </span>
                  <span className="text-slate-400">{Number(row.usage_pct).toFixed(1)}%</span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Recent expenses */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Pengeluaran Terbaru</h2>
          <Link href="/history" className="text-xs text-brand-600 flex items-center gap-0.5">
            Lihat semua <ArrowUpRight className="w-3 h-3" />
          </Link>
        </div>
        <div className="card divide-y divide-slate-100 p-0">
          {recent.length === 0 && !loading && (
            <p className="p-4 text-sm text-slate-500 text-center">
              Belum ada pengeluaran di periode ini.
            </p>
          )}
          {recent.map((e) => (
            <div key={e.id} className="flex items-center justify-between p-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ background: e.categories?.color ?? "#94a3b8" }}
                  />
                  <p className="font-medium truncate">{e.description}</p>
                </div>
                <p className="text-xs text-slate-500 ml-4 mt-0.5">
                  {e.categories?.name} ·{" "}
                  {new Date(e.spent_at).toLocaleDateString("id-ID", {
                    day: "numeric",
                    month: "short",
                  })}
                </p>
              </div>
              <p className="font-semibold text-sm shrink-0 ml-3">{formatIDR(e.amount)}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

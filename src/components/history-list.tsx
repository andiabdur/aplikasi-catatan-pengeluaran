"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatIDR } from "@/lib/format";
import {
  currentPeriodLabel,
  labelMonthKey,
  periodEnd,
  periodStart,
  isoDate,
} from "@/lib/period";
import { PeriodSelector } from "@/components/period-selector";
import { CategoryPieChart, CategoryBarChart } from "@/components/expense-charts";
import { Search, Trash2, X, PieChart as PieIcon, BarChart3, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Category, Expense } from "@/lib/types";

type Row = Expense & {
  categories: { name: string; color: string | null } | null;
};

type FilterMode = "period" | "custom";
type ChartMode = "pie" | "bar";

export function HistoryList({
  categories,
  householdId,
  payDay,
  initialLabelMonth,
}: {
  categories: Category[];
  householdId: string;
  payDay: number;
  initialLabelMonth: string;
}) {
  const [filterMode, setFilterMode] = useState<FilterMode>("period");
  const [labelMonth, setLabelMonth] = useState<Date>(new Date(initialLabelMonth));
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [catFilter, setCatFilter] = useState<string>("");
  const [search, setSearch] = useState("");
  const [chartMode, setChartMode] = useState<ChartMode>("pie");
  const [chartOpen, setChartOpen] = useState(true);

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  // Derive effective date range
  const range = useMemo(() => {
    if (filterMode === "period") {
      return {
        from: isoDate(periodStart(labelMonth, payDay)),
        to: isoDate(periodEnd(labelMonth, payDay)),
      };
    }
    return { from: from || null, to: to || null };
  }, [filterMode, labelMonth, payDay, from, to]);

  async function load() {
    setLoading(true);
    const supabase = createClient();
    let q = supabase
      .from("expenses")
      .select("*,categories(name,color)")
      .eq("household_id", householdId)
      .order("spent_at", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(500);
    if (catFilter) q = q.eq("category_id", catFilter);
    if (range.from) q = q.gte("spent_at", range.from);
    if (range.to) q = q.lte("spent_at", range.to);
    const { data } = await q;
    setRows((data ?? []) as Row[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catFilter, range.from, range.to, householdId]);

  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const s = search.toLowerCase();
    return rows.filter((r) => r.description.toLowerCase().includes(s));
  }, [rows, search]);

  const total = filtered.reduce((s, r) => s + Number(r.amount), 0);

  const chartData = useMemo(() => {
    const map = new Map<string, { name: string; value: number; color: string }>();
    for (const r of filtered) {
      const key = r.category_id;
      const name = r.categories?.name ?? "Lainnya";
      const color = r.categories?.color ?? "#94a3b8";
      const cur = map.get(key) ?? { name, value: 0, color };
      cur.value += Number(r.amount);
      map.set(key, cur);
    }
    return [...map.values()];
  }, [filtered]);

  async function handleDelete(id: string) {
    if (!confirm("Hapus pengeluaran ini?")) return;
    const supabase = createClient();
    await supabase.from("expenses").delete().eq("id", id);
    setRows((rs) => rs.filter((r) => r.id !== id));
  }

  // Group by date
  const grouped = useMemo(() => {
    const map = new Map<string, Row[]>();
    filtered.forEach((r) => {
      if (!map.has(r.spent_at)) map.set(r.spent_at, []);
      map.get(r.spent_at)!.push(r);
    });
    return [...map.entries()];
  }, [filtered]);

  return (
    <div className="space-y-3">
      {/* Filter panel */}
      <div className="card space-y-3">
        {/* Mode tabs */}
        <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-xl">
          <button
            onClick={() => setFilterMode("period")}
            className={cn(
              "py-1.5 text-sm font-medium rounded-lg transition",
              filterMode === "period" ? "bg-white shadow-sm text-slate-900" : "text-slate-500",
            )}
          >
            Per Periode
          </button>
          <button
            onClick={() => setFilterMode("custom")}
            className={cn(
              "py-1.5 text-sm font-medium rounded-lg transition",
              filterMode === "custom" ? "bg-white shadow-sm text-slate-900" : "text-slate-500",
            )}
          >
            Custom Tanggal
          </button>
        </div>

        {filterMode === "period" ? (
          <div>
            <PeriodSelector labelMonth={labelMonth} payDay={payDay} onChange={setLabelMonth} />
            {labelMonthKey(labelMonth) !== labelMonthKey(currentPeriodLabel(payDay)) && (
              <button
                onClick={() => setLabelMonth(currentPeriodLabel(payDay))}
                className="mt-1 text-xs text-brand-600 w-full text-center"
              >
                Ke periode sekarang
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-slate-500">Dari</label>
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="input py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500">Sampai</label>
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="input py-2 text-sm"
              />
            </div>
          </div>
        )}

        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari kebutuhan..."
            className="input pl-9"
          />
        </div>

        {/* Category chips */}
        <div className="flex gap-2 overflow-x-auto -mx-1 px-1 pb-1">
          <button
            onClick={() => setCatFilter("")}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs whitespace-nowrap",
              !catFilter ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-600",
            )}
          >
            Semua
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setCatFilter(c.id)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs whitespace-nowrap flex items-center gap-1.5",
                catFilter === c.id ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-600",
              )}
            >
              <span className="w-2 h-2 rounded-full" style={{ background: c.color ?? "#94a3b8" }} />
              {c.name}
            </button>
          ))}
        </div>

        {(catFilter || search) && (
          <button
            onClick={() => {
              setCatFilter("");
              setSearch("");
            }}
            className="text-xs text-slate-500 flex items-center gap-1"
          >
            <X className="w-3 h-3" /> Reset filter
          </button>
        )}
      </div>

      {/* Summary card */}
      <div className="card flex items-center justify-between bg-brand-50 border-brand-200">
        <div>
          <p className="text-xs text-slate-600">Total ({filtered.length} item)</p>
          <p className="font-bold text-brand-700 text-lg">{formatIDR(total)}</p>
        </div>
        <button
          onClick={() => setChartOpen(!chartOpen)}
          className="text-xs text-brand-700 flex items-center gap-1"
        >
          {chartOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          Chart
        </button>
      </div>

      {/* Chart */}
      {chartOpen && filtered.length > 0 && (
        <div className="card space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Analisis Kategori</h3>
            <div className="flex bg-slate-100 rounded-lg p-0.5">
              <button
                onClick={() => setChartMode("pie")}
                className={cn(
                  "p-1.5 rounded text-slate-500",
                  chartMode === "pie" && "bg-white shadow-sm text-slate-900",
                )}
                aria-label="Pie chart"
              >
                <PieIcon className="w-4 h-4" />
              </button>
              <button
                onClick={() => setChartMode("bar")}
                className={cn(
                  "p-1.5 rounded text-slate-500",
                  chartMode === "bar" && "bg-white shadow-sm text-slate-900",
                )}
                aria-label="Bar chart"
              >
                <BarChart3 className="w-4 h-4" />
              </button>
            </div>
          </div>
          {chartMode === "pie" ? (
            <CategoryPieChart data={chartData} total={total} />
          ) : (
            <CategoryBarChart data={chartData} total={total} />
          )}
        </div>
      )}

      {/* List */}
      {loading ? (
        <p className="text-center text-sm text-slate-500 py-8">Memuat...</p>
      ) : grouped.length === 0 ? (
        <p className="text-center text-sm text-slate-500 py-8">Tidak ada pengeluaran.</p>
      ) : (
        grouped.map(([date, items]) => {
          const dayTotal = items.reduce((s, r) => s + Number(r.amount), 0);
          return (
            <div key={date}>
              <div className="flex items-center justify-between px-2 py-2">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  {new Date(date).toLocaleDateString("id-ID", {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </p>
                <p className="text-xs font-medium text-slate-500">{formatIDR(dayTotal)}</p>
              </div>
              <div className="card divide-y divide-slate-100 p-0">
                {items.map((r) => (
                  <div key={r.id} className="flex items-center justify-between p-3 group">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ background: r.categories?.color ?? "#94a3b8" }}
                        />
                        <p className="font-medium truncate">{r.description}</p>
                      </div>
                      <p className="text-xs text-slate-500 ml-4 mt-0.5">{r.categories?.name}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <p className="font-semibold text-sm">{formatIDR(r.amount)}</p>
                      <button
                        onClick={() => handleDelete(r.id)}
                        className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg"
                        aria-label="Hapus"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

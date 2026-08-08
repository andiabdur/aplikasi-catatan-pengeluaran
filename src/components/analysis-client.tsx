"use client";

import { useEffect, useState, useMemo } from "react";
import { ArrowLeft, BarChart3, Calendar, Filter, Sparkles, TrendingDown, Wallet, CalendarDays, Hash } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { formatIDR } from "@/lib/format";
import { getCategoryIcon } from "@/components/category-icon";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

type ExpenseWithCategory = {
  id: string;
  spent_at: string;
  amount: number;
  description: string;
  categories: {
    name: string;
    color: string | null;
  } | null;
};

type RangeOption = "7d" | "30d" | "3m" | "6m" | "custom";

function CustomAnalysisTooltip({ active, payload, label }: any) {
  if (!active || !payload || payload.length === 0) return null;

  const rawDate = payload[0]?.payload?.date;
  const formattedDate = rawDate
    ? new Date(rawDate).toLocaleDateString("id-ID", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : label;

  const activeItems = payload
    .filter((item: any) => Number(item.value) > 0)
    .sort((a: any, b: any) => Number(b.value) - Number(a.value));

  const dailyTotal = activeItems.reduce((acc: number, item: any) => acc + Number(item.value), 0);

  return (
    <div className="bg-slate-900/95 dark:bg-slate-950/95 backdrop-blur-md border border-slate-700/80 dark:border-slate-800 text-slate-100 p-3 rounded-xl shadow-2xl z-50 text-xs min-w-[210px] space-y-2 pointer-events-none">
      <div className="border-b border-slate-700/60 pb-1.5 flex items-center justify-between gap-3">
        <span className="font-semibold text-slate-200">{formattedDate}</span>
        <span className="font-bold text-brand-400">{formatIDR(dailyTotal)}</span>
      </div>
      {activeItems.length === 0 ? (
        <p className="text-[11px] text-slate-400">Tidak ada pengeluaran</p>
      ) : (
        <div className="space-y-1.5 max-h-48 overflow-y-auto pr-0.5">
          {activeItems.map((item: any) => (
            <div key={item.name} className="flex items-center justify-between gap-3 text-[11px]">
              <div className="flex items-center gap-1.5 truncate">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm"
                  style={{ backgroundColor: item.color || item.fill }}
                />
                <span className="text-slate-300 truncate font-medium">{item.name}</span>
              </div>
              <span className="font-bold text-slate-100 shrink-0">{formatIDR(Number(item.value))}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function AnalysisClient({ householdId }: { householdId: string }) {
  const [range, setRange] = useState<RangeOption>("30d");
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = useState<string>(() => {
    return new Date().toISOString().slice(0, 10);
  });

  const [expenses, setExpenses] = useState<ExpenseWithCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [visibleCategories, setVisibleCategories] = useState<Record<string, boolean>>({});

  function selectPresetRange(opt: "7d" | "30d" | "3m" | "6m") {
    setRange(opt);
    const now = new Date();
    const endStr = now.toISOString().slice(0, 10);
    let d = new Date();
    if (opt === "7d") d.setDate(now.getDate() - 7);
    else if (opt === "30d") d.setDate(now.getDate() - 30);
    else if (opt === "3m") d.setMonth(now.getMonth() - 3);
    else if (opt === "6m") d.setMonth(now.getMonth() - 6);
    setStartDate(d.toISOString().slice(0, 10));
    setEndDate(endStr);
  }

  useEffect(() => {
    async function loadData() {
      if (!householdId) return;
      setLoading(true);
      const supabase = createClient();

      let q = supabase
        .from("expenses")
        .select("id, spent_at, amount, description, categories(name, color)")
        .eq("household_id", householdId);

      if (startDate) q = q.gte("spent_at", startDate);
      if (endDate) q = q.lte("spent_at", endDate);

      q = q.order("spent_at", { ascending: true });

      const { data, error } = await q;

      if (!error && data) {
        setExpenses(data as unknown as ExpenseWithCategory[]);

        // Initialize all categories as visible by default
        const uniqueCats = new Set<string>();
        data.forEach((exp: any) => {
          if (exp.categories?.name) {
            uniqueCats.add(exp.categories.name);
          }
        });
        const initialVisible: Record<string, boolean> = {};
        uniqueCats.forEach((cat) => {
          initialVisible[cat] = true;
        });
        setVisibleCategories(initialVisible);
      }
      setLoading(false);
    }

    loadData();
  }, [householdId, startDate, endDate]);

  // Extract category stats
  const categoryStats = useMemo(() => {
    const stats: Record<string, { amount: number; color: string }> = {};
    expenses.forEach((e) => {
      const catName = e.categories?.name ?? "Lainnya";
      const catColor = e.categories?.color ?? "#94a3b8";
      if (!stats[catName]) {
        stats[catName] = { amount: 0, color: catColor };
      }
      stats[catName].amount += Number(e.amount);
    });

    return Object.entries(stats)
      .map(([name, val]) => ({
        name,
        amount: val.amount,
        color: val.color,
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [expenses]);

  const totalSpent = useMemo(() => {
    return categoryStats.reduce((sum, item) => sum + item.amount, 0);
  }, [categoryStats]);

  const daysDiff = useMemo(() => {
    if (!startDate || !endDate) return 1;
    const start = new Date(startDate).getTime();
    const end = new Date(endDate).getTime();
    const diff = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    return Math.max(1, diff + 1);
  }, [startDate, endDate]);

  const dailyAverage = useMemo(() => {
    return totalSpent / daysDiff;
  }, [totalSpent, daysDiff]);

  const topCategory = useMemo(() => {
    return categoryStats.length > 0 ? categoryStats[0] : null;
  }, [categoryStats]);

  // Transform raw rows into daily timeseries
  const chartData = useMemo(() => {
    if (expenses.length === 0) return [];

    const dailyData: Record<string, Record<string, number>> = {};
    const timestamps = expenses.map((e) => new Date(e.spent_at).getTime());
    const minTime = Math.min(...timestamps);
    const maxTime = Math.max(...timestamps);

    const start = new Date(minTime);
    const end = new Date(maxTime);

    let curr = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const endMidnight = new Date(end.getFullYear(), end.getMonth(), end.getDate());

    while (curr <= endMidnight) {
      const yyyy = curr.getFullYear();
      const mm = String(curr.getMonth() + 1).padStart(2, "0");
      const dd = String(curr.getDate()).padStart(2, "0");
      const dateString = `${yyyy}-${mm}-${dd}`;
      dailyData[dateString] = {};
      curr.setDate(curr.getDate() + 1);
    }

    expenses.forEach((e) => {
      const dateStr = e.spent_at;
      const catName = e.categories?.name ?? "Lainnya";
      if (!dailyData[dateStr]) dailyData[dateStr] = {};
      if (!dailyData[dateStr][catName]) dailyData[dateStr][catName] = 0;
      dailyData[dateStr][catName] += Number(e.amount);
    });

    return Object.entries(dailyData)
      .map(([date, categoriesAmount]) => {
        const row: Record<string, any> = { date };
        const parsedDate = new Date(date);
        row.formattedDate = parsedDate.toLocaleDateString("id-ID", {
          day: "numeric",
          month: "short",
        });

        categoryStats.forEach((cat) => {
          row[cat.name] = categoriesAmount[cat.name] ?? 0;
        });
        return row;
      })
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [expenses, categoryStats]);

  const handleLegendClick = (payload: any) => {
    const { value } = payload;
    setVisibleCategories((prev) => ({
      ...prev,
      [value]: !prev[value],
    }));
  };

  const toggleCategorySelection = (catName: string) => {
    setVisibleCategories((prev) => ({
      ...prev,
      [catName]: !prev[catName],
    }));
  };

  const toggleAllCategories = (visibleState: boolean) => {
    const updated: Record<string, boolean> = {};
    categoryStats.forEach((cat) => {
      updated[cat.name] = visibleState;
    });
    setVisibleCategories(updated);
  };

  return (
    <div className="space-y-4 pb-20">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Link href="/" className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
          <ArrowLeft className="w-5 h-5 text-slate-500" />
        </Link>
        <div>
          <h1 className="text-xl font-bold flex items-center gap-1.5 leading-none">
            Analisis Pengeluaran
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Visualisasi area interaktif pengeluaran berkala Anda.
          </p>
        </div>
      </div>

      {/* Date Range Selector Card */}
      <Card className="shadow-none">
        <CardContent className="p-3.5 sm:p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" /> Rentang Analisis Tanggal
            </span>
          </div>

          {/* Preset Buttons - Responsive Grid */}
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
            {[
              { label: "7 Hari", value: "7d" },
              { label: "30 Hari", value: "30d" },
              { label: "3 Bulan", value: "3m" },
              { label: "6 Bulan", value: "6m" },
              { label: "Custom", value: "custom" },
            ].map((opt) => (
              <Button
                key={opt.value}
                size="sm"
                variant={range === opt.value ? "default" : "outline"}
                className="w-full text-xs font-medium rounded-lg px-2 py-1 h-8 truncate"
                onClick={() => {
                  if (opt.value === "custom") {
                    setRange("custom");
                  } else {
                    selectPresetRange(opt.value as any);
                  }
                }}
              >
                {opt.label}
              </Button>
            ))}
          </div>

          {/* Custom Date Pickers */}
          {range === "custom" && (
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block mb-1">
                  Dari Tanggal
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="input text-xs py-1.5 w-full"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block mb-1">
                  Sampai Tanggal
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="input text-xs py-1.5 w-full"
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Financial Summary Information Cards - Responsive Layout */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
        {/* Card 1: Total Pengeluaran */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-950 dark:from-slate-900 dark:to-slate-950 text-white rounded-xl p-3 sm:p-3.5 shadow-sm border border-slate-800 flex flex-col justify-between min-w-0">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400 min-w-0 truncate">
            <Wallet className="w-3.5 h-3.5 text-brand-400 shrink-0" />
            <span className="truncate">Total Pengeluaran</span>
          </div>
          <p
            className="text-xs sm:text-sm md:text-base font-extrabold tracking-tight mt-1.5 text-brand-400 truncate"
            title={formatIDR(totalSpent)}
          >
            {formatIDR(totalSpent)}
          </p>
          <p className="text-[10px] text-slate-400 mt-1 truncate">{daysDiff} hari rentang</p>
        </div>

        {/* Card 2: Rata-Rata / Hari */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 sm:p-3.5 shadow-sm flex flex-col justify-between min-w-0">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 min-w-0 truncate">
            <CalendarDays className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
            <span className="truncate">Rata-Rata / Hari</span>
          </div>
          <p
            className="text-xs sm:text-sm md:text-base font-extrabold tracking-tight mt-1.5 text-slate-900 dark:text-slate-100 truncate"
            title={formatIDR(Math.round(dailyAverage))}
          >
            {formatIDR(Math.round(dailyAverage))}
          </p>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 truncate">Estimasi harian</p>
        </div>

        {/* Card 3: Kategori Terbesar */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 sm:p-3.5 shadow-sm flex flex-col justify-between min-w-0">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 min-w-0 truncate">
            <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <span className="truncate">Kategori Terbesar</span>
          </div>
          <div className="mt-1.5 min-w-0">
            <p
              className="text-xs sm:text-sm font-bold tracking-tight text-slate-900 dark:text-slate-100 truncate"
              title={topCategory ? topCategory.name : "-"}
            >
              {topCategory ? topCategory.name : "-"}
            </p>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold truncate mt-0.5">
              {topCategory ? formatIDR(topCategory.amount) : "0"}
            </p>
          </div>
        </div>

        {/* Card 4: Total Transaksi */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 sm:p-3.5 shadow-sm flex flex-col justify-between min-w-0">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 min-w-0 truncate">
            <Hash className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            <span className="truncate">Total Transaksi</span>
          </div>
          <p className="text-xs sm:text-sm md:text-base font-extrabold tracking-tight mt-1.5 text-slate-900 dark:text-slate-100 truncate">
            {expenses.length} <span className="text-[11px] font-normal text-slate-500">item</span>
          </p>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 truncate">Dalam rentang ini</p>
        </div>
      </div>

      {/* Interactive Chart Section */}
      <Card className="shadow-none overflow-hidden">
        <CardHeader className="p-4 border-b border-slate-100 dark:border-slate-800/80">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                <BarChart3 className="w-4 h-4 text-brand-600 dark:text-brand-400" /> Tren Waktu Harian
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Klik tag warna kategori pada legenda di bawah untuk menyembunyikan/menampilkannya.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4">
          {loading ? (
            <div className="space-y-3 py-6">
              <Skeleton className="h-56 w-full rounded-lg" />
              <div className="flex justify-center gap-2">
                <Skeleton className="h-4 w-12 rounded" />
                <Skeleton className="h-4 w-12 rounded" />
                <Skeleton className="h-4 w-12 rounded" />
              </div>
            </div>
          ) : chartData.length === 0 ? (
            <div className="text-center py-20 text-slate-500 text-sm">
              <TrendingDown className="w-8 h-8 mx-auto mb-2 text-slate-400" />
              Tidak ada data pengeluaran ditemukan dalam rentang tanggal ini.
            </div>
          ) : (
            <div className="h-64 sm:h-72 w-full mt-2 select-none">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={chartData}
                  margin={{ top: 10, right: 5, left: -25, bottom: 5 }}
                >
                  <defs>
                    {categoryStats.map((cat, idx) => (
                      <linearGradient
                        key={cat.name}
                        id={`gradient-${idx}`}
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor={cat.color}
                          stopOpacity={0.4}
                        />
                        <stop
                          offset="95%"
                          stopColor={cat.color}
                          stopOpacity={0.01}
                        />
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    className="stroke-slate-100 dark:stroke-slate-800"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="formattedDate"
                    tickLine={false}
                    className="text-[10px] fill-slate-400"
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    className="text-[10px] fill-slate-400"
                    tickFormatter={(val) =>
                      val >= 1000000
                        ? `${(val / 1000000).toFixed(1)}jt`
                        : val >= 1000
                        ? `${(val / 1000).toFixed(0)}rb`
                        : val
                    }
                  />
                  <Tooltip content={<CustomAnalysisTooltip />} />
                  <Legend
                    onClick={handleLegendClick}
                    cursor="pointer"
                    wrapperStyle={{ fontSize: "11px", paddingTop: "15px" }}
                    iconType="circle"
                    iconSize={8}
                  />
                  {categoryStats.map((cat, idx) => (
                    <Area
                      key={cat.name}
                      type="monotone"
                      dataKey={cat.name}
                      stackId="1"
                      stroke={cat.color}
                      strokeWidth={1.5}
                      fillOpacity={1}
                      fill={`url(#gradient-${idx})`}
                      hide={visibleCategories[cat.name] === false}
                    />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Category Breakdown & Toggle Controls */}
      <h2 className="font-semibold text-sm flex items-center gap-1.5 px-1 mt-2">
        <Filter className="w-4 h-4 text-slate-500" /> Detail &amp; Kontrol Filter Kategori
      </h2>
      <Card className="shadow-none">
        <CardContent className="p-4 space-y-3">
          {/* Enable / Disable all categories helper btns */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="text-[11px] h-7 rounded-md"
              onClick={() => toggleAllCategories(true)}
            >
              Centang Semua
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-[11px] h-7 rounded-md"
              onClick={() => toggleAllCategories(false)}
            >
              Matikan Semua
            </Button>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {categoryStats.map((cat) => {
              const Icon = getCategoryIcon(cat.name);
              const isVisible = visibleCategories[cat.name] !== false;
              const percentage = totalSpent > 0 ? (cat.amount / totalSpent) * 100 : 0;
              return (
                <div
                  key={cat.name}
                  className="flex items-center justify-between py-2.5 transition active:bg-slate-50/50 dark:active:bg-slate-900/30 cursor-pointer"
                  onClick={() => toggleCategorySelection(cat.name)}
                >
                  <div className="flex items-center gap-2.5 min-w-0 pr-2">
                    <div
                      className={`flex items-center justify-center w-8 h-8 rounded-lg border transition ${
                        isVisible
                          ? "bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                          : "bg-slate-100 dark:bg-slate-900/20 border-slate-200/50 dark:border-slate-800/40 opacity-40"
                      }`}
                    >
                      <Icon
                        className="w-4 h-4 shrink-0"
                        style={{ color: cat.color ?? "#94a3b8" }}
                      />
                    </div>
                    <div className="min-w-0">
                      <p
                        className={`text-sm font-semibold truncate ${
                          isVisible ? "text-slate-900 dark:text-slate-100" : "text-slate-400 dark:text-slate-600 line-through"
                        }`}
                      >
                        {cat.name}
                      </p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">
                        {percentage.toFixed(1)}% dari total
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p
                      className={`text-sm font-bold ${
                        isVisible ? "text-slate-800 dark:text-slate-200" : "text-slate-400 dark:text-slate-600"
                      }`}
                    >
                      {formatIDR(cat.amount)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="border-t border-slate-100 dark:border-slate-800 pt-3 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Total Pengeluaran</span>
            <span className="text-base font-bold text-brand-600 dark:text-brand-400">
              {formatIDR(totalSpent)}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BarChart3,
  Calendar,
  CalendarClock,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Coins,
  Eye,
  EyeOff,
  Filter,
  Flame,
  Hash,
  Layers,
  PiggyBank,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Sparkles,
  Tag,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
  X,
} from "lucide-react";
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { createClient } from "@/lib/supabase/client";
import { formatIDR } from "@/lib/format";
import { labelMonthKey, shiftPeriod } from "@/lib/period";
import { getCategoryIcon } from "@/components/category-icon";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  DEFAULT_VISIBLE_METRICS,
  METRIC_DEFINITIONS,
  applyExpenseFilters,
  buildCategoryBreakdown,
  buildDimensionSummary,
  buildSmartInsights,
  buildTimeBuckets,
  buildWeekdayStats,
  computeAnalysisKPIs,
  formatCompactIDR,
  formatDateShort,
  parseLocalDate,
  resolveAnalysisWindow,
  resolveGranularity,
  type AnalysisCategory,
  type AnalysisEvent,
  type AnalysisExpense,
  type AnalysisMember,
  type AnalysisRangePreset,
  type BudgetRow,
  type CategorySort,
  type ChartViewMode,
  type CompareTarget,
  type CustomPeriodRange,
  type DetailTab,
  type EventFilterMode,
  type Granularity,
  type IncomeRow,
  type MetricKey,
  type TimeBucket,
  type TrendMetric,
} from "@/lib/analysis";

type AnalysisClientProps = {
  householdId: string;
  payDay: number;
  todayStr: string;
  defaultLabelMonth: string;
  customPeriods: CustomPeriodRange[];
  categories: AnalysisCategory[];
  events: AnalysisEvent[];
  members: AnalysisMember[];
};

const METRICS_STORAGE_KEY = "analysis_visible_metrics_v1";

const PRESET_OPTIONS: { value: AnalysisRangePreset; label: string }[] = [
  { value: "period", label: "Periode Ini" },
  { value: "prev_period", label: "Periode Lalu" },
  { value: "3p", label: "3 Periode" },
  { value: "6p", label: "6 Periode" },
  { value: "7d", label: "7 Hari" },
  { value: "30d", label: "30 Hari" },
  { value: "custom", label: "Kustom" },
];

async function fetchAllExpensesInRange(
  householdId: string,
  fromDate: string,
  toDate: string
): Promise<AnalysisExpense[]> {
  const supabase = createClient();
  const pageSize = 1000;
  let offset = 0;
  const rows: AnalysisExpense[] = [];

  while (true) {
    const { data, error } = await supabase
      .from("expenses")
      .select(
        "id, spent_at, amount, description, note, category_id, event_id, goal_id, created_by, categories(id, name, color)"
      )
      .eq("household_id", householdId)
      .gte("spent_at", fromDate)
      .lte("spent_at", toDate)
      .order("spent_at", { ascending: true })
      .order("id", { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (error || !data) break;
    rows.push(...(data as unknown as AnalysisExpense[]));
    if (data.length < pageSize) break;
    offset += pageSize;
  }

  return rows;
}

function DeltaBadge({
  deltaPct,
  inverse = true,
}: {
  deltaPct: number | null;
  inverse?: boolean;
}) {
  if (deltaPct === null || !Number.isFinite(deltaPct)) return null;
  const rounded = Math.round(deltaPct);
  if (rounded === 0) {
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-mono font-medium bg-muted text-muted-foreground">
        0%
      </span>
    );
  }
  const isUp = rounded > 0;
  const isWarning = inverse ? isUp : !isUp;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-mono font-semibold",
        isWarning
          ? "bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300"
          : "bg-teal-50 text-teal-800 dark:bg-teal-950/50 dark:text-teal-300"
      )}
    >
      {isUp ? (
        <TrendingUp className="w-2.5 h-2.5" />
      ) : (
        <TrendingDown className="w-2.5 h-2.5" />
      )}
      {isUp ? "+" : ""}
      {rounded}%
    </span>
  );
}

type TooltipPayloadItem = {
  name?: string;
  dataKey?: string;
  value?: number;
  color?: string;
  fill?: string;
  payload?: Record<string, unknown>;
};

function TrendChartTooltip({
  active,
  payload,
  trendMetric,
  showCompareOverlay,
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  trendMetric: TrendMetric;
  showCompareOverlay: boolean;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const bucket = payload[0]?.payload as TimeBucket | undefined;
  if (!bucket) return null;

  return (
    <div className="bg-popover border border-border text-popover-foreground p-3 rounded-xl shadow-lg text-xs min-w-[205px] max-w-[260px] space-y-1.5 pointer-events-none">
      <div className="border-b border-border pb-1.5">
        <p className="font-semibold text-foreground">{bucket.rangeLabel}</p>
        <p className="text-[11px] text-muted-foreground">
          {bucket.count} transaksi (klik untuk detail)
        </p>
      </div>

      {trendMetric === "amount" && (
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">Aktual</span>
            <span className="font-mono font-bold text-primary tabular-nums">
              {formatIDR(bucket.amount)}
            </span>
          </div>
          {showCompareOverlay && (
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Periode Lalu</span>
              <span className="font-mono font-medium text-foreground tabular-nums">
                {formatIDR(bucket.prevAmount)}
              </span>
            </div>
          )}
        </div>
      )}

      {trendMetric === "cumulative" && (
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">Kumulatif</span>
            <span className="font-mono font-bold text-primary tabular-nums">
              {formatIDR(bucket.cumulative)}
            </span>
          </div>
          {showCompareOverlay && (
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Periode Lalu</span>
              <span className="font-mono font-medium text-foreground tabular-nums">
                {formatIDR(bucket.prevCumulative)}
              </span>
            </div>
          )}
          {bucket.budgetPace !== null && (
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Target Budget</span>
              <span className="font-mono font-medium text-teal-700 dark:text-teal-300 tabular-nums">
                {formatIDR(bucket.budgetPace)}
              </span>
            </div>
          )}
        </div>
      )}

      {trendMetric === "count" && (
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">Frekuensi</span>
            <span className="font-mono font-bold text-primary tabular-nums">
              {bucket.count} transaksi
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">Nominal</span>
            <span className="font-mono font-medium text-foreground tabular-nums">
              {formatIDR(bucket.amount)}
            </span>
          </div>
        </div>
      )}

      {trendMetric === "top_categories" && (
        <div className="space-y-1">
          {payload
            .filter((p) => Number(p.value) > 0)
            .sort((a, b) => Number(b.value) - Number(a.value))
            .map((item) => (
              <div key={String(item.dataKey)} className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 truncate text-muted-foreground">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: item.fill || item.color || "#B85138" }}
                  />
                  <span className="truncate">{item.name}</span>
                </span>
                <span className="font-mono font-semibold text-foreground shrink-0 tabular-nums">
                  {formatIDR(Number(item.value))}
                </span>
              </div>
            ))}
          <div className="pt-1 border-t border-border flex items-center justify-between gap-2 font-semibold">
            <span>Total</span>
            <span className="font-mono text-primary tabular-nums">{formatIDR(bucket.amount)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function CompareChartTooltip({
  active,
  payload,
  compareTarget,
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  compareTarget: CompareTarget;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0]?.payload as
    | { name: string; aktual: number; pembanding: number; budgetPct: number | null }
    | undefined;
  if (!row) return null;

  const diff = row.aktual - row.pembanding;
  return (
    <div className="bg-popover border border-border text-popover-foreground p-3 rounded-xl shadow-lg text-xs min-w-[200px] space-y-1.5 pointer-events-none">
      <p className="font-semibold text-foreground border-b border-border pb-1">{row.name}</p>
      <div className="flex items-center justify-between gap-3">
        <span className="text-muted-foreground">Aktual</span>
        <span className="font-mono font-bold text-primary tabular-nums">
          {formatIDR(row.aktual)}
        </span>
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-muted-foreground">
          {compareTarget === "budget" ? "Alokasi Budget" : "Periode Lalu"}
        </span>
        <span className="font-mono font-medium text-foreground tabular-nums">
          {formatIDR(row.pembanding)}
        </span>
      </div>
      <div className="flex items-center justify-between gap-3 pt-1 border-t border-border">
        <span className="text-muted-foreground">
          {compareTarget === "budget" ? "Selisih Budget" : "Perubahan"}
        </span>
        <span
          className={cn(
            "font-mono font-semibold tabular-nums",
            diff > 0
              ? "text-rose-700 dark:text-rose-300"
              : "text-teal-700 dark:text-teal-300"
          )}
        >
          {diff > 0 ? "+" : ""}
          {formatIDR(diff)}
        </span>
      </div>
    </div>
  );
}

function WeekdayChartTooltip({
  active,
  payload,
  mode,
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  mode: "avg" | "total";
}) {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0]?.payload as
    | {
        fullLabel: string;
        total: number;
        count: number;
        occurrences: number;
        avgPerOccurrence: number;
      }
    | undefined;
  if (!row) return null;

  return (
    <div className="bg-popover border border-border text-popover-foreground p-3 rounded-xl shadow-lg text-xs min-w-[190px] space-y-1 pointer-events-none">
      <p className="font-semibold text-foreground border-b border-border pb-1">{row.fullLabel}</p>
      <div className="flex items-center justify-between gap-3">
        <span className="text-muted-foreground">
          {mode === "avg" ? "Rata-rata/hari" : "Total"}
        </span>
        <span className="font-mono font-bold text-primary tabular-nums">
          {formatIDR(mode === "avg" ? Math.round(row.avgPerOccurrence) : row.total)}
        </span>
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-muted-foreground">
          {mode === "avg" ? "Total Akumulasi" : "Rata-rata/hari"}
        </span>
        <span className="font-mono text-foreground tabular-nums">
          {formatIDR(mode === "avg" ? row.total : Math.round(row.avgPerOccurrence))}
        </span>
      </div>
      <p className="text-[11px] text-muted-foreground pt-0.5">
        {row.count} transaksi dalam {row.occurrences}x {row.fullLabel.toLowerCase()}
      </p>
    </div>
  );
}

export function AnalysisClient({
  householdId,
  payDay,
  todayStr,
  defaultLabelMonth,
  customPeriods,
  categories,
  events,
  members,
}: AnalysisClientProps) {
  const defaultAnchorDate = useMemo(() => parseLocalDate(defaultLabelMonth), [defaultLabelMonth]);

  // Time Controls
  const [preset, setPreset] = useState<AnalysisRangePreset>("period");
  const [anchorLabelMonth, setAnchorLabelMonth] = useState<Date>(defaultAnchorDate);
  const [customStart, setCustomStart] = useState<string>(() => {
    const d = parseLocalDate(todayStr);
    d.setDate(d.getDate() - 29);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate()
    ).padStart(2, "0")}`;
  });
  const [customEnd, setCustomEnd] = useState<string>(todayStr);

  // Filter Controls
  const [showFiltersPanel, setShowFiltersPanel] = useState(false);
  const [showMetricsPanel, setShowMetricsPanel] = useState(false);
  const [includeSavings, setIncludeSavings] = useState(true);
  const [excludedCategoryIds, setExcludedCategoryIds] = useState<Set<string>>(() => new Set());
  const [eventFilter, setEventFilter] = useState<EventFilterMode>("all");
  const [memberId, setMemberId] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Metric Customization (persisted in localStorage)
  const [visibleMetrics, setVisibleMetrics] = useState<MetricKey[]>(DEFAULT_VISIBLE_METRICS);
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(METRICS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as MetricKey[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          setVisibleMetrics(parsed);
        }
      }
    } catch {
      // Ignore storage error
    }
  }, []);

  function toggleVisibleMetric(key: MetricKey) {
    setVisibleMetrics((prev) => {
      const exists = prev.includes(key);
      if (exists && prev.length === 1) return prev; // Minimal 1 metrik aktif
      const next = exists ? prev.filter((k) => k !== key) : [...prev, key];
      try {
        window.localStorage.setItem(METRICS_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Ignore storage error
      }
      return next;
    });
  }

  function resetDefaultMetrics() {
    setVisibleMetrics(DEFAULT_VISIBLE_METRICS);
    try {
      window.localStorage.setItem(METRICS_STORAGE_KEY, JSON.stringify(DEFAULT_VISIBLE_METRICS));
    } catch {
      // Ignore storage error
    }
  }

  // Visualization Controls
  const [chartView, setChartView] = useState<ChartViewMode>("trend");
  const [trendMetric, setTrendMetric] = useState<TrendMetric>("amount");
  const [granularity, setGranularity] = useState<Granularity>("auto");
  const [showCompareOverlay, setShowCompareOverlay] = useState<boolean>(true);
  const [showBudgetPace, setShowBudgetPace] = useState<boolean>(true);
  const [compareTarget, setCompareTarget] = useState<CompareTarget>("budget");
  const [showAllCompareCats, setShowAllCompareCats] = useState<boolean>(false);
  const [weekdayMode, setWeekdayMode] = useState<"avg" | "total">("avg");
  const [selectedBucketKey, setSelectedBucketKey] = useState<string | null>(null);

  // Detail Panel Controls
  const [detailTab, setDetailTab] = useState<DetailTab>("categories");
  const [categorySort, setCategorySort] = useState<CategorySort>("amount");
  const [expandedCategoryId, setExpandedCategoryId] = useState<string | null>(null);
  const [txSort, setTxSort] = useState<"amount" | "date">("amount");
  const [txLimit, setTxLimit] = useState<number>(15);

  // Fetched Raw Data
  const [rawActiveExpenses, setRawActiveExpenses] = useState<AnalysisExpense[]>([]);
  const [rawCompExpenses, setRawCompExpenses] = useState<AnalysisExpense[]>([]);
  const [budgets, setBudgets] = useState<BudgetRow[]>([]);
  const [incomes, setIncomes] = useState<IncomeRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Resolve Active Window & Comparison Window
  const windowInfo = useMemo(
    () =>
      resolveAnalysisWindow({
        preset,
        anchorLabelMonth,
        customStart,
        customEnd,
        payDay,
        customPeriods,
        todayStr,
      }),
    [preset, anchorLabelMonth, customStart, customEnd, payDay, customPeriods, todayStr]
  );

  const activeMonthsKey = windowInfo.activeLabelMonths.join(",");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!householdId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setSelectedBucketKey(null);
      setExpandedCategoryId(null);
      setTxLimit(15);

      const minFetchDate =
        windowInfo.compStartDate <= windowInfo.startDate
          ? windowInfo.compStartDate
          : windowInfo.startDate;
      const maxFetchDate =
        windowInfo.endDate >= windowInfo.compEndDate ? windowInfo.endDate : windowInfo.compEndDate;

      const supabase = createClient();

      const [allExpenses, budgetRes, incomeRes] = await Promise.all([
        fetchAllExpensesInRange(householdId, minFetchDate, maxFetchDate),
        windowInfo.isPeriodBased && windowInfo.activeLabelMonths.length > 0
          ? supabase
              .from("budgets")
              .select("category_id, month, amount")
              .eq("household_id", householdId)
              .in("month", windowInfo.activeLabelMonths)
          : Promise.resolve({ data: [] as BudgetRow[] }),
        windowInfo.isPeriodBased && windowInfo.activeLabelMonths.length > 0
          ? supabase
              .from("incomes")
              .select("month, amount")
              .eq("household_id", householdId)
              .in("month", windowInfo.activeLabelMonths)
          : Promise.resolve({ data: [] as IncomeRow[] }),
      ]);

      if (cancelled) return;

      const activeList: AnalysisExpense[] = [];
      const compList: AnalysisExpense[] = [];
      for (const exp of allExpenses) {
        if (exp.spent_at >= windowInfo.startDate && exp.spent_at <= windowInfo.endDate) {
          activeList.push(exp);
        }
        if (exp.spent_at >= windowInfo.compStartDate && exp.spent_at <= windowInfo.compEndDate) {
          compList.push(exp);
        }
      }

      setRawActiveExpenses(activeList);
      setRawCompExpenses(compList);
      setBudgets((budgetRes.data ?? []) as BudgetRow[]);
      setIncomes((incomeRes.data ?? []) as IncomeRow[]);
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [
    householdId,
    windowInfo.startDate,
    windowInfo.endDate,
    windowInfo.compStartDate,
    windowInfo.compEndDate,
    windowInfo.isPeriodBased,
    activeMonthsKey,
  ]);

  const filterState = useMemo(
    () => ({
      excludedCategoryIds,
      includeSavings,
      eventFilter,
      memberId,
      searchQuery,
    }),
    [excludedCategoryIds, includeSavings, eventFilter, memberId, searchQuery]
  );

  // Filtered datasets
  const nonCatFilteredActive = useMemo(
    () => applyExpenseFilters(rawActiveExpenses, filterState, { ignoreCategoryExclusion: true }),
    [rawActiveExpenses, filterState]
  );
  const nonCatFilteredComp = useMemo(
    () => applyExpenseFilters(rawCompExpenses, filterState, { ignoreCategoryExclusion: true }),
    [rawCompExpenses, filterState]
  );
  const filteredExpenses = useMemo(
    () => applyExpenseFilters(rawActiveExpenses, filterState),
    [rawActiveExpenses, filterState]
  );
  const filteredCompExpenses = useMemo(
    () => applyExpenseFilters(rawCompExpenses, filterState),
    [rawCompExpenses, filterState]
  );

  const categoryBreakdownResult = useMemo(
    () =>
      buildCategoryBreakdown({
        categories,
        nonCatFilteredActive,
        nonCatFilteredComp,
        budgets,
        isPeriodBased: windowInfo.isPeriodBased,
        filters: filterState,
      }),
    [
      categories,
      nonCatFilteredActive,
      nonCatFilteredComp,
      budgets,
      windowInfo.isPeriodBased,
      filterState,
    ]
  );

  const categoryRows = categoryBreakdownResult.rows;

  const kpis = useMemo(
    () =>
      computeAnalysisKPIs({
        window: windowInfo,
        filteredExpenses,
        filteredCompExpenses,
        categoryRows,
        incomes,
      }),
    [windowInfo, filteredExpenses, filteredCompExpenses, categoryRows, incomes]
  );

  const weekdayStats = useMemo(
    () => buildWeekdayStats(filteredExpenses, windowInfo.startDate, windowInfo.endDate),
    [filteredExpenses, windowInfo.startDate, windowInfo.endDate]
  );

  const smartInsights = useMemo(
    () =>
      buildSmartInsights({
        window: windowInfo,
        kpis,
        categoryRows,
        weekdayAvgPerDay: weekdayStats.weekdayAvgPerDay,
        weekendAvgPerDay: weekdayStats.weekendAvgPerDay,
        formatIDR,
      }),
    [windowInfo, kpis, categoryRows, weekdayStats.weekdayAvgPerDay, weekdayStats.weekendAvgPerDay]
  );

  const dimensionSummary = useMemo(
    () =>
      buildDimensionSummary({
        filteredExpenses,
        events,
        members,
      }),
    [filteredExpenses, events, members]
  );

  const resolvedGran = useMemo(
    () => resolveGranularity(granularity, windowInfo.totalDays),
    [granularity, windowInfo.totalDays]
  );

  const topStackedCategories = useMemo(() => {
    return categoryRows
      .filter((r) => r.isSelected && r.amount > 0)
      .slice()
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 4);
  }, [categoryRows]);

  const timeBuckets = useMemo(
    () =>
      buildTimeBuckets({
        startDate: windowInfo.startDate,
        endDate: windowInfo.endDate,
        compStartDate: windowInfo.compStartDate,
        compEndDate: windowInfo.compEndDate,
        granularity: resolvedGran,
        activeExpenses: filteredExpenses,
        compExpenses: filteredCompExpenses,
        topCategoryNames: topStackedCategories.map((c) => c.name),
        totalBudget: kpis.budgetTotal > 0 ? kpis.budgetTotal : null,
      }),
    [
      windowInfo.startDate,
      windowInfo.endDate,
      windowInfo.compStartDate,
      windowInfo.compEndDate,
      resolvedGran,
      filteredExpenses,
      filteredCompExpenses,
      topStackedCategories,
      kpis.budgetTotal,
    ]
  );

  const hasOtherStacked = useMemo(
    () => timeBuckets.some((b) => Number(b["Lainnya"] ?? 0) > 0),
    [timeBuckets]
  );

  const averageBucketAmount = useMemo(() => {
    if (timeBuckets.length === 0) return 0;
    const sum = timeBuckets.reduce((s, b) => s + b.amount, 0);
    return sum / timeBuckets.length;
  }, [timeBuckets]);

  const selectedBucket = useMemo(
    () => timeBuckets.find((b) => b.key === selectedBucketKey) ?? null,
    [timeBuckets, selectedBucketKey]
  );

  // Compare Mode auto-fallback if not period based or budget == 0
  const effectiveCompareTarget: CompareTarget =
    compareTarget === "budget" && (!windowInfo.isPeriodBased || kpis.budgetTotal <= 0)
      ? "previous"
      : compareTarget;

  const compareChartRows = useMemo(() => {
    const selected = categoryRows
      .filter((r) => r.isSelected)
      .filter((r) =>
        effectiveCompareTarget === "budget"
          ? r.budget > 0 || r.amount > 0
          : r.amount > 0 || r.prevAmount > 0
      )
      .map((r) => ({
        categoryId: r.categoryId,
        name: r.name,
        color: r.color,
        aktual: r.amount,
        pembanding: effectiveCompareTarget === "budget" ? r.budget : r.prevAmount,
        budgetPct: r.budgetUsagePct,
      }));
    return showAllCompareCats ? selected : selected.slice(0, 8);
  }, [categoryRows, effectiveCompareTarget, showAllCompareCats]);

  const totalCompareSelectableCount = useMemo(
    () =>
      categoryRows
        .filter((r) => r.isSelected)
        .filter((r) =>
          effectiveCompareTarget === "budget"
            ? r.budget > 0 || r.amount > 0
            : r.amount > 0 || r.prevAmount > 0
        ).length,
    [categoryRows, effectiveCompareTarget]
  );

  // Sorted category rows for Detail Tab
  const sortedCategoryRows = useMemo(() => {
    const copy = [...categoryRows];
    if (categorySort === "amount") {
      copy.sort((a, b) => Number(b.isSelected) - Number(a.isSelected) || b.amount - a.amount);
    } else if (categorySort === "delta_up") {
      copy.sort(
        (a, b) =>
          Number(b.isSelected) - Number(a.isSelected) || b.deltaAmount - a.deltaAmount
      );
    } else if (categorySort === "budget_pct") {
      copy.sort(
        (a, b) =>
          Number(b.isSelected) - Number(a.isSelected) ||
          (b.budgetUsagePct ?? -1) - (a.budgetUsagePct ?? -1) ||
          b.amount - a.amount
      );
    } else if (categorySort === "count") {
      copy.sort((a, b) => Number(b.isSelected) - Number(a.isSelected) || b.count - a.count);
    }
    return copy;
  }, [categoryRows, categorySort]);

  // Sorted transactions for Detail Tab
  const sortedTransactions = useMemo(() => {
    const copy = [...filteredExpenses];
    if (txSort === "amount") {
      copy.sort((a, b) => Number(b.amount) - Number(a.amount));
    } else {
      copy.sort((a, b) => b.spent_at.localeCompare(a.spent_at));
    }
    return copy;
  }, [filteredExpenses, txSort]);

  const eventMap = useMemo(() => new Map(events.map((ev) => [ev.id, ev])), [events]);
  const memberLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    members.forEach((m, idx) => {
      map.set(m.user_id, m.display_name?.trim() || `Anggota ${idx + 1}`);
    });
    return map;
  }, [members]);

  // Filter helpers
  function toggleCategoryExcluded(categoryId: string) {
    setExcludedCategoryIds((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) next.delete(categoryId);
      else next.add(categoryId);
      return next;
    });
  }

  function focusSingleCategory(categoryId: string) {
    const next = new Set<string>();
    for (const row of categoryRows) {
      if (row.categoryId !== categoryId) {
        next.add(row.categoryId);
      }
    }
    setExcludedCategoryIds(next);
  }

  function clearAllFilters() {
    setIncludeSavings(true);
    setExcludedCategoryIds(new Set());
    setEventFilter("all");
    setMemberId("all");
    setSearchQuery("");
  }

  const activeFilterCount =
    (!includeSavings ? 1 : 0) +
    (excludedCategoryIds.size > 0 ? 1 : 0) +
    (eventFilter !== "all" ? 1 : 0) +
    (memberId !== "all" ? 1 : 0) +
    (searchQuery.trim() ? 1 : 0);

  const isPeriodArrowVisible = preset === "period" || preset === "prev_period";
  const isAnchorDefault = labelMonthKey(anchorLabelMonth) === defaultLabelMonth;

  const activeMetricsList = METRIC_DEFINITIONS.filter((m) => visibleMetrics.includes(m.key));

  return (
    <div className="space-y-4 pb-16">
      {/* A. Control Dock: Rentang Waktu & Filter Seamless */}
      <section className="bg-card border border-border rounded-2xl p-4 shadow-sm space-y-3">
        {/* Top Row: Back + Active Window + Period Shift */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <Link
              href="/"
              aria-label="Kembali ke Beranda"
              className="w-10 h-10 bg-background border border-border rounded-xl flex items-center justify-center hover:bg-muted transition-colors shrink-0"
            >
              <ArrowLeft className="w-4 h-4 text-foreground" />
            </Link>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h2 className="text-sm font-semibold text-foreground truncate">
                  {windowInfo.label}
                </h2>
                {windowInfo.isOngoing && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-accent text-accent-foreground">
                    Hari {windowInfo.elapsedDays}/{windowInfo.totalDays}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground truncate mt-0.5">
                {windowInfo.subtitleLabel}
              </p>
            </div>
          </div>

          {isPeriodArrowVisible && (
            <div className="flex items-center gap-1 shrink-0">
              {!isAnchorDefault && (
                <button
                  type="button"
                  onClick={() => setAnchorLabelMonth(defaultAnchorDate)}
                  className="px-2.5 min-h-[36px] rounded-xl text-[11px] font-medium bg-accent text-accent-foreground hover:bg-accent/80 transition-colors"
                >
                  Saat Ini
                </button>
              )}
              <button
                type="button"
                aria-label="Periode sebelumnya"
                onClick={() => setAnchorLabelMonth((prev) => shiftPeriod(prev, -1))}
                className="w-9 h-9 rounded-xl border border-border bg-background hover:bg-muted flex items-center justify-center transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                aria-label="Periode berikutnya"
                onClick={() => setAnchorLabelMonth((prev) => shiftPeriod(prev, 1))}
                className="w-9 h-9 rounded-xl border border-border bg-background hover:bg-muted flex items-center justify-center transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Time Presets */}
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
          {PRESET_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setPreset(opt.value)}
              className={cn(
                "px-3.5 min-h-[36px] py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all border shrink-0",
                preset === opt.value
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "bg-secondary text-secondary-foreground border-border hover:bg-muted"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Custom Range Date Pickers */}
        {preset === "custom" && (
          <div className="pt-2 border-t border-border grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">
                Dari Tanggal
              </label>
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="w-full min-h-[42px] bg-background border border-input rounded-xl px-3 py-2 text-base sm:text-xs font-mono text-foreground"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">
                Sampai Tanggal
              </label>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="w-full min-h-[42px] bg-background border border-input rounded-xl px-3 py-2 text-base sm:text-xs font-mono text-foreground"
              />
            </div>
          </div>
        )}

        {/* Quick Action Toggles */}
        <div className="pt-2 border-t border-border flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setShowFiltersPanel((v) => !v)}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 min-h-[36px] rounded-xl text-xs font-medium border transition-colors",
              showFiltersPanel || activeFilterCount > 0
                ? "bg-accent text-accent-foreground border-brand-300 dark:border-brand-700"
                : "bg-background text-foreground border-border hover:bg-muted"
            )}
          >
            <Filter className="w-3.5 h-3.5" />
            Filter
            {activeFilterCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-primary text-primary-foreground text-[10px] font-mono">
                {activeFilterCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setIncludeSavings((v) => !v)}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 min-h-[36px] rounded-xl text-xs font-medium border transition-colors",
              !includeSavings
                ? "bg-accent text-accent-foreground border-brand-300 dark:border-brand-700"
                : "bg-background text-muted-foreground border-border hover:bg-muted hover:text-foreground"
            )}
            title="Pisahkan transaksi Nabung agar fokus ke konsumsi murni"
          >
            <PiggyBank className="w-3.5 h-3.5" />
            {includeSavings ? "Termasuk Nabung" : "Tanpa Nabung"}
          </button>

          <button
            type="button"
            onClick={() => setShowMetricsPanel((v) => !v)}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 min-h-[36px] rounded-xl text-xs font-medium border transition-colors ml-auto",
              showMetricsPanel
                ? "bg-accent text-accent-foreground border-brand-300 dark:border-brand-700"
                : "bg-background text-muted-foreground border-border hover:bg-muted hover:text-foreground"
            )}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            Metrik ({visibleMetrics.length})
          </button>
        </div>

        {/* Expandable Metric Customizer */}
        {showMetricsPanel && (
          <div className="pt-3 border-t border-border space-y-2.5 animate-slide-up">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-foreground">
                  Pilih Indikator Metrik (KPI)
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Tersimpan otomatis di perangkat ini
                </p>
              </div>
              <button
                type="button"
                onClick={resetDefaultMetrics}
                className="text-xs font-medium text-primary hover:underline flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" /> Reset Standar
              </button>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {METRIC_DEFINITIONS.map((m) => {
                const active = visibleMetrics.includes(m.key);
                return (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => toggleVisibleMetric(m.key)}
                    className={cn(
                      "text-left px-2.5 py-2 rounded-xl border transition-colors",
                      active
                        ? "bg-accent border-primary/50 text-accent-foreground"
                        : "bg-background border-border text-muted-foreground hover:bg-muted"
                    )}
                  >
                    <p className="text-xs font-semibold truncate">{m.label}</p>
                    <p className="text-[10px] opacity-80 truncate mt-0.5">{m.shortDesc}</p>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Expandable Full Filter Panel */}
        {showFiltersPanel && (
          <div className="pt-3 border-t border-border space-y-3 animate-slide-up">
            {/* Search Box */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari item, mis. kopi, listrik, grab..."
                className="w-full min-h-[42px] bg-background border border-input rounded-xl pl-9 pr-9 py-2 text-base sm:text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              {searchQuery && (
                <button
                  type="button"
                  aria-label="Hapus pencarian"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full hover:bg-muted flex items-center justify-center text-muted-foreground"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Event & Member Selectors */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                  Cakupan Event
                </label>
                <select
                  value={eventFilter}
                  onChange={(e) => setEventFilter(e.target.value)}
                  className="w-full min-h-[40px] bg-background border border-input rounded-xl px-3 py-1.5 text-base sm:text-xs text-foreground"
                >
                  <option value="all">Semua (Reguler + Event)</option>
                  <option value="regular">Belanja Reguler Saja</option>
                  <option value="events_only">Khusus Event Saja</option>
                  {events.map((ev) => (
                    <option key={ev.id} value={ev.id}>
                      Event: {ev.name}
                    </option>
                  ))}
                </select>
              </div>

              {(members.length > 1 || dimensionSummary.members.length > 1) && (
                <div>
                  <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                    Pencatat / Anggota
                  </label>
                  <select
                    value={memberId}
                    onChange={(e) => setMemberId(e.target.value)}
                    className="w-full min-h-[40px] bg-background border border-input rounded-xl px-3 py-1.5 text-base sm:text-xs text-foreground"
                  >
                    <option value="all">Semua Anggota</option>
                    {members.map((m, idx) => (
                      <option key={m.user_id} value={m.user_id}>
                        {m.display_name?.trim() || `Anggota ${idx + 1}`}
                      </option>
                    ))}
                    {dimensionSummary.members.some((m) => m.userId === "unknown") && (
                      <option value="unknown">Tidak tercatat</option>
                    )}
                  </select>
                </div>
              )}
            </div>

            {/* Category Multi-Select Chips */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-muted-foreground">
                  Kategori Aktif ({categoryRows.filter((r) => r.isSelected).length}/
                  {categoryRows.length})
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setExcludedCategoryIds(new Set())}
                    className="text-[11px] font-medium text-primary hover:underline"
                  >
                    Pilih Semua
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setExcludedCategoryIds(new Set(categoryRows.map((c) => c.categoryId)))
                    }
                    className="text-[11px] font-medium text-muted-foreground hover:text-foreground"
                  >
                    Kosongkan
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {categoryRows.map((cat) => (
                  <button
                    key={cat.categoryId}
                    type="button"
                    onClick={() => toggleCategoryExcluded(cat.categoryId)}
                    className={cn(
                      "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium border transition-all",
                      cat.isSelected
                        ? "bg-card text-foreground border-border shadow-sm"
                        : "bg-muted/50 text-muted-foreground border-transparent opacity-55 line-through"
                    )}
                  >
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: cat.color }}
                    />
                    {cat.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Active Filter Chips Bar */}
        {activeFilterCount > 0 && (
          <div className="pt-2 border-t border-border flex items-center gap-1.5 flex-wrap">
            {!includeSavings && (
              <button
                type="button"
                onClick={() => setIncludeSavings(true)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-accent text-accent-foreground"
              >
                Tanpa Nabung <X className="w-3 h-3" />
              </button>
            )}
            {excludedCategoryIds.size > 0 && (
              <button
                type="button"
                onClick={() => setExcludedCategoryIds(new Set())}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-accent text-accent-foreground"
              >
                {excludedCategoryIds.size} kategori disembunyikan <X className="w-3 h-3" />
              </button>
            )}
            {eventFilter !== "all" && (
              <button
                type="button"
                onClick={() => setEventFilter("all")}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-accent text-accent-foreground"
              >
                {eventFilter === "regular"
                  ? "Reguler Saja"
                  : eventFilter === "events_only"
                    ? "Khusus Event"
                    : `Event: ${eventMap.get(eventFilter)?.name ?? "Terpilih"}`}
                <X className="w-3 h-3" />
              </button>
            )}
            {memberId !== "all" && (
              <button
                type="button"
                onClick={() => setMemberId("all")}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-accent text-accent-foreground"
              >
                Anggota: {memberId === "unknown" ? "Tidak tercatat" : memberLabelMap.get(memberId)}
                <X className="w-3 h-3" />
              </button>
            )}
            {searchQuery.trim() && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-accent text-accent-foreground"
              >
                &quot;{searchQuery.trim()}&quot; <X className="w-3 h-3" />
              </button>
            )}
            <button
              type="button"
              onClick={clearAllFilters}
              className="text-[11px] font-semibold text-primary hover:underline ml-auto px-1"
            >
              Reset Semua
            </button>
          </div>
        )}
      </section>

      {/* B. Smart Insight Summary Strip */}
      {!loading && smartInsights.length > 0 && (
        <section className="bg-accent/65 border border-brand-200/80 dark:border-brand-800/40 rounded-2xl p-3.5 space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold text-accent-foreground flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-primary" /> Ringkasan Dinamis
            </span>
            <span className="text-[10px] text-muted-foreground">
              vs {windowInfo.compLabel}
            </span>
          </div>
          <div className="space-y-1">
            {smartInsights.map((ins) => (
              <p key={ins.id} className="text-xs text-foreground leading-relaxed flex items-start gap-2">
                <span
                  className={cn(
                    "w-1.5 h-1.5 rounded-full shrink-0 mt-1.5",
                    ins.tone === "positive"
                      ? "bg-teal-600 dark:bg-teal-400"
                      : ins.tone === "warning"
                        ? "bg-rose-600 dark:bg-rose-400"
                        : "bg-primary"
                  )}
                />
                <span>{ins.text}</span>
              </p>
            ))}
          </div>
        </section>
      )}

      {/* C. Customizable KPI Grid */}
      {loading ? (
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: Math.min(4, visibleMetrics.length) }).map((_, i) => (
            <div
              key={i}
              className="bg-card border border-border rounded-2xl p-4 min-h-[116px] space-y-3"
            >
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-6 w-28" />
              <Skeleton className="h-3 w-20" />
            </div>
          ))}
        </div>
      ) : (
        <section className="grid grid-cols-2 gap-3">
          {activeMetricsList.map((m) => {
            if (m.key === "total") {
              return (
                <div
                  key={m.key}
                  className="bg-accent/70 border border-brand-200 dark:border-brand-800/40 rounded-2xl p-3.5 flex flex-col justify-between min-h-[118px] shadow-sm"
                >
                  <div className="flex items-center justify-between gap-1 text-accent-foreground">
                    <span className="text-xs font-medium truncate">Total Belanja</span>
                    <Wallet className="w-4 h-4 text-primary shrink-0" />
                  </div>
                  <div className="space-y-1 mt-1">
                    <p className="font-mono text-base sm:text-lg font-bold text-foreground truncate tabular-nums">
                      {formatIDR(kpis.total)}
                    </p>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <DeltaBadge deltaPct={kpis.deltaPct} />
                      <span className="text-[11px] text-muted-foreground truncate">
                        {kpis.projectedTotal !== null
                          ? `Proyeksi ~${formatCompactIDR(kpis.projectedTotal)}`
                          : `${windowInfo.totalDays} hari`}
                      </span>
                    </div>
                  </div>
                </div>
              );
            }

            if (m.key === "daily_avg") {
              const dailyDelta =
                kpis.compDailyAvg > 0
                  ? ((kpis.dailyAvg - kpis.compDailyAvg) / kpis.compDailyAvg) * 100
                  : null;
              return (
                <div
                  key={m.key}
                  className="bg-card border border-border rounded-2xl p-3.5 flex flex-col justify-between min-h-[118px] shadow-sm"
                >
                  <div className="flex items-center justify-between gap-1 text-muted-foreground">
                    <span className="text-xs font-medium truncate">Rata-rata Harian</span>
                    <CalendarClock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                  </div>
                  <div className="space-y-1 mt-1">
                    <div className="flex items-baseline gap-1">
                      <span className="font-mono text-base sm:text-lg font-bold text-foreground truncate tabular-nums">
                        {formatIDR(Math.round(kpis.dailyAvg))}
                      </span>
                      <span className="text-[11px] text-muted-foreground shrink-0">/hr</span>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <DeltaBadge deltaPct={dailyDelta} />
                      <span className="text-[11px] text-muted-foreground truncate">
                        {kpis.activeDaysCount} hr aktif ({formatCompactIDR(kpis.activeDayAvg)}/hr)
                      </span>
                    </div>
                  </div>
                </div>
              );
            }

            if (m.key === "budget_usage") {
              const hasBudget = windowInfo.isPeriodBased && kpis.budgetTotal > 0;
              const pct = kpis.budgetUsagePct ?? 0;
              const isOver = pct > 100;
              const isWarn = pct > 80 && pct <= 100;
              return (
                <div
                  key={m.key}
                  className="bg-card border border-border rounded-2xl p-3.5 flex flex-col justify-between min-h-[118px] shadow-sm"
                >
                  <div className="flex items-center justify-between gap-1 text-muted-foreground">
                    <span className="text-xs font-medium truncate">Serapan Budget</span>
                    <Layers className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0" />
                  </div>
                  {hasBudget ? (
                    <div className="space-y-1.5 mt-1">
                      <div className="flex items-baseline justify-between gap-1">
                        <span
                          className={cn(
                            "font-mono text-lg font-bold tabular-nums",
                            isOver
                              ? "text-rose-700 dark:text-rose-300"
                              : isWarn
                                ? "text-amber-700 dark:text-amber-300"
                                : "text-teal-700 dark:text-teal-300"
                          )}
                        >
                          {pct.toFixed(0)}%
                        </span>
                        <span className="text-[11px] font-mono text-muted-foreground truncate tabular-nums">
                          / {formatCompactIDR(kpis.budgetTotal)}
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all",
                            isOver
                              ? "bg-rose-600 dark:bg-rose-400"
                              : isWarn
                                ? "bg-amber-600 dark:bg-amber-400"
                                : "bg-teal-600 dark:bg-teal-400"
                          )}
                          style={{ width: `${Math.min(100, pct)}%` }}
                        />
                      </div>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {(kpis.budgetRemaining ?? 0) >= 0
                          ? `Sisa ${formatCompactIDR(kpis.budgetRemaining ?? 0)}`
                          : `Lebih ${formatCompactIDR(Math.abs(kpis.budgetRemaining ?? 0))}`}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-1 mt-1">
                      <p className="text-xs font-medium text-muted-foreground">
                        {windowInfo.isPeriodBased
                          ? "Budget periode belum diatur"
                          : "Aktif di mode Periode"}
                      </p>
                      {!windowInfo.isPeriodBased && (
                        <button
                          type="button"
                          onClick={() => setPreset("period")}
                          className="text-[11px] font-semibold text-primary hover:underline"
                        >
                          Lihat Periode Ini
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            }

            if (m.key === "tx_stats") {
              const countDelta =
                kpis.compTxCount > 0
                  ? ((kpis.txCount - kpis.compTxCount) / kpis.compTxCount) * 100
                  : null;
              return (
                <div
                  key={m.key}
                  className="bg-card border border-border rounded-2xl p-3.5 flex flex-col justify-between min-h-[118px] shadow-sm"
                >
                  <div className="flex items-center justify-between gap-1 text-muted-foreground">
                    <span className="text-xs font-medium truncate">Frekuensi &amp; Rata2</span>
                    <Hash className="w-4 h-4 text-primary shrink-0" />
                  </div>
                  <div className="space-y-1 mt-1">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-lg font-bold text-foreground tabular-nums">
                        {kpis.txCount}x
                      </span>
                      <DeltaBadge deltaPct={countDelta} />
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate">
                      Rata2 {formatIDR(Math.round(kpis.avgPerTx))}/item
                    </p>
                  </div>
                </div>
              );
            }

            if (m.key === "median_max") {
              return (
                <div
                  key={m.key}
                  className="bg-card border border-border rounded-2xl p-3.5 flex flex-col justify-between min-h-[118px] shadow-sm"
                >
                  <div className="flex items-center justify-between gap-1 text-muted-foreground">
                    <span className="text-xs font-medium truncate">Median &amp; Terbesar</span>
                    <Coins className="w-4 h-4 text-primary shrink-0" />
                  </div>
                  <div className="space-y-1 mt-1 min-w-0">
                    <p className="font-mono text-base font-bold text-foreground truncate tabular-nums">
                      {formatIDR(Math.round(kpis.medianTx))}
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {kpis.maxTx
                        ? `Max: ${kpis.maxTx.description} (${formatCompactIDR(kpis.maxTx.amount)})`
                        : "Belum ada transaksi"}
                    </p>
                  </div>
                </div>
              );
            }

            if (m.key === "income_ratio") {
              const hasIncome = windowInfo.isPeriodBased && kpis.incomeTotal > 0;
              return (
                <div
                  key={m.key}
                  className="bg-card border border-border rounded-2xl p-3.5 flex flex-col justify-between min-h-[118px] shadow-sm"
                >
                  <div className="flex items-center justify-between gap-1 text-muted-foreground">
                    <span className="text-xs font-medium truncate">Rasio Pemasukan</span>
                    <Wallet className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0" />
                  </div>
                  {hasIncome ? (
                    <div className="space-y-1 mt-1">
                      <p className="font-mono text-lg font-bold text-foreground tabular-nums">
                        {(kpis.incomeRatioPct ?? 0).toFixed(0)}%
                      </p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {(kpis.netCashflow ?? 0) >= 0
                          ? `Surplus ${formatCompactIDR(kpis.netCashflow ?? 0)}`
                          : `Defisit ${formatCompactIDR(Math.abs(kpis.netCashflow ?? 0))}`}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-1 mt-1">
                      <p className="text-xs text-muted-foreground">
                        {windowInfo.isPeriodBased
                          ? "Pemasukan belum diisi"
                          : "Aktif di mode Periode"}
                      </p>
                    </div>
                  )}
                </div>
              );
            }

            if (m.key === "peak_day") {
              return (
                <div
                  key={m.key}
                  className="bg-card border border-border rounded-2xl p-3.5 flex flex-col justify-between min-h-[118px] shadow-sm"
                >
                  <div className="flex items-center justify-between gap-1 text-muted-foreground">
                    <span className="text-xs font-medium truncate">Hari Puncak</span>
                    <Flame className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                  </div>
                  {kpis.peakDay ? (
                    <div className="space-y-1 mt-1">
                      <p className="font-mono text-base font-bold text-foreground truncate tabular-nums">
                        {formatIDR(kpis.peakDay.amount)}
                      </p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {formatDateShort(kpis.peakDay.date)} ({kpis.peakDay.count} item)
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground mt-1">Belum ada data</p>
                  )}
                </div>
              );
            }

            // top_category
            return (
              <div
                key={m.key}
                className="bg-card border border-border rounded-2xl p-3.5 flex flex-col justify-between min-h-[118px] shadow-sm"
              >
                <div className="flex items-center justify-between gap-1 text-muted-foreground">
                  <span className="text-xs font-medium truncate">Kategori Terbesar</span>
                  <Tag className="w-4 h-4 text-primary shrink-0" />
                </div>
                {kpis.topCategory ? (
                  <div className="space-y-1 mt-1 min-w-0">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: kpis.topCategory.color }}
                      />
                      <span className="text-xs font-semibold text-foreground truncate">
                        {kpis.topCategory.name}
                      </span>
                    </div>
                    <p className="font-mono text-sm font-bold text-foreground truncate tabular-nums">
                      {formatIDR(kpis.topCategory.amount)}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {kpis.topCategory.sharePct.toFixed(0)}% dari total
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground mt-1">Belum ada data</p>
                )}
              </div>
            );
          })}
        </section>
      )}

      {/* D. Main Interactive Visualization Card */}
      <section className="bg-card border border-border rounded-2xl p-4 shadow-sm space-y-3">
        {/* View Mode Switcher */}
        <div className="grid grid-cols-3 gap-1 p-1 bg-muted rounded-xl">
          {[
            { id: "trend" as const, label: "Tren Waktu" },
            { id: "compare" as const, label: "Bandingkan" },
            { id: "weekday" as const, label: "Pola Hari" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setChartView(tab.id);
                setSelectedBucketKey(null);
              }}
              className={cn(
                "min-h-[36px] rounded-lg text-xs font-semibold transition-all",
                chartView === tab.id
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Sub-controls for Trend Mode */}
        {chartView === "trend" && (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex gap-1 overflow-x-auto no-scrollbar">
                {[
                  { id: "amount" as const, label: "Nominal" },
                  { id: "cumulative" as const, label: "Kumulatif" },
                  { id: "top_categories" as const, label: "Top Kategori" },
                  { id: "count" as const, label: "Transaksi" },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setTrendMetric(opt.id)}
                    className={cn(
                      "px-2.5 py-1 rounded-lg text-[11px] font-medium whitespace-nowrap border transition-colors",
                      trendMetric === opt.id
                        ? "bg-accent text-accent-foreground border-primary/40"
                        : "bg-background text-muted-foreground border-border hover:text-foreground"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 flex-wrap">
              {/* Granularity pills */}
              <div className="flex items-center gap-1">
                <span className="text-[11px] text-muted-foreground mr-0.5">Skala:</span>
                {[
                  { id: "auto" as const, label: "Auto" },
                  { id: "day" as const, label: "Hari" },
                  { id: "week" as const, label: "Minggu" },
                  { id: "month" as const, label: "Bulan" },
                ].map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => {
                      setGranularity(g.id);
                      setSelectedBucketKey(null);
                    }}
                    className={cn(
                      "px-2 py-0.5 rounded-md text-[11px] font-medium transition-colors",
                      granularity === g.id
                        ? "bg-foreground text-background"
                        : "bg-muted text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {g.label}
                  </button>
                ))}
              </div>

              {/* Comparison & Budget pace toggles */}
              <div className="flex items-center gap-1.5">
                {trendMetric !== "top_categories" && (
                  <button
                    type="button"
                    onClick={() => setShowCompareOverlay((v) => !v)}
                    className={cn(
                      "px-2 py-0.5 rounded-md text-[11px] font-medium border transition-colors",
                      showCompareOverlay
                        ? "bg-accent text-accent-foreground border-primary/40"
                        : "bg-background text-muted-foreground border-border"
                    )}
                  >
                    vs Periode Lalu
                  </button>
                )}
                {trendMetric === "cumulative" && kpis.budgetTotal > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowBudgetPace((v) => !v)}
                    className={cn(
                      "px-2 py-0.5 rounded-md text-[11px] font-medium border transition-colors",
                      showBudgetPace
                        ? "bg-teal-50 text-teal-800 border-teal-300 dark:bg-teal-950/50 dark:text-teal-300 dark:border-teal-800"
                        : "bg-background text-muted-foreground border-border"
                    )}
                  >
                    Garis Budget
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Sub-controls for Compare Mode */}
        {chartView === "compare" && (
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex gap-1.5">
              <button
                type="button"
                disabled={!windowInfo.isPeriodBased || kpis.budgetTotal <= 0}
                onClick={() => setCompareTarget("budget")}
                className={cn(
                  "px-3 py-1 rounded-lg text-xs font-medium border transition-colors disabled:opacity-45 disabled:cursor-not-allowed",
                  effectiveCompareTarget === "budget"
                    ? "bg-accent text-accent-foreground border-primary/40"
                    : "bg-background text-muted-foreground border-border"
                )}
              >
                vs Budget
              </button>
              <button
                type="button"
                onClick={() => setCompareTarget("previous")}
                className={cn(
                  "px-3 py-1 rounded-lg text-xs font-medium border transition-colors",
                  effectiveCompareTarget === "previous"
                    ? "bg-accent text-accent-foreground border-primary/40"
                    : "bg-background text-muted-foreground border-border"
                )}
              >
                vs {windowInfo.compLabel}
              </button>
            </div>
            {totalCompareSelectableCount > 8 && (
              <button
                type="button"
                onClick={() => setShowAllCompareCats((v) => !v)}
                className="text-xs font-medium text-primary hover:underline"
              >
                {showAllCompareCats
                  ? "Ringkas (Top 8)"
                  : `Semua (${totalCompareSelectableCount})`}
              </button>
            )}
          </div>
        )}

        {/* Sub-controls for Weekday Mode */}
        {chartView === "weekday" && (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">
                Pola belanja per hari dalam seminggu
              </span>
              <div className="flex gap-1 p-0.5 bg-muted rounded-lg">
                <button
                  type="button"
                  onClick={() => setWeekdayMode("avg")}
                  className={cn(
                    "px-2.5 py-1 rounded-md text-[11px] font-medium",
                    weekdayMode === "avg"
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground"
                  )}
                >
                  Rata-rata/hr
                </button>
                <button
                  type="button"
                  onClick={() => setWeekdayMode("total")}
                  className={cn(
                    "px-2.5 py-1 rounded-md text-[11px] font-medium",
                    weekdayMode === "total"
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground"
                  )}
                >
                  Total
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-muted/50 border border-border rounded-xl px-3 py-2">
                <p className="text-[11px] text-muted-foreground">Hari Kerja (Sen-Jum)</p>
                <p className="font-mono text-xs font-bold text-foreground mt-0.5 tabular-nums">
                  {formatIDR(Math.round(weekdayStats.weekdayAvgPerDay))}
                  <span className="font-sans font-normal text-muted-foreground"> /hr</span>
                </p>
              </div>
              <div className="bg-muted/50 border border-border rounded-xl px-3 py-2">
                <p className="text-[11px] text-muted-foreground">Akhir Pekan (Sab-Min)</p>
                <p className="font-mono text-xs font-bold text-primary mt-0.5 tabular-nums">
                  {formatIDR(Math.round(weekdayStats.weekendAvgPerDay))}
                  <span className="font-sans font-normal text-muted-foreground"> /hr</span>
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Chart Area */}
        <div className="pt-1">
          {loading ? (
            <Skeleton className="h-60 w-full rounded-xl" />
          ) : filteredExpenses.length === 0 && chartView !== "compare" ? (
            <div className="text-center py-14 text-muted-foreground text-xs space-y-2">
              <BarChart3 className="w-8 h-8 mx-auto opacity-50" />
              <p>Belum ada data pengeluaran yang sesuai dengan filter aktif.</p>
              {activeFilterCount > 0 && (
                <button
                  type="button"
                  onClick={clearAllFilters}
                  className="text-xs font-semibold text-primary hover:underline"
                >
                  Reset Filter
                </button>
              )}
            </div>
          ) : chartView === "trend" ? (
            <>
              <div className="h-64 w-full select-none">
                <ResponsiveContainer width="100%" height="100%">
                  {trendMetric === "amount" ? (
                    <ComposedChart
                      data={timeBuckets}
                      margin={{ top: 10, right: 8, left: 0, bottom: 0 }}
                      onClick={(state) => {
                        const bucket = state?.activePayload?.[0]?.payload as TimeBucket | undefined;
                        if (bucket?.key) {
                          setSelectedBucketKey((prev) =>
                            prev === bucket.key ? null : bucket.key
                          );
                        }
                      }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        className="stroke-border"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 10 }}
                        minTickGap={18}
                        className="text-muted-foreground font-mono"
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        width={48}
                        tick={{ fontSize: 10 }}
                        className="text-muted-foreground font-mono"
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={formatCompactIDR}
                      />
                      <Tooltip
                        content={
                          <TrendChartTooltip
                            trendMetric={trendMetric}
                            showCompareOverlay={showCompareOverlay}
                          />
                        }
                      />
                      {averageBucketAmount > 0 && (
                        <ReferenceLine
                          y={averageBucketAmount}
                          stroke="rgb(var(--muted-foreground))"
                          strokeDasharray="4 4"
                          strokeOpacity={0.6}
                        />
                      )}
                      <Bar
                        dataKey="amount"
                        name="Aktual"
                        fill="rgb(var(--primary))"
                        radius={[4, 4, 0, 0]}
                        maxBarSize={32}
                        cursor="pointer"
                      >
                        {timeBuckets.map((entry) => (
                          <Cell
                            key={entry.key}
                            fillOpacity={
                              selectedBucketKey && selectedBucketKey !== entry.key ? 0.45 : 0.92
                            }
                          />
                        ))}
                      </Bar>
                      {showCompareOverlay && (
                        <Line
                          type="monotone"
                          dataKey="prevAmount"
                          name="Periode Lalu"
                          stroke="rgb(var(--muted-foreground))"
                          strokeWidth={1.75}
                          strokeDasharray="4 4"
                          dot={false}
                        />
                      )}
                    </ComposedChart>
                  ) : trendMetric === "cumulative" ? (
                    <ComposedChart
                      data={timeBuckets}
                      margin={{ top: 10, right: 8, left: 0, bottom: 0 }}
                      onClick={(state) => {
                        const bucket = state?.activePayload?.[0]?.payload as TimeBucket | undefined;
                        if (bucket?.key) {
                          setSelectedBucketKey((prev) =>
                            prev === bucket.key ? null : bucket.key
                          );
                        }
                      }}
                    >
                      <defs>
                        <linearGradient id="cumPrimaryGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="rgb(var(--primary))" stopOpacity={0.32} />
                          <stop offset="95%" stopColor="rgb(var(--primary))" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        className="stroke-border"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 10 }}
                        minTickGap={18}
                        className="text-muted-foreground font-mono"
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        width={48}
                        tick={{ fontSize: 10 }}
                        className="text-muted-foreground font-mono"
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={formatCompactIDR}
                      />
                      <Tooltip
                        content={
                          <TrendChartTooltip
                            trendMetric={trendMetric}
                            showCompareOverlay={showCompareOverlay}
                          />
                        }
                      />
                      <Area
                        type="monotone"
                        dataKey="cumulative"
                        name="Kumulatif"
                        stroke="rgb(var(--primary))"
                        strokeWidth={2.5}
                        fill="url(#cumPrimaryGrad)"
                      />
                      {showCompareOverlay && (
                        <Line
                          type="monotone"
                          dataKey="prevCumulative"
                          name="Periode Lalu"
                          stroke="rgb(var(--muted-foreground))"
                          strokeWidth={1.75}
                          strokeDasharray="4 4"
                          dot={false}
                        />
                      )}
                      {showBudgetPace && kpis.budgetTotal > 0 && (
                        <Line
                          type="linear"
                          dataKey="budgetPace"
                          name="Target Budget"
                          stroke="#0F766E"
                          strokeWidth={1.75}
                          strokeDasharray="6 3"
                          dot={false}
                        />
                      )}
                    </ComposedChart>
                  ) : trendMetric === "top_categories" ? (
                    <BarChart
                      data={timeBuckets}
                      margin={{ top: 10, right: 8, left: 0, bottom: 0 }}
                      onClick={(state) => {
                        const bucket = state?.activePayload?.[0]?.payload as TimeBucket | undefined;
                        if (bucket?.key) {
                          setSelectedBucketKey((prev) =>
                            prev === bucket.key ? null : bucket.key
                          );
                        }
                      }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        className="stroke-border"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 10 }}
                        minTickGap={18}
                        className="text-muted-foreground font-mono"
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        width={48}
                        tick={{ fontSize: 10 }}
                        className="text-muted-foreground font-mono"
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={formatCompactIDR}
                      />
                      <Tooltip
                        content={
                          <TrendChartTooltip
                            trendMetric={trendMetric}
                            showCompareOverlay={false}
                          />
                        }
                      />
                      {topStackedCategories.map((cat) => (
                        <Bar
                          key={cat.categoryId}
                          dataKey={cat.name}
                          stackId="cats"
                          fill={cat.color}
                          maxBarSize={32}
                          cursor="pointer"
                        />
                      ))}
                      {hasOtherStacked && (
                        <Bar
                          dataKey="Lainnya"
                          stackId="cats"
                          fill="#A8A29E"
                          maxBarSize={32}
                          cursor="pointer"
                        />
                      )}
                    </BarChart>
                  ) : (
                    <ComposedChart
                      data={timeBuckets}
                      margin={{ top: 10, right: 8, left: 0, bottom: 0 }}
                      onClick={(state) => {
                        const bucket = state?.activePayload?.[0]?.payload as TimeBucket | undefined;
                        if (bucket?.key) {
                          setSelectedBucketKey((prev) =>
                            prev === bucket.key ? null : bucket.key
                          );
                        }
                      }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        className="stroke-border"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 10 }}
                        minTickGap={18}
                        className="text-muted-foreground font-mono"
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        width={36}
                        allowDecimals={false}
                        tick={{ fontSize: 10 }}
                        className="text-muted-foreground font-mono"
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        content={
                          <TrendChartTooltip
                            trendMetric={trendMetric}
                            showCompareOverlay={showCompareOverlay}
                          />
                        }
                      />
                      <Bar
                        dataKey="count"
                        name="Frekuensi"
                        fill="rgb(var(--primary))"
                        radius={[4, 4, 0, 0]}
                        maxBarSize={32}
                        cursor="pointer"
                      />
                      {showCompareOverlay && (
                        <Line
                          type="monotone"
                          dataKey="prevCount"
                          name="Periode Lalu"
                          stroke="rgb(var(--muted-foreground))"
                          strokeWidth={1.75}
                          strokeDasharray="4 4"
                          dot={false}
                        />
                      )}
                    </ComposedChart>
                  )}
                </ResponsiveContainer>
              </div>

              {/* Compact Legend Under Trend Chart */}
              <div className="pt-2 flex items-center justify-between gap-2 flex-wrap text-[11px] text-muted-foreground">
                {trendMetric === "top_categories" ? (
                  <div className="flex items-center gap-2.5 flex-wrap">
                    {topStackedCategories.map((cat) => (
                      <span key={cat.categoryId} className="inline-flex items-center gap-1">
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: cat.color }}
                        />
                        {cat.name}
                      </span>
                    ))}
                    {hasOtherStacked && (
                      <span className="inline-flex items-center gap-1">
                        <span className="w-2.5 h-2.5 rounded-full bg-stone-400" />
                        Lainnya
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-sm bg-primary" />
                      {trendMetric === "cumulative"
                        ? "Akumulasi Aktual"
                        : trendMetric === "count"
                          ? "Jumlah Transaksi"
                          : "Aktual"}
                    </span>
                    {showCompareOverlay && (
                      <span className="inline-flex items-center gap-1.5">
                        <span className="w-3.5 border-t-2 border-dashed border-muted-foreground" />
                        {windowInfo.compLabel}
                      </span>
                    )}
                    {trendMetric === "cumulative" && showBudgetPace && kpis.budgetTotal > 0 && (
                      <span className="inline-flex items-center gap-1.5">
                        <span className="w-3.5 border-t-2 border-dashed border-teal-700 dark:border-teal-400" />
                        Target Budget
                      </span>
                    )}
                  </div>
                )}
                <span className="text-[10px]">Ketuk grafik untuk rincian</span>
              </div>

              {/* Selected Bucket Inspector */}
              {selectedBucket && (
                <div className="mt-2 p-3 rounded-xl bg-muted/50 border border-border space-y-2 animate-slide-up">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-xs font-semibold text-foreground">
                        {selectedBucket.rangeLabel}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {selectedBucket.count} transaksi &middot; Total{" "}
                        <span className="font-mono font-semibold text-primary">
                          {formatIDR(selectedBucket.amount)}
                        </span>
                      </p>
                    </div>
                    <button
                      type="button"
                      aria-label="Tutup rincian tanggal"
                      onClick={() => setSelectedBucketKey(null)}
                      className="w-7 h-7 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  {selectedBucket.expenses.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      Tidak ada transaksi pada rentang ini.
                    </p>
                  ) : (
                    <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                      {selectedBucket.expenses.slice(0, 8).map((exp) => (
                        <div
                          key={exp.id}
                          className="flex items-center justify-between gap-2 text-xs bg-card border border-border/70 rounded-lg px-2.5 py-1.5"
                        >
                          <div className="min-w-0">
                            <p className="font-medium text-foreground truncate">
                              {exp.description || "Tanpa deskripsi"}
                            </p>
                            <p className="text-[10px] text-muted-foreground truncate">
                              {exp.categories?.name ?? "Lainnya"} &middot;{" "}
                              {formatDateShort(exp.spent_at)}
                            </p>
                          </div>
                          <span className="font-mono font-semibold text-foreground shrink-0 tabular-nums">
                            {formatIDR(exp.amount)}
                          </span>
                        </div>
                      ))}
                      {selectedBucket.expenses.length > 8 && (
                        <p className="text-[11px] text-muted-foreground text-center pt-1">
                          +{selectedBucket.expenses.length - 8} transaksi lainnya di tab Transaksi
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
          ) : chartView === "compare" ? (
            compareChartRows.length === 0 ? (
              <div className="text-center py-14 text-muted-foreground text-xs">
                Tidak ada data perbandingan kategori pada rentang ini.
              </div>
            ) : (
              <div
                style={{ height: Math.max(220, compareChartRows.length * 44 + 28) }}
                className="w-full select-none"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={compareChartRows}
                    layout="vertical"
                    margin={{ top: 4, right: 12, left: 4, bottom: 4 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      className="stroke-border"
                      horizontal={false}
                    />
                    <XAxis
                      type="number"
                      tick={{ fontSize: 10 }}
                      className="text-muted-foreground font-mono"
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={formatCompactIDR}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={96}
                      tick={{ fontSize: 11 }}
                      className="text-foreground"
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(val: string) =>
                        val.length > 13 ? `${val.slice(0, 12)}...` : val
                      }
                    />
                    <Tooltip
                      content={<CompareChartTooltip compareTarget={effectiveCompareTarget} />}
                    />
                    <Legend
                      wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }}
                      iconType="circle"
                      iconSize={8}
                    />
                    <Bar
                      dataKey="pembanding"
                      name={
                        effectiveCompareTarget === "budget" ? "Budget" : windowInfo.compLabel
                      }
                      fill="#D6CFC5"
                      radius={[0, 4, 4, 0]}
                      barSize={11}
                    />
                    <Bar
                      dataKey="aktual"
                      name="Aktual"
                      fill="rgb(var(--primary))"
                      radius={[0, 4, 4, 0]}
                      barSize={13}
                    >
                      {compareChartRows.map((row) => (
                        <Cell
                          key={row.categoryId}
                          fill={
                            effectiveCompareTarget === "budget" &&
                            row.budgetPct !== null &&
                            row.budgetPct > 100
                              ? "#BE123C"
                              : "rgb(var(--primary))"
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )
          ) : (
            <div className="h-56 w-full select-none">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={weekdayStats.rows}
                  margin={{ top: 10, right: 8, left: 0, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    className="stroke-border"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="shortLabel"
                    tick={{ fontSize: 11 }}
                    className="text-foreground font-medium"
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    width={48}
                    tick={{ fontSize: 10 }}
                    className="text-muted-foreground font-mono"
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={formatCompactIDR}
                  />
                  <Tooltip content={<WeekdayChartTooltip mode={weekdayMode} />} />
                  <Bar
                    dataKey={weekdayMode === "avg" ? "avgPerOccurrence" : "total"}
                    radius={[6, 6, 0, 0]}
                    maxBarSize={36}
                  >
                    {weekdayStats.rows.map((entry) => (
                      <Cell
                        key={entry.dayIndex}
                        fill={
                          entry.dayIndex === weekdayStats.maxDayIndex
                            ? "rgb(var(--primary))"
                            : "#EAA995"
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </section>

      {/* E. Detail Breakdown Section (3 Integrated Tabs) */}
      <section className="bg-card border border-border rounded-2xl p-4 shadow-sm space-y-3">
        <div className="grid grid-cols-3 gap-1 p-1 bg-muted rounded-xl">
          {[
            { id: "categories" as const, label: "Per Kategori" },
            { id: "transactions" as const, label: `Transaksi (${filteredExpenses.length})` },
            { id: "dimensions" as const, label: "Event & Anggota" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setDetailTab(tab.id)}
              className={cn(
                "min-h-[36px] rounded-lg text-xs font-semibold transition-all truncate px-1",
                detailTab === tab.id
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab 1: Per Kategori */}
        {detailTab === "categories" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex gap-1 overflow-x-auto no-scrollbar">
                {[
                  { id: "amount" as const, label: "Terbesar" },
                  { id: "delta_up" as const, label: "Naik Tertinggi" },
                  ...(windowInfo.isPeriodBased
                    ? [{ id: "budget_pct" as const, label: "Budget %" }]
                    : []),
                  { id: "count" as const, label: "Frekuensi" },
                ].map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setCategorySort(s.id)}
                    className={cn(
                      "px-2.5 py-1 rounded-lg text-[11px] font-medium whitespace-nowrap border transition-colors",
                      categorySort === s.id
                        ? "bg-accent text-accent-foreground border-primary/40"
                        : "bg-background text-muted-foreground border-border"
                    )}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
              {excludedCategoryIds.size > 0 && (
                <button
                  type="button"
                  onClick={() => setExcludedCategoryIds(new Set())}
                  className="text-[11px] font-semibold text-primary hover:underline"
                >
                  Tampilkan Semua
                </button>
              )}
            </div>

            {sortedCategoryRows.length === 0 ? (
              <p className="text-center py-8 text-xs text-muted-foreground">
                Belum ada kategori dengan data di rentang ini.
              </p>
            ) : (
              <div className="divide-y divide-border">
                {sortedCategoryRows.map((row) => {
                  const Icon = getCategoryIcon(row.name);
                  const isExpanded = expandedCategoryId === row.categoryId;
                  const barPct =
                    row.budgetUsagePct !== null
                      ? Math.min(100, row.budgetUsagePct)
                      : Math.min(100, row.sharePct);
                  const barOver = (row.budgetUsagePct ?? 0) > 100;
                  const barWarn = (row.budgetUsagePct ?? 0) > 80 && !barOver;

                  return (
                    <div key={row.categoryId} className="py-2.5">
                      <div className="flex items-start justify-between gap-2">
                        {/* Visibility toggle eye */}
                        <button
                          type="button"
                          aria-label={
                            row.isSelected ? `Sembunyikan ${row.name}` : `Tampilkan ${row.name}`
                          }
                          onClick={() => toggleCategoryExcluded(row.categoryId)}
                          className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center shrink-0 mt-0.5 text-muted-foreground"
                        >
                          {row.isSelected ? (
                            <Eye className="w-4 h-4 text-foreground/75" />
                          ) : (
                            <EyeOff className="w-4 h-4 opacity-50" />
                          )}
                        </button>

                        {/* Main expandable row */}
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedCategoryId((prev) =>
                              prev === row.categoryId ? null : row.categoryId
                            )
                          }
                          className={cn(
                            "flex-1 min-w-0 text-left space-y-1.5 transition-opacity",
                            !row.isSelected && "opacity-45"
                          )}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <span
                                className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                                style={{ backgroundColor: row.color }}
                              >
                                <Icon className="w-3.5 h-3.5 text-white" />
                              </span>
                              <div className="min-w-0">
                                <p
                                  className={cn(
                                    "text-xs font-semibold truncate",
                                    row.isSelected
                                      ? "text-foreground"
                                      : "text-muted-foreground line-through"
                                  )}
                                >
                                  {row.name}
                                </p>
                                <p className="text-[11px] text-muted-foreground truncate">
                                  {row.count}x &middot;{" "}
                                  {row.isSelected
                                    ? `${row.sharePct.toFixed(1)}% porsi`
                                    : "Disembunyikan"}
                                </p>
                              </div>
                            </div>

                            <div className="text-right shrink-0 flex items-center gap-1.5">
                              <div>
                                <p className="text-xs font-mono font-bold text-foreground tabular-nums">
                                  {formatIDR(row.amount)}
                                </p>
                                <div className="flex items-center justify-end gap-1 mt-0.5">
                                  <DeltaBadge deltaPct={row.deltaPct} />
                                  {row.budget > 0 && (
                                    <span className="text-[10px] font-mono text-muted-foreground tabular-nums">
                                      /{formatCompactIDR(row.budget)}
                                    </span>
                                  )}
                                </div>
                              </div>
                              {isExpanded ? (
                                <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" />
                              ) : (
                                <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                              )}
                            </div>
                          </div>

                          {row.isSelected && (
                            <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                              <div
                                className={cn(
                                  "h-full rounded-full transition-all",
                                  barOver
                                    ? "bg-rose-600 dark:bg-rose-400"
                                    : barWarn
                                      ? "bg-amber-600 dark:bg-amber-400"
                                      : ""
                                )}
                                style={{
                                  width: `${barPct}%`,
                                  backgroundColor:
                                    barOver || barWarn ? undefined : row.color,
                                }}
                              />
                            </div>
                          )}
                        </button>
                      </div>

                      {/* Inline Category Drilldown */}
                      {isExpanded && (
                        <div className="mt-2.5 ml-10 p-3 rounded-xl bg-muted/45 border border-border space-y-2.5 animate-slide-up">
                          <div className="grid grid-cols-2 gap-2 text-[11px]">
                            <div>
                              <span className="text-muted-foreground">Rata2 per transaksi:</span>{" "}
                              <span className="font-mono font-semibold text-foreground">
                                {formatIDR(Math.round(row.avgPerTx))}
                              </span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Periode lalu:</span>{" "}
                              <span className="font-mono font-semibold text-foreground">
                                {formatIDR(row.prevAmount)}
                              </span>
                            </div>
                          </div>

                          {row.expenses.length > 0 && (
                            <div className="space-y-1">
                              {row.expenses.slice(0, 5).map((exp) => (
                                <div
                                  key={exp.id}
                                  className="flex items-center justify-between gap-2 text-xs bg-card border border-border/60 rounded-lg px-2.5 py-1.5"
                                >
                                  <div className="min-w-0">
                                    <p className="font-medium text-foreground truncate">
                                      {exp.description || "Tanpa nama"}
                                    </p>
                                    <p className="text-[10px] text-muted-foreground">
                                      {formatDateShort(exp.spent_at)}
                                    </p>
                                  </div>
                                  <span className="font-mono font-semibold text-foreground shrink-0 tabular-nums">
                                    {formatIDR(exp.amount)}
                                  </span>
                                </div>
                              ))}
                              {row.expenses.length > 5 && (
                                <p className="text-[10px] text-muted-foreground">
                                  +{row.expenses.length - 5} item lainnya
                                </p>
                              )}
                            </div>
                          )}

                          <div className="flex items-center justify-between gap-2 pt-1 border-t border-border">
                            <button
                              type="button"
                              onClick={() => focusSingleCategory(row.categoryId)}
                              className="text-xs font-semibold text-primary hover:underline"
                            >
                              Fokus Kategori Ini
                            </button>
                            <Link
                              href={`/history?cat=${row.categoryId}${
                                windowInfo.activeLabelMonths.length === 1
                                  ? `&period=${windowInfo.activeLabelMonths[0]}`
                                  : ""
                              }`}
                              className="text-xs font-medium text-muted-foreground hover:text-foreground"
                            >
                              Buka di Riwayat
                            </Link>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Top & Itemized Transactions */}
        {detailTab === "transactions" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => setTxSort("amount")}
                  className={cn(
                    "px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-colors",
                    txSort === "amount"
                      ? "bg-accent text-accent-foreground border-primary/40"
                      : "bg-background text-muted-foreground border-border"
                  )}
                >
                  Terbesar
                </button>
                <button
                  type="button"
                  onClick={() => setTxSort("date")}
                  className={cn(
                    "px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-colors",
                    txSort === "date"
                      ? "bg-accent text-accent-foreground border-primary/40"
                      : "bg-background text-muted-foreground border-border"
                  )}
                >
                  Terbaru
                </button>
              </div>
              <span className="text-[11px] font-mono text-muted-foreground tabular-nums">
                Total: {formatIDR(kpis.total)}
              </span>
            </div>

            {sortedTransactions.length === 0 ? (
              <p className="text-center py-8 text-xs text-muted-foreground">
                Tidak ada transaksi ditemukan.
              </p>
            ) : (
              <div className="divide-y divide-border">
                {sortedTransactions.slice(0, txLimit).map((exp) => {
                  const ev = exp.event_id ? eventMap.get(exp.event_id) : undefined;
                  const memName = exp.created_by
                    ? memberLabelMap.get(exp.created_by)
                    : undefined;
                  const share = kpis.total > 0 ? (Number(exp.amount) / kpis.total) * 100 : 0;

                  return (
                    <div key={exp.id} className="py-2.5 flex items-start justify-between gap-2">
                      <div className="min-w-0 space-y-0.5">
                        <p className="text-xs font-semibold text-foreground break-words">
                          {exp.description || "Tanpa deskripsi"}
                        </p>
                        {exp.note && (
                          <p className="text-[11px] text-muted-foreground break-words">
                            {exp.note}
                          </p>
                        )}
                        <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                            <span
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: exp.categories?.color ?? "#B85138" }}
                            />
                            {exp.categories?.name ?? "Lainnya"}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            &middot; {formatDateShort(exp.spent_at)}
                          </span>
                          {ev && (
                            <span className="px-1.5 py-0.5 rounded-md bg-secondary text-secondary-foreground text-[10px] font-medium">
                              {ev.name}
                            </span>
                          )}
                          {memName && (
                            <span className="text-[10px] text-muted-foreground">
                              &middot; {memName}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <p className="font-mono text-xs font-bold text-foreground tabular-nums">
                          {formatIDR(exp.amount)}
                        </p>
                        <p className="text-[10px] font-mono text-muted-foreground tabular-nums">
                          {share.toFixed(1)}%
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {sortedTransactions.length > txLimit && (
              <button
                type="button"
                onClick={() => setTxLimit((prev) => prev + 20)}
                className="w-full min-h-[40px] rounded-xl border border-border bg-background hover:bg-muted text-xs font-semibold text-foreground transition-colors"
              >
                Muat Lebih Banyak ({sortedTransactions.length - txLimit} lagi)
              </button>
            )}
          </div>
        )}

        {/* Tab 3: Dimensions (Event, Consumption vs Savings, Member) */}
        {detailTab === "dimensions" && (
          <div className="space-y-4">
            {/* Consumption vs Savings */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <PiggyBank className="w-3.5 h-3.5 text-primary" /> Konsumsi vs Tabungan
                </span>
                <button
                  type="button"
                  onClick={() => setIncludeSavings((v) => !v)}
                  className="text-[11px] font-semibold text-primary hover:underline"
                >
                  {includeSavings ? "Kecualikan Nabung" : "Sertakan Nabung"}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-border bg-background p-3">
                  <p className="text-[11px] text-muted-foreground">Konsumsi Murni</p>
                  <p className="font-mono text-sm font-bold text-foreground mt-0.5 tabular-nums">
                    {formatIDR(dimensionSummary.consumptionTotal)}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {dimensionSummary.consumptionCount} item
                  </p>
                </div>
                <div className="rounded-xl border border-border bg-background p-3">
                  <p className="text-[11px] text-muted-foreground">Tabungan / Goal</p>
                  <p className="font-mono text-sm font-bold text-teal-700 dark:text-teal-300 mt-0.5 tabular-nums">
                    {formatIDR(dimensionSummary.savingsTotal)}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {dimensionSummary.savingsCount} item
                  </p>
                </div>
              </div>
            </div>

            {/* Reguler vs Event */}
            <div className="space-y-2 pt-2 border-t border-border">
              <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-primary" /> Reguler vs Event Khusus
              </span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setEventFilter((prev) => (prev === "regular" ? "all" : "regular"))
                  }
                  className={cn(
                    "text-left rounded-xl border p-3 transition-colors",
                    eventFilter === "regular"
                      ? "bg-accent border-primary/50"
                      : "bg-background border-border hover:bg-muted/50"
                  )}
                >
                  <p className="text-[11px] text-muted-foreground">Belanja Reguler</p>
                  <p className="font-mono text-sm font-bold text-foreground mt-0.5 tabular-nums">
                    {formatIDR(dimensionSummary.regularTotal)}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {dimensionSummary.regularCount} item
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setEventFilter((prev) => (prev === "events_only" ? "all" : "events_only"))
                  }
                  className={cn(
                    "text-left rounded-xl border p-3 transition-colors",
                    eventFilter === "events_only"
                      ? "bg-accent border-primary/50"
                      : "bg-background border-border hover:bg-muted/50"
                  )}
                >
                  <p className="text-[11px] text-muted-foreground">Total Event</p>
                  <p className="font-mono text-sm font-bold text-foreground mt-0.5 tabular-nums">
                    {formatIDR(dimensionSummary.eventTotal)}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {dimensionSummary.eventCount} item
                  </p>
                </button>
              </div>

              {dimensionSummary.events.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  {dimensionSummary.events.map((ev) => (
                    <button
                      key={ev.id}
                      type="button"
                      onClick={() =>
                        setEventFilter((prev) => (prev === ev.id ? "all" : ev.id))
                      }
                      className={cn(
                        "w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl border text-xs transition-colors",
                        eventFilter === ev.id
                          ? "bg-accent border-primary/50"
                          : "bg-background border-border hover:bg-muted/40"
                      )}
                    >
                      <div className="text-left min-w-0">
                        <p className="font-semibold text-foreground truncate">{ev.name}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {ev.count} item &middot; {ev.sharePct.toFixed(1)}%
                        </p>
                      </div>
                      <span className="font-mono font-bold text-foreground shrink-0 tabular-nums">
                        {formatIDR(ev.total)}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Per Member Breakdown */}
            <div className="space-y-2 pt-2 border-t border-border">
              <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-primary" /> Per Pencatat / Anggota
              </span>
              {dimensionSummary.members.length === 0 ? (
                <p className="text-xs text-muted-foreground">Belum ada data transaksi.</p>
              ) : (
                <div className="space-y-1.5">
                  {dimensionSummary.members.map((m) => (
                    <button
                      key={m.userId}
                      type="button"
                      onClick={() =>
                        setMemberId((prev) => (prev === m.userId ? "all" : m.userId))
                      }
                      className={cn(
                        "w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl border text-xs transition-colors",
                        memberId === m.userId
                          ? "bg-accent border-primary/50"
                          : "bg-background border-border hover:bg-muted/40"
                      )}
                    >
                      <div className="text-left min-w-0">
                        <p className="font-semibold text-foreground truncate">{m.label}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {m.count} item &middot; {m.sharePct.toFixed(1)}% porsi
                        </p>
                      </div>
                      <span className="font-mono font-bold text-foreground shrink-0 tabular-nums">
                        {formatIDR(m.total)}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

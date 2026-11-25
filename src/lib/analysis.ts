import {
  getPeriodRange,
  isoDate,
  labelMonthKey,
  periodRangeTextWithCustom,
  periodTitle,
  shiftPeriod,
} from "@/lib/period";

export type AnalysisRangePreset =
  | "period"
  | "prev_period"
  | "3p"
  | "6p"
  | "7d"
  | "30d"
  | "custom";

export type Granularity = "auto" | "day" | "week" | "month";
export type ResolvedGranularity = "day" | "week" | "month";
export type TrendMetric = "amount" | "cumulative" | "top_categories" | "count";
export type ChartViewMode = "trend" | "compare" | "weekday";
export type CompareTarget = "budget" | "previous";
export type DetailTab = "categories" | "transactions" | "dimensions";
export type CategorySort = "amount" | "delta_up" | "budget_pct" | "count";
export type MetricKey =
  | "total"
  | "daily_avg"
  | "budget_usage"
  | "tx_stats"
  | "median_max"
  | "income_ratio"
  | "peak_day"
  | "top_category";

export type EventFilterMode = "all" | "regular" | "events_only" | string;

export type CustomPeriodRange = {
  label_month: string;
  start_date: string;
  end_date: string;
};

export type AnalysisCategory = {
  id: string;
  name: string;
  color: string | null;
  sort_order: number;
  is_archived: boolean;
};

export type AnalysisEvent = {
  id: string;
  name: string;
  status: string;
  start_date: string;
  end_date: string | null;
};

export type AnalysisMember = {
  user_id: string;
  display_name: string | null;
};

export type AnalysisExpense = {
  id: string;
  spent_at: string;
  amount: number;
  description: string;
  note: string | null;
  category_id: string;
  event_id: string | null;
  goal_id: string | null;
  created_by: string | null;
  categories: {
    id?: string;
    name: string;
    color: string | null;
  } | null;
};

export type BudgetRow = {
  category_id: string;
  month: string;
  amount: number;
};

export type IncomeRow = {
  month: string;
  amount: number;
};

export type ResolvedWindow = {
  startDate: string;
  endDate: string;
  compStartDate: string;
  compEndDate: string;
  label: string;
  subtitleLabel: string;
  compLabel: string;
  activeLabelMonths: string[];
  compLabelMonths: string[];
  isPeriodBased: boolean;
  totalDays: number;
  elapsedDays: number;
  isOngoing: boolean;
};

export type ExpenseFilterState = {
  excludedCategoryIds: Set<string>;
  includeSavings: boolean;
  eventFilter: EventFilterMode;
  memberId: string;
  searchQuery: string;
};

export type TimeBucket = {
  key: string;
  label: string;
  rangeLabel: string;
  startDate: string;
  endDate: string;
  amount: number;
  prevAmount: number;
  cumulative: number;
  prevCumulative: number;
  budgetPace: number | null;
  count: number;
  prevCount: number;
  expenses: AnalysisExpense[];
  [categoryOrOtherKey: string]: string | number | boolean | null | AnalysisExpense[];
};

export type CategoryBreakdownRow = {
  categoryId: string;
  name: string;
  color: string;
  isSavings: boolean;
  isSelected: boolean;
  amount: number;
  prevAmount: number;
  deltaAmount: number;
  deltaPct: number | null;
  count: number;
  prevCount: number;
  avgPerTx: number;
  sharePct: number;
  budget: number;
  budgetUsagePct: number | null;
  budgetRemaining: number | null;
  expenses: AnalysisExpense[];
};

export type WeekdayStatRow = {
  dayIndex: number; // 0 = Senin .. 6 = Minggu
  shortLabel: string;
  fullLabel: string;
  total: number;
  count: number;
  occurrences: number;
  avgPerOccurrence: number;
  isWeekend: boolean;
};

export type AnalysisKPIs = {
  total: number;
  compTotal: number;
  deltaAmount: number;
  deltaPct: number | null;
  projectedTotal: number | null;
  dailyAvg: number;
  compDailyAvg: number;
  activeDayAvg: number;
  activeDaysCount: number;
  budgetTotal: number;
  budgetUsagePct: number | null;
  budgetRemaining: number | null;
  txCount: number;
  compTxCount: number;
  avgPerTx: number;
  compAvgPerTx: number;
  medianTx: number;
  maxTx: {
    id: string;
    description: string;
    amount: number;
    spent_at: string;
    categoryName: string;
  } | null;
  incomeTotal: number;
  incomeRatioPct: number | null;
  netCashflow: number | null;
  peakDay: {
    date: string;
    amount: number;
    count: number;
  } | null;
  topCategory: {
    categoryId: string;
    name: string;
    color: string;
    amount: number;
    sharePct: number;
  } | null;
};

export type SmartInsight = {
  id: string;
  tone: "positive" | "warning" | "neutral";
  text: string;
};

export type DimensionSummary = {
  regularTotal: number;
  regularCount: number;
  eventTotal: number;
  eventCount: number;
  consumptionTotal: number;
  consumptionCount: number;
  savingsTotal: number;
  savingsCount: number;
  events: {
    id: string;
    name: string;
    status: string;
    total: number;
    count: number;
    sharePct: number;
  }[];
  members: {
    userId: string;
    label: string;
    total: number;
    count: number;
    sharePct: number;
  }[];
};

export const METRIC_DEFINITIONS: {
  key: MetricKey;
  label: string;
  shortDesc: string;
}[] = [
  { key: "total", label: "Total Belanja", shortDesc: "Total terfilter & selisih periode" },
  { key: "daily_avg", label: "Rata-rata Harian", shortDesc: "Burn rate per hari & hari aktif" },
  { key: "budget_usage", label: "Serapan Budget", shortDesc: "Realisasi terhadap alokasi budget" },
  { key: "tx_stats", label: "Frekuensi & Rata2", shortDesc: "Jumlah transaksi & nilai rata-rata" },
  { key: "median_max", label: "Median & Terbesar", shortDesc: "Nilai tengah & transaksi tertinggi" },
  { key: "income_ratio", label: "Rasio Pemasukan", shortDesc: "Porsi pengeluaran vs pemasukan" },
  { key: "peak_day", label: "Hari Puncak", shortDesc: "Tanggal dengan belanja tertinggi" },
  { key: "top_category", label: "Kategori Terbesar", shortDesc: "Pos pengeluaran paling dominan" },
];

export const DEFAULT_VISIBLE_METRICS: MetricKey[] = [
  "total",
  "daily_avg",
  "budget_usage",
  "tx_stats",
];

export function parseLocalDate(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y || 1970, (m || 1) - 1, d || 1);
}

export function addDays(ymd: string, delta: number): string {
  const d = parseLocalDate(ymd);
  d.setDate(d.getDate() + delta);
  return isoDate(d);
}

export function diffDaysInclusive(startYmd: string, endYmd: string): number {
  const s = parseLocalDate(startYmd).getTime();
  const e = parseLocalDate(endYmd).getTime();
  return Math.max(1, Math.round((e - s) / 86400000) + 1);
}

export function formatDateShort(ymd: string): string {
  return parseLocalDate(ymd).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
  });
}

export function formatDateFull(ymd: string): string {
  return parseLocalDate(ymd).toLocaleDateString("id-ID", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function isSavingsCategory(name: string | null | undefined): boolean {
  if (!name) return false;
  return /nabung|tabung/i.test(name);
}

export function formatCompactIDR(val: number): string {
  const abs = Math.abs(val);
  const sign = val < 0 ? "-" : "";
  if (abs >= 1_000_000_000) {
    return `${sign}${(abs / 1_000_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  }
  if (abs >= 1_000_000) {
    return `${sign}${(abs / 1_000_000).toFixed(1).replace(/\.0$/, "")}jt`;
  }
  if (abs >= 1_000) {
    return `${sign}${Math.round(abs / 1_000)}rb`;
  }
  return `${sign}${Math.round(abs)}`;
}

export function resolveAnalysisWindow(params: {
  preset: AnalysisRangePreset;
  anchorLabelMonth: Date;
  customStart: string;
  customEnd: string;
  payDay: number;
  customPeriods: CustomPeriodRange[];
  todayStr: string;
}): ResolvedWindow {
  const { preset, anchorLabelMonth, customStart, customEnd, payDay, customPeriods, todayStr } =
    params;

  let startDate = todayStr;
  let endDate = todayStr;
  let compStartDate = todayStr;
  let compEndDate = todayStr;
  let label = "";
  let subtitleLabel = "";
  let compLabel = "";
  let activeLabelMonths: string[] = [];
  let compLabelMonths: string[] = [];
  let isPeriodBased = false;

  if (preset === "period" || preset === "prev_period") {
    const targetAnchor =
      preset === "period" ? anchorLabelMonth : shiftPeriod(anchorLabelMonth, -1);
    const compAnchor = shiftPeriod(targetAnchor, -1);

    const activeRange = getPeriodRange(targetAnchor, payDay, customPeriods);
    const compRange = getPeriodRange(compAnchor, payDay, customPeriods);

    startDate = activeRange.from;
    endDate = activeRange.to;
    compStartDate = compRange.from;
    compEndDate = compRange.to;

    label = periodTitle(targetAnchor);
    subtitleLabel = periodRangeTextWithCustom(targetAnchor, payDay, customPeriods);
    compLabel = periodTitle(compAnchor);
    activeLabelMonths = [labelMonthKey(targetAnchor)];
    compLabelMonths = [labelMonthKey(compAnchor)];
    isPeriodBased = true;
  } else if (preset === "3p" || preset === "6p") {
    const count = preset === "3p" ? 3 : 6;
    const firstActiveAnchor = shiftPeriod(anchorLabelMonth, -(count - 1));
    const firstCompAnchor = shiftPeriod(anchorLabelMonth, -(count * 2 - 1));
    const lastCompAnchor = shiftPeriod(anchorLabelMonth, -count);

    startDate = getPeriodRange(firstActiveAnchor, payDay, customPeriods).from;
    endDate = getPeriodRange(anchorLabelMonth, payDay, customPeriods).to;
    compStartDate = getPeriodRange(firstCompAnchor, payDay, customPeriods).from;
    compEndDate = getPeriodRange(lastCompAnchor, payDay, customPeriods).to;

    for (let i = 0; i < count; i++) {
      activeLabelMonths.push(labelMonthKey(shiftPeriod(firstActiveAnchor, i)));
      compLabelMonths.push(labelMonthKey(shiftPeriod(firstCompAnchor, i)));
    }

    label = `${count} Periode Gajian`;
    subtitleLabel = `${formatDateShort(startDate)} - ${formatDateShort(endDate)} ${parseLocalDate(endDate).getFullYear()}`;
    compLabel = `${count} periode sebelumnya`;
    isPeriodBased = true;
  } else if (preset === "7d" || preset === "30d") {
    const days = preset === "7d" ? 7 : 30;
    endDate = todayStr;
    startDate = addDays(todayStr, -(days - 1));
    compEndDate = addDays(startDate, -1);
    compStartDate = addDays(compEndDate, -(days - 1));
    label = `${days} Hari Terakhir`;
    subtitleLabel = `${formatDateShort(startDate)} - ${formatDateShort(endDate)} ${parseLocalDate(endDate).getFullYear()}`;
    compLabel = `${days} hari sebelumnya`;
    isPeriodBased = false;
  } else {
    const safeA = customStart || todayStr;
    const safeB = customEnd || todayStr;
    startDate = safeA <= safeB ? safeA : safeB;
    endDate = safeA <= safeB ? safeB : safeA;
    const span = diffDaysInclusive(startDate, endDate);
    compEndDate = addDays(startDate, -1);
    compStartDate = addDays(compEndDate, -(span - 1));
    label = "Rentang Kustom";
    subtitleLabel = `${formatDateShort(startDate)} - ${formatDateShort(endDate)} ${parseLocalDate(endDate).getFullYear()}`;
    compLabel = `${span} hari sebelumnya`;
    isPeriodBased = false;
  }

  const totalDays = diffDaysInclusive(startDate, endDate);
  const isOngoing = startDate <= todayStr && todayStr <= endDate;
  const elapsedDays = isOngoing ? diffDaysInclusive(startDate, todayStr) : totalDays;

  return {
    startDate,
    endDate,
    compStartDate,
    compEndDate,
    label,
    subtitleLabel,
    compLabel,
    activeLabelMonths,
    compLabelMonths,
    isPeriodBased,
    totalDays,
    elapsedDays,
    isOngoing,
  };
}

export function applyExpenseFilters(
  expenses: AnalysisExpense[],
  filters: ExpenseFilterState,
  options?: { ignoreCategoryExclusion?: boolean }
): AnalysisExpense[] {
  const q = filters.searchQuery.trim().toLowerCase();
  const ignoreCat = options?.ignoreCategoryExclusion ?? false;

  return expenses.filter((e) => {
    const catId = e.category_id || e.categories?.id || "uncategorized";
    const catName = e.categories?.name ?? "";

    if (!filters.includeSavings && isSavingsCategory(catName)) {
      return false;
    }

    if (!ignoreCat && filters.excludedCategoryIds.has(catId)) {
      return false;
    }

    if (filters.eventFilter === "regular" && e.event_id) {
      return false;
    } else if (filters.eventFilter === "events_only" && !e.event_id) {
      return false;
    } else if (
      filters.eventFilter !== "all" &&
      filters.eventFilter !== "regular" &&
      filters.eventFilter !== "events_only" &&
      e.event_id !== filters.eventFilter
    ) {
      return false;
    }

    if (filters.memberId !== "all") {
      if (filters.memberId === "unknown") {
        if (e.created_by) return false;
      } else if (e.created_by !== filters.memberId) {
        return false;
      }
    }

    if (q) {
      const hay = `${e.description || ""} ${e.note || ""} ${catName}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }

    return true;
  });
}

export function resolveGranularity(
  granularity: Granularity,
  totalDays: number
): ResolvedGranularity {
  if (granularity !== "auto") return granularity;
  if (totalDays <= 35) return "day";
  if (totalDays <= 130) return "week";
  return "month";
}

function generateBucketSkeletons(
  startDate: string,
  endDate: string,
  gran: ResolvedGranularity
): { key: string; label: string; rangeLabel: string; startDate: string; endDate: string }[] {
  const buckets: {
    key: string;
    label: string;
    rangeLabel: string;
    startDate: string;
    endDate: string;
  }[] = [];

  if (gran === "day") {
    let curr = startDate;
    while (curr <= endDate) {
      const d = parseLocalDate(curr);
      buckets.push({
        key: curr,
        label: `${d.getDate()}/${d.getMonth() + 1}`,
        rangeLabel: formatDateFull(curr),
        startDate: curr,
        endDate: curr,
      });
      curr = addDays(curr, 1);
    }
    return buckets;
  }

  if (gran === "week") {
    let curr = startDate;
    let idx = 1;
    while (curr <= endDate) {
      const candidateEnd = addDays(curr, 6);
      const bEnd = candidateEnd <= endDate ? candidateEnd : endDate;
      buckets.push({
        key: `${curr}_${bEnd}`,
        label: `M${idx} (${formatDateShort(curr)})`,
        rangeLabel: `${formatDateShort(curr)} - ${formatDateShort(bEnd)}`,
        startDate: curr,
        endDate: bEnd,
      });
      curr = addDays(bEnd, 1);
      idx += 1;
    }
    return buckets;
  }

  // Month buckets clipped to [startDate, endDate]
  const sDate = parseLocalDate(startDate);
  const eDate = parseLocalDate(endDate);
  let cursor = new Date(sDate.getFullYear(), sDate.getMonth(), 1);
  const endMonth = new Date(eDate.getFullYear(), eDate.getMonth(), 1);

  while (cursor <= endMonth) {
    const monthStart = isoDate(cursor);
    const nextMonthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
    const monthEnd = isoDate(nextMonthEnd);
    const clippedStart = monthStart < startDate ? startDate : monthStart;
    const clippedEnd = monthEnd > endDate ? endDate : monthEnd;

    buckets.push({
      key: monthStart.slice(0, 7),
      label: cursor.toLocaleDateString("id-ID", { month: "short", year: "2-digit" }),
      rangeLabel: `${formatDateShort(clippedStart)} - ${formatDateShort(clippedEnd)}`,
      startDate: clippedStart,
      endDate: clippedEnd,
    });
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
  }

  return buckets;
}

export function buildTimeBuckets(params: {
  startDate: string;
  endDate: string;
  compStartDate: string;
  compEndDate: string;
  granularity: ResolvedGranularity;
  activeExpenses: AnalysisExpense[];
  compExpenses: AnalysisExpense[];
  topCategoryNames: string[];
  totalBudget: number | null;
}): TimeBucket[] {
  const {
    startDate,
    endDate,
    compStartDate,
    compEndDate,
    granularity,
    activeExpenses,
    compExpenses,
    topCategoryNames,
    totalBudget,
  } = params;

  const activeSkeletons = generateBucketSkeletons(startDate, endDate, granularity);
  const compSkeletons = generateBucketSkeletons(compStartDate, compEndDate, granularity);
  const topSet = new Set(topCategoryNames);
  const totalDays = diffDaysInclusive(startDate, endDate);

  // Map active expenses into activeSkeletons
  const activeByIdx: AnalysisExpense[][] = activeSkeletons.map(() => []);
  for (const exp of activeExpenses) {
    const idx = activeSkeletons.findIndex(
      (b) => exp.spent_at >= b.startDate && exp.spent_at <= b.endDate
    );
    if (idx !== -1) activeByIdx[idx].push(exp);
  }

  // Map comp expenses into compSkeletons aligned by index
  const compTotalsByIdx: { amount: number; count: number }[] = activeSkeletons.map(() => ({
    amount: 0,
    count: 0,
  }));
  for (const exp of compExpenses) {
    const idx = compSkeletons.findIndex(
      (b) => exp.spent_at >= b.startDate && exp.spent_at <= b.endDate
    );
    if (idx !== -1 && idx < compTotalsByIdx.length) {
      compTotalsByIdx[idx].amount += Number(exp.amount);
      compTotalsByIdx[idx].count += 1;
    }
  }

  let runningActive = 0;
  let runningPrev = 0;

  return activeSkeletons.map((sk, idx) => {
    const items = activeByIdx[idx]
      .slice()
      .sort((a, b) => Number(b.amount) - Number(a.amount));
    const amount = items.reduce((sum, e) => sum + Number(e.amount), 0);
    const prevAmount = compTotalsByIdx[idx]?.amount ?? 0;
    const prevCount = compTotalsByIdx[idx]?.count ?? 0;

    runningActive += amount;
    runningPrev += prevAmount;

    const elapsedToBucketEnd = diffDaysInclusive(startDate, sk.endDate);
    const budgetPace =
      totalBudget !== null && totalBudget > 0
        ? Math.round((totalBudget * elapsedToBucketEnd) / totalDays)
        : null;

    const bucket: TimeBucket = {
      key: sk.key,
      label: sk.label,
      rangeLabel: sk.rangeLabel,
      startDate: sk.startDate,
      endDate: sk.endDate,
      amount,
      prevAmount,
      cumulative: runningActive,
      prevCumulative: runningPrev,
      budgetPace,
      count: items.length,
      prevCount,
      expenses: items,
    };

    for (const name of topCategoryNames) {
      bucket[name] = 0;
    }
    bucket["Lainnya"] = 0;

    for (const item of items) {
      const catName = item.categories?.name ?? "Lainnya";
      const targetKey = topSet.has(catName) ? catName : "Lainnya";
      bucket[targetKey] = Number(bucket[targetKey] ?? 0) + Number(item.amount);
    }

    return bucket;
  });
}

export function buildCategoryBreakdown(params: {
  categories: AnalysisCategory[];
  nonCatFilteredActive: AnalysisExpense[];
  nonCatFilteredComp: AnalysisExpense[];
  budgets: BudgetRow[];
  isPeriodBased: boolean;
  filters: ExpenseFilterState;
}): { rows: CategoryBreakdownRow[]; filteredTotal: number } {
  const {
    categories,
    nonCatFilteredActive,
    nonCatFilteredComp,
    budgets,
    isPeriodBased,
    filters,
  } = params;

  const catMetaMap = new Map<string, { name: string; color: string; sortOrder: number }>();
  for (const c of categories) {
    catMetaMap.set(c.id, {
      name: c.name,
      color: c.color || "#B85138",
      sortOrder: c.sort_order ?? 999,
    });
  }

  const budgetMap = new Map<string, number>();
  if (isPeriodBased) {
    for (const b of budgets) {
      budgetMap.set(b.category_id, (budgetMap.get(b.category_id) ?? 0) + Number(b.amount));
    }
  }

  const activeByCat = new Map<string, AnalysisExpense[]>();
  for (const e of nonCatFilteredActive) {
    const cid = e.category_id || "uncategorized";
    if (!catMetaMap.has(cid)) {
      catMetaMap.set(cid, {
        name: e.categories?.name || "Lainnya",
        color: e.categories?.color || "#94A3B8",
        sortOrder: 999,
      });
    }
    const list = activeByCat.get(cid) ?? [];
    list.push(e);
    activeByCat.set(cid, list);
  }

  const compByCat = new Map<string, { amount: number; count: number }>();
  for (const e of nonCatFilteredComp) {
    const cid = e.category_id || "uncategorized";
    if (!catMetaMap.has(cid)) {
      catMetaMap.set(cid, {
        name: e.categories?.name || "Lainnya",
        color: e.categories?.color || "#94A3B8",
        sortOrder: 999,
      });
    }
    const prev = compByCat.get(cid) ?? { amount: 0, count: 0 };
    compByCat.set(cid, {
      amount: prev.amount + Number(e.amount),
      count: prev.count + 1,
    });
  }

  const allCategoryIds = new Set<string>([
    ...activeByCat.keys(),
    ...compByCat.keys(),
    ...budgetMap.keys(),
  ]);

  let filteredTotal = 0;
  const draftRows: Omit<CategoryBreakdownRow, "sharePct">[] = [];

  for (const cid of allCategoryIds) {
    const meta = catMetaMap.get(cid) ?? {
      name: "Lainnya",
      color: "#94A3B8",
      sortOrder: 999,
    };
    const isSavings = isSavingsCategory(meta.name);
    if (!filters.includeSavings && isSavings) continue;

    const isSelected = !filters.excludedCategoryIds.has(cid);
    const items = (activeByCat.get(cid) ?? [])
      .slice()
      .sort((a, b) => Number(b.amount) - Number(a.amount));
    const amount = items.reduce((s, e) => s + Number(e.amount), 0);
    const prev = compByCat.get(cid) ?? { amount: 0, count: 0 };
    const budget = isPeriodBased ? budgetMap.get(cid) ?? 0 : 0;

    if (amount === 0 && prev.amount === 0 && budget === 0) continue;

    if (isSelected) {
      filteredTotal += amount;
    }

    const deltaAmount = amount - prev.amount;
    const deltaPct = prev.amount > 0 ? (deltaAmount / prev.amount) * 100 : null;
    const avgPerTx = items.length > 0 ? amount / items.length : 0;
    const budgetUsagePct = budget > 0 ? (amount / budget) * 100 : null;
    const budgetRemaining = budget > 0 ? budget - amount : null;

    draftRows.push({
      categoryId: cid,
      name: meta.name,
      color: meta.color,
      isSavings,
      isSelected,
      amount,
      prevAmount: prev.amount,
      deltaAmount,
      deltaPct,
      count: items.length,
      prevCount: prev.count,
      avgPerTx,
      budget,
      budgetUsagePct,
      budgetRemaining,
      expenses: items,
    });
  }

  const rows: CategoryBreakdownRow[] = draftRows.map((row) => ({
    ...row,
    sharePct: row.isSelected && filteredTotal > 0 ? (row.amount / filteredTotal) * 100 : 0,
  }));

  rows.sort((a, b) => b.amount - a.amount || b.budget - a.budget);

  return { rows, filteredTotal };
}

const WEEKDAY_META = [
  { shortLabel: "Sen", fullLabel: "Senin", isWeekend: false },
  { shortLabel: "Sel", fullLabel: "Selasa", isWeekend: false },
  { shortLabel: "Rab", fullLabel: "Rabu", isWeekend: false },
  { shortLabel: "Kam", fullLabel: "Kamis", isWeekend: false },
  { shortLabel: "Jum", fullLabel: "Jumat", isWeekend: false },
  { shortLabel: "Sab", fullLabel: "Sabtu", isWeekend: true },
  { shortLabel: "Min", fullLabel: "Minggu", isWeekend: true },
];

export function buildWeekdayStats(
  filteredExpenses: AnalysisExpense[],
  startDate: string,
  endDate: string
): {
  rows: WeekdayStatRow[];
  weekdayAvgPerDay: number;
  weekendAvgPerDay: number;
  maxDayIndex: number;
} {
  const totals = [0, 0, 0, 0, 0, 0, 0];
  const counts = [0, 0, 0, 0, 0, 0, 0];
  const occurrences = [0, 0, 0, 0, 0, 0, 0];

  let curr = startDate;
  while (curr <= endDate) {
    const jsDay = parseLocalDate(curr).getDay(); // 0=Sun..6=Sat
    const monFirst = (jsDay + 6) % 7;
    occurrences[monFirst] += 1;
    curr = addDays(curr, 1);
  }

  for (const e of filteredExpenses) {
    const jsDay = parseLocalDate(e.spent_at).getDay();
    const monFirst = (jsDay + 6) % 7;
    totals[monFirst] += Number(e.amount);
    counts[monFirst] += 1;
  }

  const rows: WeekdayStatRow[] = WEEKDAY_META.map((m, idx) => ({
    dayIndex: idx,
    shortLabel: m.shortLabel,
    fullLabel: m.fullLabel,
    total: totals[idx],
    count: counts[idx],
    occurrences: occurrences[idx],
    avgPerOccurrence: occurrences[idx] > 0 ? totals[idx] / occurrences[idx] : 0,
    isWeekend: m.isWeekend,
  }));

  let weekdayTotal = 0;
  let weekdayOcc = 0;
  let weekendTotal = 0;
  let weekendOcc = 0;
  let maxAvg = -1;
  let maxDayIndex = 0;

  for (const r of rows) {
    if (r.isWeekend) {
      weekendTotal += r.total;
      weekendOcc += r.occurrences;
    } else {
      weekdayTotal += r.total;
      weekdayOcc += r.occurrences;
    }
    if (r.avgPerOccurrence > maxAvg) {
      maxAvg = r.avgPerOccurrence;
      maxDayIndex = r.dayIndex;
    }
  }

  return {
    rows,
    weekdayAvgPerDay: weekdayOcc > 0 ? weekdayTotal / weekdayOcc : 0,
    weekendAvgPerDay: weekendOcc > 0 ? weekendTotal / weekendOcc : 0,
    maxDayIndex,
  };
}

export function computeAnalysisKPIs(params: {
  window: ResolvedWindow;
  filteredExpenses: AnalysisExpense[];
  filteredCompExpenses: AnalysisExpense[];
  categoryRows: CategoryBreakdownRow[];
  incomes: IncomeRow[];
}): AnalysisKPIs {
  const { window, filteredExpenses, filteredCompExpenses, categoryRows, incomes } = params;

  const total = filteredExpenses.reduce((s, e) => s + Number(e.amount), 0);
  const compTotal = filteredCompExpenses.reduce((s, e) => s + Number(e.amount), 0);
  const deltaAmount = total - compTotal;
  const deltaPct = compTotal > 0 ? (deltaAmount / compTotal) * 100 : null;

  const dailyAvg = total / Math.max(1, window.elapsedDays);
  const compDays = diffDaysInclusive(window.compStartDate, window.compEndDate);
  const compDailyAvg = compTotal / Math.max(1, compDays);

  const projectedTotal =
    window.isOngoing && window.elapsedDays < window.totalDays
      ? Math.round(dailyAvg * window.totalDays)
      : null;

  const dailyMap = new Map<string, { amount: number; count: number }>();
  for (const e of filteredExpenses) {
    const prev = dailyMap.get(e.spent_at) ?? { amount: 0, count: 0 };
    dailyMap.set(e.spent_at, {
      amount: prev.amount + Number(e.amount),
      count: prev.count + 1,
    });
  }

  const activeDaysCount = dailyMap.size;
  const activeDayAvg = activeDaysCount > 0 ? total / activeDaysCount : 0;

  let peakDay: AnalysisKPIs["peakDay"] = null;
  for (const [date, info] of dailyMap.entries()) {
    if (!peakDay || info.amount > peakDay.amount) {
      peakDay = { date, amount: info.amount, count: info.count };
    }
  }

  const selectedRows = categoryRows.filter((r) => r.isSelected);
  const budgetTotal = window.isPeriodBased
    ? selectedRows.reduce((s, r) => s + r.budget, 0)
    : 0;
  const budgetUsagePct =
    window.isPeriodBased && budgetTotal > 0 ? (total / budgetTotal) * 100 : null;
  const budgetRemaining =
    window.isPeriodBased && budgetTotal > 0 ? budgetTotal - total : null;

  const txCount = filteredExpenses.length;
  const compTxCount = filteredCompExpenses.length;
  const avgPerTx = txCount > 0 ? total / txCount : 0;
  const compAvgPerTx = compTxCount > 0 ? compTotal / compTxCount : 0;

  const sortedAmounts = filteredExpenses
    .map((e) => Number(e.amount))
    .sort((a, b) => a - b);
  let medianTx = 0;
  if (sortedAmounts.length > 0) {
    const mid = Math.floor(sortedAmounts.length / 2);
    medianTx =
      sortedAmounts.length % 2 === 0
        ? (sortedAmounts[mid - 1] + sortedAmounts[mid]) / 2
        : sortedAmounts[mid];
  }

  let maxTx: AnalysisKPIs["maxTx"] = null;
  for (const e of filteredExpenses) {
    if (!maxTx || Number(e.amount) > maxTx.amount) {
      maxTx = {
        id: e.id,
        description: e.description || "Tanpa nama",
        amount: Number(e.amount),
        spent_at: e.spent_at,
        categoryName: e.categories?.name || "Lainnya",
      };
    }
  }

  const incomeTotal = window.isPeriodBased
    ? incomes.reduce((s, i) => s + Number(i.amount), 0)
    : 0;
  const incomeRatioPct =
    window.isPeriodBased && incomeTotal > 0 ? (total / incomeTotal) * 100 : null;
  const netCashflow = window.isPeriodBased && incomeTotal > 0 ? incomeTotal - total : null;

  const topCatRow = selectedRows.slice().sort((a, b) => b.amount - a.amount)[0];
  const topCategory =
    topCatRow && topCatRow.amount > 0
      ? {
          categoryId: topCatRow.categoryId,
          name: topCatRow.name,
          color: topCatRow.color,
          amount: topCatRow.amount,
          sharePct: topCatRow.sharePct,
        }
      : null;

  return {
    total,
    compTotal,
    deltaAmount,
    deltaPct,
    projectedTotal,
    dailyAvg,
    compDailyAvg,
    activeDayAvg,
    activeDaysCount,
    budgetTotal,
    budgetUsagePct,
    budgetRemaining,
    txCount,
    compTxCount,
    avgPerTx,
    compAvgPerTx,
    medianTx,
    maxTx,
    incomeTotal,
    incomeRatioPct,
    netCashflow,
    peakDay,
    topCategory,
  };
}

export function buildDimensionSummary(params: {
  filteredExpenses: AnalysisExpense[];
  events: AnalysisEvent[];
  members: AnalysisMember[];
}): DimensionSummary {
  const { filteredExpenses, events, members } = params;
  const total = filteredExpenses.reduce((s, e) => s + Number(e.amount), 0);

  const eventMeta = new Map(events.map((ev) => [ev.id, ev]));
  const memberMeta = new Map(members.map((m) => [m.user_id, m.display_name]));

  let regularTotal = 0;
  let regularCount = 0;
  let eventTotal = 0;
  let eventCount = 0;
  let consumptionTotal = 0;
  let consumptionCount = 0;
  let savingsTotal = 0;
  let savingsCount = 0;

  const perEvent = new Map<string, { total: number; count: number }>();
  const perMember = new Map<string, { total: number; count: number }>();

  for (const e of filteredExpenses) {
    const amt = Number(e.amount);
    if (e.event_id) {
      eventTotal += amt;
      eventCount += 1;
      const cur = perEvent.get(e.event_id) ?? { total: 0, count: 0 };
      perEvent.set(e.event_id, { total: cur.total + amt, count: cur.count + 1 });
    } else {
      regularTotal += amt;
      regularCount += 1;
    }

    if (isSavingsCategory(e.categories?.name)) {
      savingsTotal += amt;
      savingsCount += 1;
    } else {
      consumptionTotal += amt;
      consumptionCount += 1;
    }

    const mKey = e.created_by || "unknown";
    const curM = perMember.get(mKey) ?? { total: 0, count: 0 };
    perMember.set(mKey, { total: curM.total + amt, count: curM.count + 1 });
  }

  const eventRows = Array.from(perEvent.entries())
    .map(([id, val]) => {
      const meta = eventMeta.get(id);
      return {
        id,
        name: meta?.name ?? "Event Lainnya",
        status: meta?.status ?? "completed",
        total: val.total,
        count: val.count,
        sharePct: total > 0 ? (val.total / total) * 100 : 0,
      };
    })
    .sort((a, b) => b.total - a.total);

  let unknownIdx = 1;
  const memberRows = Array.from(perMember.entries())
    .map(([userId, val]) => {
      let label = "Tidak tercatat";
      if (userId !== "unknown") {
        const name = memberMeta.get(userId);
        label = name && name.trim() ? name.trim() : `Anggota ${unknownIdx++}`;
      }
      return {
        userId,
        label,
        total: val.total,
        count: val.count,
        sharePct: total > 0 ? (val.total / total) * 100 : 0,
      };
    })
    .sort((a, b) => b.total - a.total);

  return {
    regularTotal,
    regularCount,
    eventTotal,
    eventCount,
    consumptionTotal,
    consumptionCount,
    savingsTotal,
    savingsCount,
    events: eventRows,
    members: memberRows,
  };
}

export function buildSmartInsights(params: {
  window: ResolvedWindow;
  kpis: AnalysisKPIs;
  categoryRows: CategoryBreakdownRow[];
  weekdayAvgPerDay: number;
  weekendAvgPerDay: number;
  formatIDR: (n: number) => string;
}): SmartInsight[] {
  const { window, kpis, categoryRows, weekdayAvgPerDay, weekendAvgPerDay, formatIDR } = params;
  const insights: SmartInsight[] = [];

  if (kpis.txCount === 0) {
    return [
      {
        id: "empty",
        tone: "neutral",
        text: "Belum ada transaksi yang cocok dengan kombinasi rentang tanggal dan filter aktif.",
      },
    ];
  }

  if (kpis.deltaPct !== null && kpis.compTotal > 0) {
    const absPct = Math.abs(kpis.deltaPct).toFixed(0);
    if (kpis.deltaPct > 8) {
      insights.push({
        id: "delta-up",
        tone: "warning",
        text: `Pengeluaran naik ${absPct}% (${formatIDR(kpis.deltaAmount)}) dibanding ${window.compLabel}.`,
      });
    } else if (kpis.deltaPct < -8) {
      insights.push({
        id: "delta-down",
        tone: "positive",
        text: `Lebih hemat ${absPct}% (${formatIDR(Math.abs(kpis.deltaAmount))}) dibanding ${window.compLabel}.`,
      });
    } else {
      insights.push({
        id: "delta-flat",
        tone: "neutral",
        text: `Total belanja relatif stabil (${kpis.deltaPct >= 0 ? "+" : ""}${kpis.deltaPct.toFixed(0)}%) dibanding ${window.compLabel}.`,
      });
    }
  }

  const overBudgetCats = categoryRows
    .filter((r) => r.isSelected && r.budgetUsagePct !== null && r.budgetUsagePct > 100)
    .sort((a, b) => (b.budgetUsagePct ?? 0) - (a.budgetUsagePct ?? 0));

  if (overBudgetCats.length > 0) {
    const topOver = overBudgetCats[0];
    insights.push({
      id: "overbudget",
      tone: "warning",
      text: `${topOver.name} sudah menembus ${topOver.budgetUsagePct?.toFixed(0)}% budget (+${formatIDR(Math.abs(topOver.budgetRemaining ?? 0))}).`,
    });
  } else if (kpis.topCategory) {
    insights.push({
      id: "top-cat",
      tone: "neutral",
      text: `${kpis.topCategory.name} menjadi pendorong utama dengan porsi ${kpis.topCategory.sharePct.toFixed(0)}% dari total terfilter.`,
    });
  }

  if (weekendAvgPerDay > 0 && weekdayAvgPerDay > 0 && weekendAvgPerDay >= weekdayAvgPerDay * 1.3) {
    const ratio = (weekendAvgPerDay / weekdayAvgPerDay).toFixed(1);
    insights.push({
      id: "weekend-spike",
      tone: "neutral",
      text: `Rata-rata belanja akhir pekan ${ratio}x lebih tinggi dari hari kerja (${formatIDR(Math.round(weekendAvgPerDay))} vs ${formatIDR(Math.round(weekdayAvgPerDay))}/hari).`,
    });
  }

  return insights.slice(0, 3);
}

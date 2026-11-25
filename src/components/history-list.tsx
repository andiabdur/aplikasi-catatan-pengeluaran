"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowUpRight,
  BarChart3,
  Check,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  Filter,
  Link2,
  Loader2,
  Pencil,
  PieChart as PieIcon,
  PiggyBank,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Target,
  Trash2,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatIDR, formatIDRInput, parseIDRInput } from "@/lib/format";
import {
  addDays,
  diffDaysInclusive,
  formatCompactIDR,
  formatDateShort,
  isSavingsCategory,
  parseLocalDate,
} from "@/lib/analysis";
import {
  currentPeriodLabelWithCustom,
  getPeriodRange,
  labelMonthKey,
  periodRangeTextWithCustom,
  shiftPeriod,
} from "@/lib/period";
import { PeriodSelector } from "@/components/period-selector";
import { CategoryBarChart, CategoryPieChart } from "@/components/expense-charts";
import { getCategoryIcon } from "@/components/category-icon";
import type { Category, Expense, Goal } from "@/lib/types";
import { cn } from "@/lib/utils";

type Row = Expense & {
  categories: { name: string; color: string | null } | null;
};

type EventRef = {
  id: string;
  name: string;
  status: string;
  start_date?: string;
  end_date?: string | null;
};

type MemberRef = {
  user_id: string;
  display_name: string | null;
};

type TimeMode = "period" | "3p" | "all" | "custom";
type SortMode = "newest" | "expensive" | "cheapest" | "oldest";
type ChartMode = "pie" | "bar";
type HistoryMetricKey =
  | "avg_tx"
  | "avg_day"
  | "max_tx"
  | "median_tx"
  | "active_days"
  | "top_cat";

const HISTORY_METRICS_KEY = "history_visible_metrics_v1";
const DEFAULT_HISTORY_METRICS: HistoryMetricKey[] = ["avg_tx", "avg_day", "max_tx"];

const HISTORY_METRIC_DEFS: { key: HistoryMetricKey; label: string }[] = [
  { key: "avg_tx", label: "Rata2 / Item" },
  { key: "avg_day", label: "Rata2 / Hari" },
  { key: "max_tx", label: "Tertinggi" },
  { key: "median_tx", label: "Median" },
  { key: "active_days", label: "Hari Aktif" },
  { key: "top_cat", label: "Top Kategori" },
];

function parseLabelMonth(str: string): Date {
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y || 1970, (m || 1) - 1, d || 1);
}

function formatGroupDateLabel(ymd: string, todayStr: string): string {
  if (ymd === todayStr) return "Hari Ini";
  if (ymd === addDays(todayStr, -1)) return "Kemarin";
  return parseLocalDate(ymd).toLocaleDateString("id-ID", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

async function fetchExpensesForRange(
  householdId: string,
  fromDate: string | null,
  toDate: string | null
): Promise<Row[]> {
  const supabase = createClient();
  const pageSize = 1000;
  let offset = 0;
  const result: Row[] = [];

  while (true) {
    let q = supabase
      .from("expenses")
      .select("*,categories(name,color)")
      .eq("household_id", householdId)
      .order("spent_at", { ascending: false })
      .order("created_at", { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (fromDate) q = q.gte("spent_at", fromDate);
    if (toDate) q = q.lte("spent_at", toDate);

    const { data, error } = await q;
    if (error || !data) break;
    result.push(...(data as unknown as Row[]));
    if (data.length < pageSize) break;
    offset += pageSize;
  }

  return result;
}

function EditExpenseRow({
  row,
  categories,
  activeEvents,
  goals = [],
  onSave,
  onCancel,
}: {
  row: Row;
  categories: Category[];
  activeEvents: EventRef[];
  goals?: Goal[];
  onSave: (patch: {
    description: string;
    category_id: string;
    amount: number;
    spent_at: string;
    event_id: string | null;
    goal_id: string | null;
    note: string | null;
  }) => Promise<void>;
  onCancel: () => void;
}) {
  const [desc, setDesc] = useState(row.description);
  const [note, setNote] = useState(row.note || "");
  const [catId, setCatId] = useState(row.category_id);
  const [spentAt, setSpentAt] = useState(row.spent_at);
  const [amtText, setAmtText] = useState(
    row.amount ? Number(row.amount).toLocaleString("id-ID") : ""
  );
  const [evtId, setEvtId] = useState(row.event_id || "");
  const [goalId, setGoalId] = useState(row.goal_id || "");
  const [saving, setSaving] = useState(false);

  const selectedCat = categories.find((c) => c.id === catId);
  const isSavings = isSavingsCategory(selectedCat?.name);
  const generalGoal = goals.find((g) => /general|umum/i.test(g.name));

  async function handleSubmit() {
    if (!desc.trim() || parseIDRInput(amtText) <= 0 || saving) return;
    setSaving(true);
    try {
      await onSave({
        description: desc.trim(),
        category_id: catId,
        amount: parseIDRInput(amtText),
        spent_at: spentAt,
        event_id: evtId || null,
        goal_id: isSavings ? goalId || generalGoal?.id || null : null,
        note: note.trim() ? note.trim() : null,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-3.5 space-y-2.5 bg-muted/45 border-t border-border">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <input
          type="text"
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          className="input text-base sm:text-xs py-1.5"
          autoFocus
          placeholder="Nama kebutuhan"
        />
        <input
          type="date"
          value={spentAt}
          onChange={(e) => setSpentAt(e.target.value)}
          className="input text-base sm:text-xs py-1.5 font-mono"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <select
          value={catId}
          onChange={(e) => setCatId(e.target.value)}
          className="input text-base sm:text-xs py-1.5"
        >
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">
            Rp
          </span>
          <input
            type="text"
            inputMode="numeric"
            value={amtText}
            onChange={(e) => setAmtText(formatIDRInput(e.target.value))}
            className="input pl-9 text-base sm:text-xs py-1.5 font-mono font-semibold text-right"
          />
        </div>
      </div>

      {isSavings && goals.length > 0 && (
        <div className="p-2.5 bg-accent/60 border border-brand-200 dark:border-brand-800/50 rounded-xl space-y-1.5">
          <label className="text-xs font-semibold text-foreground flex items-center gap-1">
            <Target className="w-3.5 h-3.5 text-primary" /> Alokasikan ke Goal Tabungan
          </label>
          <select
            value={goalId}
            onChange={(e) => setGoalId(e.target.value)}
            className="input text-base sm:text-xs py-1.5"
          >
            <option value="">Tabungan General (Default / Tanpa Target Khusus)</option>
            {goals
              .filter((g) => !/general|umum/i.test(g.name))
              .map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
          </select>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {activeEvents.length > 0 && (
          <select
            value={evtId}
            onChange={(e) => setEvtId(e.target.value)}
            className="input text-base sm:text-xs py-1.5"
          >
            <option value="">(Tanpa Event)</option>
            {activeEvents.map((evt) => (
              <option key={evt.id} value={evt.id}>
                Event: {evt.name}
              </option>
            ))}
          </select>
        )}
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Catatan tambahan (opsional)"
          className="input text-base sm:text-xs py-1.5"
        />
      </div>

      <div className="flex gap-2 pt-1">
        <button
          type="button"
          disabled={saving}
          onClick={handleSubmit}
          className="btn-primary flex-1 text-xs py-2 flex items-center justify-center gap-1.5"
        >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Menyimpan...
            </>
          ) : (
            <>
              <Check className="w-4 h-4" />
              Simpan
            </>
          )}
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={onCancel}
          className="btn-ghost text-xs py-2 px-4 border border-border"
        >
          Batal
        </button>
      </div>
    </div>
  );
}

export function HistoryList({
  events = [],
  goals = [],
  categories,
  members = [],
  householdId,
  payDay,
  todayStr: initialTodayStr,
  defaultLabelMonth: initialDefaultLabelMonth,
  initialLabelMonth,
  initialCatFilter = "",
  initialEvtFilter = "",
  customPeriods: initialCustomPeriods,
}: {
  events?: EventRef[];
  goals?: Goal[];
  categories: Category[];
  members?: MemberRef[];
  householdId: string;
  payDay: number;
  todayStr?: string;
  defaultLabelMonth?: string;
  initialLabelMonth: string;
  initialCatFilter?: string;
  initialEvtFilter?: string;
  customPeriods: { label_month: string; start_date: string; end_date: string }[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const todayStr = useMemo(() => {
    if (initialTodayStr) return initialTodayStr;
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate()
    ).padStart(2, "0")}`;
  }, [initialTodayStr]);

  const [customPeriods] = useState(initialCustomPeriods);
  const currentPeriodDate = useMemo(
    () =>
      initialDefaultLabelMonth
        ? parseLabelMonth(initialDefaultLabelMonth)
        : currentPeriodLabelWithCustom(payDay, customPeriods),
    [initialDefaultLabelMonth, payDay, customPeriods]
  );

  // Time & Window Controls
  const [timeMode, setTimeMode] = useState<TimeMode>("period");
  const [labelMonth, setLabelMonth] = useState<Date>(() => parseLabelMonth(initialLabelMonth));
  const [from, setFrom] = useState<string>(() => addDays(todayStr, -29));
  const [to, setTo] = useState<string>(todayStr);

  // Dynamic Filter Controls
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [showMetricPicker, setShowMetricPicker] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedCatIds, setSelectedCatIds] = useState<Set<string>>(() =>
    initialCatFilter ? new Set([initialCatFilter]) : new Set()
  );
  const [evtFilter, setEvtFilter] = useState<string>(initialEvtFilter || "all");
  const [memberFilter, setMemberFilter] = useState<string>("all");
  const [includeSavings, setIncludeSavings] = useState<boolean>(true);
  const [minAmountText, setMinAmountText] = useState<string>("");
  const [maxAmountText, setMaxAmountText] = useState<string>("");
  const [sortBy, setSortBy] = useState<SortMode>("newest");

  // Sync URL prop updates
  useEffect(() => {
    setEvtFilter(initialEvtFilter || "all");
  }, [initialEvtFilter]);

  useEffect(() => {
    if (initialLabelMonth) {
      setLabelMonth(parseLabelMonth(initialLabelMonth));
    }
  }, [initialLabelMonth]);

  useEffect(() => {
    setSelectedCatIds(initialCatFilter ? new Set([initialCatFilter]) : new Set());
  }, [initialCatFilter]);

  // Metrics Customization (persisted in localStorage)
  const [visibleMetrics, setVisibleMetrics] = useState<HistoryMetricKey[]>(DEFAULT_HISTORY_METRICS);
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(HISTORY_METRICS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as HistoryMetricKey[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          setVisibleMetrics(parsed);
        }
      }
    } catch {
      // Ignore storage error
    }
  }, []);

  function toggleMetricKey(key: HistoryMetricKey) {
    setVisibleMetrics((prev) => {
      const exists = prev.includes(key);
      if (exists && prev.length === 1) return prev;
      const next = exists ? prev.filter((k) => k !== key) : [...prev, key];
      try {
        window.localStorage.setItem(HISTORY_METRICS_KEY, JSON.stringify(next));
      } catch {
        // Ignore storage error
      }
      return next;
    });
  }

  function resetMetricKeys() {
    setVisibleMetrics(DEFAULT_HISTORY_METRICS);
    try {
      window.localStorage.setItem(HISTORY_METRICS_KEY, JSON.stringify(DEFAULT_HISTORY_METRICS));
    } catch {
      // Ignore storage error
    }
  }

  // Visualization, Edit, Selection, Delete State
  const [chartMode, setChartMode] = useState<ChartMode>("pie");
  const [chartOpen, setChartOpen] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [bulkEventMenuOpen, setBulkEventMenuOpen] = useState(false);
  const [bulkTargetEventId, setBulkTargetEventId] = useState<string>("");
  const [bulkUpdating, setBulkUpdating] = useState(false);

  const [deleteTargetIds, setDeleteTargetIds] = useState<string[] | null>(null);
  const [deleting, setDeleting] = useState(false);

  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isLongPressTriggeredRef = useRef(false);

  function startPress(id: string) {
    if (isSelectionMode) return;
    isLongPressTriggeredRef.current = false;
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = setTimeout(() => {
      isLongPressTriggeredRef.current = true;
      setIsSelectionMode(true);
      setSelectedIds(new Set([id]));
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        try {
          navigator.vibrate(40);
        } catch {
          // Ignore haptic failure
        }
      }
    }, 450);
  }

  function cancelPress() {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }

  function toggleSelection(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function exitSelectionMode() {
    setIsSelectionMode(false);
    setSelectedIds(new Set());
    setBulkEventMenuOpen(false);
  }

  const range = useMemo(() => {
    if (timeMode === "period") {
      const r = getPeriodRange(labelMonth, payDay, customPeriods);
      return { from: r.from, to: r.to };
    }
    if (timeMode === "3p") {
      const firstAnchor = shiftPeriod(labelMonth, -2);
      const startR = getPeriodRange(firstAnchor, payDay, customPeriods);
      const endR = getPeriodRange(labelMonth, payDay, customPeriods);
      return { from: startR.from, to: endR.to };
    }
    if (timeMode === "all") {
      return { from: null, to: null };
    }
    const safeFrom = from || null;
    const safeTo = to || null;
    if (safeFrom && safeTo && safeFrom > safeTo) {
      return { from: safeTo, to: safeFrom };
    }
    return { from: safeFrom, to: safeTo };
  }, [timeMode, labelMonth, payDay, customPeriods, from, to]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!householdId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      const data = await fetchExpensesForRange(householdId, range.from, range.to);
      if (!cancelled) {
        setRows(data);
        setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [householdId, range.from, range.to]);

  const eventMap = useMemo(() => new Map(events.map((e) => [e.id, e])), [events]);
  const goalMap = useMemo(() => new Map(goals.map((g) => [g.id, g])), [goals]);
  const memberLabelMap = useMemo(() => {
    const m = new Map<string, string>();
    members.forEach((mem, idx) => {
      m.set(mem.user_id, mem.display_name?.trim() || `Anggota ${idx + 1}`);
    });
    return m;
  }, [members]);

  const hasMultipleMembersInData = useMemo(() => {
    if (members.length > 1) return true;
    const ids = new Set(rows.map((r) => r.created_by).filter(Boolean));
    return ids.size > 1;
  }, [members.length, rows]);

  const minAmt = parseIDRInput(minAmountText);
  const maxAmt = parseIDRInput(maxAmountText);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = rows.filter((r) => {
      const catName = r.categories?.name ?? "";
      if (!includeSavings && isSavingsCategory(catName)) return false;

      if (selectedCatIds.size > 0 && !selectedCatIds.has(r.category_id)) {
        return false;
      }

      if (evtFilter === "__none__" && r.event_id) return false;
      if (evtFilter === "__events_only__" && !r.event_id) return false;
      if (
        evtFilter !== "all" &&
        evtFilter !== "" &&
        evtFilter !== "__none__" &&
        evtFilter !== "__events_only__" &&
        r.event_id !== evtFilter
      ) {
        return false;
      }

      if (memberFilter !== "all") {
        if (memberFilter === "unknown") {
          if (r.created_by) return false;
        } else if (r.created_by !== memberFilter) {
          return false;
        }
      }

      const amt = Number(r.amount);
      if (minAmt > 0 && amt < minAmt) return false;
      if (maxAmt > 0 && amt > maxAmt) return false;

      if (q) {
        const evtName = r.event_id ? eventMap.get(r.event_id)?.name ?? "" : "";
        const hay = `${r.description || ""} ${r.note || ""} ${catName} ${evtName} ${Math.round(
          amt
        )}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }

      return true;
    });

    if (sortBy === "newest") {
      return list; // Already sorted spent_at DESC, created_at DESC from query
    }
    const copy = list.slice();
    if (sortBy === "expensive") {
      copy.sort((a, b) => Number(b.amount) - Number(a.amount));
    } else if (sortBy === "cheapest") {
      copy.sort((a, b) => Number(a.amount) - Number(b.amount));
    } else if (sortBy === "oldest") {
      copy.sort(
        (a, b) =>
          a.spent_at.localeCompare(b.spent_at) ||
          a.created_at.localeCompare(b.created_at)
      );
    }
    return copy;
  }, [
    rows,
    includeSavings,
    selectedCatIds,
    evtFilter,
    memberFilter,
    minAmt,
    maxAmt,
    search,
    eventMap,
    sortBy,
  ]);

  const total = useMemo(
    () => filtered.reduce((s, r) => s + Number(r.amount), 0),
    [filtered]
  );

  // Dynamic Metrics computed over entire filtered dataset
  const dynamicMetrics = useMemo(() => {
    const count = filtered.length;
    const avgTx = count > 0 ? total / count : 0;

    const uniqueDays = new Set(filtered.map((r) => r.spent_at));
    const activeDays = uniqueDays.size;

    let spanDays = activeDays || 1;
    if (range.from && range.to) {
      const endClipped =
        range.from <= todayStr && todayStr <= range.to ? todayStr : range.to;
      spanDays = diffDaysInclusive(range.from, endClipped);
    } else if (count > 0) {
      let minDate = filtered[0].spent_at;
      let maxDate = filtered[0].spent_at;
      for (const r of filtered) {
        if (r.spent_at < minDate) minDate = r.spent_at;
        if (r.spent_at > maxDate) maxDate = r.spent_at;
      }
      spanDays = diffDaysInclusive(minDate, maxDate);
    }
    const avgDay = total / Math.max(1, spanDays);

    let maxTx: Row | null = null;
    for (const r of filtered) {
      if (!maxTx || Number(r.amount) > Number(maxTx.amount)) {
        maxTx = r;
      }
    }

    const sortedAmounts = filtered.map((r) => Number(r.amount)).sort((a, b) => a - b);
    let medianTx = 0;
    if (sortedAmounts.length > 0) {
      const mid = Math.floor(sortedAmounts.length / 2);
      medianTx =
        sortedAmounts.length % 2 === 0
          ? (sortedAmounts[mid - 1] + sortedAmounts[mid]) / 2
          : sortedAmounts[mid];
    }

    const catMap = new Map<string, { name: string; value: number; color: string }>();
    for (const r of filtered) {
      const key = r.category_id;
      const name = r.categories?.name ?? "Lainnya";
      const color = r.categories?.color ?? "#B85138";
      const cur = catMap.get(key) ?? { name, value: 0, color };
      cur.value += Number(r.amount);
      catMap.set(key, cur);
    }
    const catBreakdown = [...catMap.values()].sort((a, b) => b.value - a.value);
    const topCat = catBreakdown[0] ?? null;

    return {
      count,
      avgTx,
      avgDay,
      spanDays,
      activeDays,
      maxTx,
      medianTx,
      topCat,
      catBreakdown,
    };
  }, [filtered, total, range.from, range.to, todayStr]);

  const selectedSum = useMemo(() => {
    return rows
      .filter((r) => selectedIds.has(r.id))
      .reduce((acc, r) => acc + Number(r.amount), 0);
  }, [selectedIds, rows]);

  async function handleSave(
    id: string,
    patch: {
      description: string;
      category_id: string;
      amount: number;
      spent_at: string;
      event_id: string | null;
      goal_id: string | null;
      note: string | null;
    }
  ) {
    const supabase = createClient();
    const { data } = await supabase
      .from("expenses")
      .update(patch)
      .eq("id", id)
      .eq("household_id", householdId)
      .select("*,categories(name,color)")
      .single();

    if (data) {
      setRows((rs) => rs.map((r) => (r.id === id ? (data as unknown as Row) : r)));
    }
    setEditingId(null);
    startTransition(() => router.refresh());
  }

  async function handleConfirmDelete() {
    if (!deleteTargetIds || deleteTargetIds.length === 0) return;
    setDeleting(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("expenses")
        .delete()
        .in("id", deleteTargetIds)
        .eq("household_id", householdId);

      if (!error) {
        const delSet = new Set(deleteTargetIds);
        setRows((rs) => rs.filter((r) => !delSet.has(r.id)));
        setSelectedIds((prev) => {
          const next = new Set(prev);
          deleteTargetIds.forEach((id) => next.delete(id));
          if (next.size === 0) setIsSelectionMode(false);
          return next;
        });
        setDeleteTargetIds(null);
        startTransition(() => router.refresh());
      }
    } finally {
      setDeleting(false);
    }
  }

  async function handleBulkSetEvent() {
    if (selectedIds.size === 0) return;
    setBulkUpdating(true);
    try {
      const ids = Array.from(selectedIds);
      const nextEventId = bulkTargetEventId || null;
      const supabase = createClient();
      const { error } = await supabase
        .from("expenses")
        .update({ event_id: nextEventId })
        .in("id", ids)
        .eq("household_id", householdId);

      if (!error) {
        const idSet = new Set(ids);
        setRows((rs) =>
          rs.map((r) => (idSet.has(r.id) ? { ...r, event_id: nextEventId } : r))
        );
        setBulkEventMenuOpen(false);
        startTransition(() => router.refresh());
      }
    } finally {
      setBulkUpdating(false);
    }
  }

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  useEffect(() => {
    setCurrentPage(1);
  }, [
    timeMode,
    range.from,
    range.to,
    selectedCatIds,
    evtFilter,
    memberFilter,
    includeSavings,
    minAmt,
    maxAmt,
    search,
    sortBy,
  ]);

  const totalCount = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalCount);

  const paginatedItems = useMemo(
    () => filtered.slice(startIndex, endIndex),
    [filtered, startIndex, endIndex]
  );

  const isDateGrouped = sortBy === "newest" || sortBy === "oldest";

  const grouped = useMemo(() => {
    if (!isDateGrouped) return [];
    const map = new Map<string, Row[]>();
    for (const r of paginatedItems) {
      const list = map.get(r.spent_at) ?? [];
      list.push(r);
      map.set(r.spent_at, list);
    }
    return [...map.entries()];
  }, [paginatedItems, isDateGrouped]);

  function toggleCategoryId(id: string) {
    setSelectedCatIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function clearAllFilters() {
    setSearch("");
    setSelectedCatIds(new Set());
    setEvtFilter("all");
    setMemberFilter("all");
    setIncludeSavings(true);
    setMinAmountText("");
    setMaxAmountText("");
  }

  const hasEventFilter = evtFilter !== "all" && evtFilter !== "";
  const activeFilterCount =
    (selectedCatIds.size > 0 ? 1 : 0) +
    (hasEventFilter ? 1 : 0) +
    (memberFilter !== "all" ? 1 : 0) +
    (!includeSavings ? 1 : 0) +
    (minAmt > 0 || maxAmt > 0 ? 1 : 0) +
    (search.trim() ? 1 : 0);

  const isPeriodShifted =
    labelMonthKey(labelMonth) !== labelMonthKey(currentPeriodDate);

  const activeContextLabel = useMemo(() => {
    if (hasEventFilter) {
      if (evtFilter === "__none__") return "Tanpa Event";
      if (evtFilter === "__events_only__") return "Khusus Event";
      return eventMap.get(evtFilter)?.name ?? "Event";
    }
    if (timeMode === "all") return "Semua Waktu";
    if (timeMode === "3p" && range.from && range.to) {
      return `3 Periode (${formatDateShort(range.from)} - ${formatDateShort(range.to)})`;
    }
    if (timeMode === "custom") {
      if (range.from && range.to) {
        return `${formatDateShort(range.from)} - ${formatDateShort(range.to)}`;
      }
      return "Rentang Kustom";
    }
    return periodRangeTextWithCustom(labelMonth, payDay, customPeriods);
  }, [hasEventFilter, evtFilter, eventMap, timeMode, range.from, range.to, labelMonth, payDay, customPeriods]);

  const analysisLink = useMemo(() => {
    if (
      hasEventFilter &&
      evtFilter !== "__none__" &&
      evtFilter !== "__events_only__"
    ) {
      return `/analysis?event=${evtFilter}`;
    }
    return "/analysis";
  }, [hasEventFilter, evtFilter]);

  function renderTransactionRow(r: Row) {
    if (editingId === r.id) {
      return (
        <EditExpenseRow
          key={r.id}
          row={r}
          categories={categories}
          activeEvents={events}
          goals={goals}
          onSave={(patch) => handleSave(r.id, patch)}
          onCancel={() => setEditingId(null)}
        />
      );
    }

    const goal = r.goal_id ? goalMap.get(r.goal_id) : undefined;
    const evt = r.event_id ? eventMap.get(r.event_id) : undefined;
    const recorderName =
      hasMultipleMembersInData && r.created_by
        ? memberLabelMap.get(r.created_by)
        : undefined;

    return (
      <div
        key={r.id}
        className={cn(
          "flex items-start justify-between p-3.5 group select-none transition-colors hover:bg-muted/40 cursor-pointer",
          selectedIds.has(r.id) && "bg-accent/70"
        )}
        onTouchStart={() => startPress(r.id)}
        onTouchEnd={cancelPress}
        onTouchMove={cancelPress}
        onTouchCancel={cancelPress}
        onMouseDown={() => startPress(r.id)}
        onMouseUp={cancelPress}
        onMouseLeave={cancelPress}
        onClick={() => {
          if (isLongPressTriggeredRef.current) {
            isLongPressTriggeredRef.current = false;
            return;
          }
          if (isSelectionMode) {
            toggleSelection(r.id);
          }
        }}
      >
        <div className="min-w-0 flex-1 flex items-start gap-3">
          {isSelectionMode && (
            <div
              className={cn(
                "w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors mt-2",
                selectedIds.has(r.id)
                  ? "bg-primary border-primary text-primary-foreground"
                  : "bg-background border-input"
              )}
            >
              {selectedIds.has(r.id) && <Check className="w-3.5 h-3.5" />}
            </div>
          )}

          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
            style={{ backgroundColor: r.categories?.color ?? "#B85138" }}
          >
            {(() => {
              const Icon = getCategoryIcon(r.categories?.name ?? "");
              return <Icon className="w-4 h-4 text-white" />;
            })()}
          </div>

          <div className="min-w-0 flex-1">
            <p className="font-medium text-sm text-foreground whitespace-normal break-words leading-snug">
              {r.description || "Tanpa deskripsi"}
            </p>
            {r.note && (
              <p className="text-xs text-muted-foreground mt-0.5 break-words">{r.note}</p>
            )}
            <div className="flex items-center gap-1.5 mt-1 flex-wrap text-xs text-muted-foreground">
              <span>{r.categories?.name ?? "Lainnya"}</span>
              {!isDateGrouped && <span>&middot; {formatDateShort(r.spent_at)}</span>}
              {recorderName && <span>&middot; {recorderName}</span>}
              {goal && (
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800/60 flex items-center gap-1">
                  <Target className="w-3 h-3" />
                  {goal.name}
                </span>
              )}
              {evt && (
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground border border-border">
                  {evt.name}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0 ml-2.5 self-center sm:self-start sm:pt-0.5">
          <p className="font-mono font-semibold text-sm text-foreground mr-1 tabular-nums">
            {formatIDR(r.amount)}
          </p>
          {!isSelectionMode && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setEditingId(r.id);
                }}
                onTouchStart={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                className="min-h-[34px] min-w-[34px] rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                aria-label="Edit transaksi"
              >
                <Pencil className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setDeleteTargetIds([r.id]);
                }}
                onTouchStart={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                className="min-h-[34px] min-w-[34px] rounded-lg flex items-center justify-center text-muted-foreground hover:text-rose-700 dark:hover:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                aria-label="Hapus transaksi"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  const activeMetricDefs = HISTORY_METRIC_DEFS.filter((d) => visibleMetrics.includes(d.key));

  return (
    <div className="space-y-4 pb-12">
      {/* A. Control Dock: Cari, Rentang Waktu, Filter & Quick Controls */}
      <section className="bg-card border border-border p-4 rounded-2xl shadow-sm space-y-3">
        {/* Search + Filter Toggle */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari item, catatan, kategori, event..."
              className="w-full min-h-[42px] bg-background border border-input rounded-xl py-2 pl-10 pr-8 text-base sm:text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            {search && (
              <button
                type="button"
                aria-label="Hapus pencarian"
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full hover:bg-muted flex items-center justify-center text-muted-foreground"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => setShowFilterPanel((v) => !v)}
            className={cn(
              "min-h-[42px] px-3 rounded-xl border text-xs font-semibold inline-flex items-center gap-1.5 transition-colors shrink-0",
              showFilterPanel || activeFilterCount > 0
                ? "bg-accent text-accent-foreground border-primary/40"
                : "bg-background text-foreground border-border hover:bg-muted"
            )}
          >
            <Filter className="w-3.5 h-3.5" />
            <span>Filter</span>
            {activeFilterCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-primary text-primary-foreground text-[10px] font-mono">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        {/* 4 Time Mode Tabs */}
        <div className="grid grid-cols-4 gap-1 p-1 bg-muted rounded-xl border border-border">
          {[
            { id: "period" as const, label: "Periode" },
            { id: "3p" as const, label: "3 Periode" },
            { id: "all" as const, label: "Semua" },
            { id: "custom" as const, label: "Kustom" },
          ].map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setTimeMode(m.id)}
              className={cn(
                "min-h-[34px] py-1 text-xs rounded-lg transition-all truncate px-1",
                timeMode === m.id
                  ? "bg-card text-foreground font-semibold shadow-sm"
                  : "text-muted-foreground font-medium hover:text-foreground"
              )}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* Window Controls based on TimeMode */}
        {timeMode === "period" && (
          <div>
            <PeriodSelector
              labelMonth={labelMonth}
              payDay={payDay}
              onChange={setLabelMonth}
              customRangeText={periodRangeTextWithCustom(labelMonth, payDay, customPeriods)}
            />
            {isPeriodShifted && (
              <button
                type="button"
                onClick={() => setLabelMonth(currentPeriodDate)}
                className="mt-1.5 text-xs font-medium text-primary w-full text-center hover:underline py-1"
              >
                Ke periode sekarang
              </button>
            )}
          </div>
        )}

        {timeMode === "3p" && (
          <div className="flex items-center justify-between gap-2 bg-muted/50 border border-border rounded-xl px-3 py-2">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-foreground">3 Siklus Gajian</p>
              <p className="text-[11px] font-mono text-muted-foreground truncate">
                {range.from && range.to
                  ? `${formatDateShort(range.from)} - ${formatDateShort(range.to)}`
                  : ""}
              </p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                aria-label="Geser mundur"
                onClick={() => setLabelMonth((prev) => shiftPeriod(prev, -1))}
                className="w-8 h-8 rounded-lg border border-border bg-card hover:bg-muted flex items-center justify-center"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                aria-label="Geser maju"
                onClick={() => setLabelMonth((prev) => shiftPeriod(prev, 1))}
                className="w-8 h-8 rounded-lg border border-border bg-card hover:bg-muted flex items-center justify-center"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {timeMode === "all" && (
          <div className="bg-muted/45 border border-border rounded-xl px-3 py-2 flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              Menampilkan seluruh riwayat transaksi keluarga
            </span>
            <span className="font-mono font-semibold text-foreground">{rows.length} item</span>
          </div>
        )}

        {timeMode === "custom" && (
          <div className="space-y-2 pt-0.5">
            <div className="flex gap-1.5 flex-wrap">
              {[
                {
                  label: "7 Hari",
                  fn: () => {
                    setFrom(addDays(todayStr, -6));
                    setTo(todayStr);
                  },
                },
                {
                  label: "30 Hari",
                  fn: () => {
                    setFrom(addDays(todayStr, -29));
                    setTo(todayStr);
                  },
                },
                {
                  label: "Bulan Ini",
                  fn: () => {
                    setFrom(`${todayStr.slice(0, 7)}-01`);
                    setTo(todayStr);
                  },
                },
              ].map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={p.fn}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-secondary text-secondary-foreground border border-border hover:bg-muted"
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                  Dari
                </label>
                <input
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  className="w-full min-h-[40px] bg-background border border-input rounded-xl px-3 py-1.5 text-base sm:text-xs font-mono text-foreground"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                  Sampai
                </label>
                <input
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className="w-full min-h-[40px] bg-background border border-input rounded-xl px-3 py-1.5 text-base sm:text-xs font-mono text-foreground"
                />
              </div>
            </div>
          </div>
        )}

        {/* Quick Control Row */}
        <div className="flex items-center gap-1.5 flex-wrap pt-1">
          <select
            aria-label="Urutkan transaksi"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortMode)}
            className="min-h-[34px] px-2.5 py-1 rounded-xl border border-border bg-background text-xs font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="newest">Urut: Terbaru</option>
            <option value="expensive">Urut: Termahal</option>
            <option value="cheapest">Urut: Termurah</option>
            <option value="oldest">Urut: Terlama</option>
          </select>

          <button
            type="button"
            onClick={() => setIncludeSavings((v) => !v)}
            className={cn(
              "min-h-[34px] px-2.5 py-1 rounded-xl border text-xs font-medium inline-flex items-center gap-1 transition-colors",
              !includeSavings
                ? "bg-accent text-accent-foreground border-primary/40"
                : "bg-background text-muted-foreground border-border hover:text-foreground"
            )}
          >
            <PiggyBank className="w-3.5 h-3.5" />
            {includeSavings ? "Termasuk Nabung" : "Tanpa Nabung"}
          </button>

          <button
            type="button"
            onClick={() =>
              isSelectionMode ? exitSelectionMode() : setIsSelectionMode(true)
            }
            className={cn(
              "min-h-[34px] px-2.5 py-1 rounded-xl border text-xs font-medium inline-flex items-center gap-1 transition-colors",
              isSelectionMode
                ? "bg-foreground text-background border-foreground"
                : "bg-background text-muted-foreground border-border hover:text-foreground"
            )}
          >
            <CheckSquare className="w-3.5 h-3.5" />
            Pilih
          </button>

          <button
            type="button"
            onClick={() => setChartOpen((v) => !v)}
            className={cn(
              "min-h-[34px] px-2.5 py-1 rounded-xl border text-xs font-medium inline-flex items-center gap-1 transition-colors ml-auto",
              chartOpen
                ? "bg-accent text-accent-foreground border-primary/40"
                : "bg-background text-foreground border-border hover:bg-muted"
            )}
          >
            <PieIcon className="w-3.5 h-3.5 text-primary" />
            Grafik
          </button>
        </div>

        {/* Expandable Multi-Dimension Filter Drawer */}
        {showFilterPanel && (
          <div className="pt-3 border-t border-border space-y-3 animate-slide-up">
            {/* Multi-select Categories */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-muted-foreground">
                  Kategori ({selectedCatIds.size === 0 ? "Semua" : `${selectedCatIds.size} dipilih`})
                </span>
                {selectedCatIds.size > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedCatIds(new Set())}
                    className="text-[11px] font-semibold text-primary hover:underline"
                  >
                    Semua Kategori
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {categories.map((c) => {
                  const Icon = getCategoryIcon(c.name);
                  const active = selectedCatIds.has(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => toggleCategoryId(c.id)}
                      className={cn(
                        "px-2.5 py-1 rounded-xl text-xs font-medium inline-flex items-center gap-1.5 border transition-colors",
                        active
                          ? "bg-primary text-primary-foreground border-primary shadow-sm"
                          : "bg-background text-foreground border-border hover:bg-muted"
                      )}
                    >
                      <span
                        className="w-4 h-4 rounded-md flex items-center justify-center shrink-0"
                        style={{ backgroundColor: c.color ?? "#B85138" }}
                      >
                        <Icon className="w-2.5 h-2.5 text-white" />
                      </span>
                      {c.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Event & Member Filters */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                  Event / Perjalanan
                </label>
                <select
                  value={evtFilter === "" ? "all" : evtFilter}
                  onChange={(e) => setEvtFilter(e.target.value)}
                  className="w-full min-h-[40px] bg-background border border-input rounded-xl px-3 py-1.5 text-base sm:text-xs text-foreground"
                >
                  <option value="all">Semua (Reguler + Event)</option>
                  <option value="__none__">Reguler (Tanpa Event)</option>
                  <option value="__events_only__">Khusus Event Saja</option>
                  {events.map((evt) => (
                    <option key={evt.id} value={evt.id}>
                      Event: {evt.name}
                    </option>
                  ))}
                </select>
              </div>

              {hasMultipleMembersInData && (
                <div>
                  <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                    Pencatat / Anggota
                  </label>
                  <select
                    value={memberFilter}
                    onChange={(e) => setMemberFilter(e.target.value)}
                    className="w-full min-h-[40px] bg-background border border-input rounded-xl px-3 py-1.5 text-base sm:text-xs text-foreground"
                  >
                    <option value="all">Semua Anggota</option>
                    {members.map((m, idx) => (
                      <option key={m.user_id} value={m.user_id}>
                        {m.display_name?.trim() || `Anggota ${idx + 1}`}
                      </option>
                    ))}
                    {rows.some((r) => !r.created_by) && (
                      <option value="unknown">Tidak tercatat</option>
                    )}
                  </select>
                </div>
              )}
            </div>

            {/* Nominal Range */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-muted-foreground">
                  Filter Nominal
                </span>
                <div className="flex gap-1">
                  {[
                    { label: ">= 50rb", min: "50000" },
                    { label: ">= 100rb", min: "100000" },
                    { label: ">= 500rb", min: "500000" },
                  ].map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => {
                        setMinAmountText(formatIDRInput(preset.min));
                        setMaxAmountText("");
                      }}
                      className={cn(
                        "px-2 py-0.5 rounded-md text-[11px] font-medium border",
                        minAmountText === formatIDRInput(preset.min) && !maxAmountText
                          ? "bg-accent text-accent-foreground border-primary/40"
                          : "bg-background text-muted-foreground border-border"
                      )}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  value={minAmountText}
                  onChange={(e) => setMinAmountText(formatIDRInput(e.target.value))}
                  placeholder="Min Rp"
                  className="w-full min-h-[38px] bg-background border border-input rounded-xl px-3 py-1.5 text-base sm:text-xs font-mono text-foreground"
                />
                <input
                  type="text"
                  inputMode="numeric"
                  value={maxAmountText}
                  onChange={(e) => setMaxAmountText(formatIDRInput(e.target.value))}
                  placeholder="Max Rp"
                  className="w-full min-h-[38px] bg-background border border-input rounded-xl px-3 py-1.5 text-base sm:text-xs font-mono text-foreground"
                />
              </div>
            </div>
          </div>
        )}

        {/* Active Filter Chips Bar */}
        {activeFilterCount > 0 && (
          <div className="pt-2 border-t border-border flex items-center gap-1.5 flex-wrap">
            {Array.from(selectedCatIds).map((cid) => {
              const c = categories.find((x) => x.id === cid);
              return (
                <button
                  key={cid}
                  type="button"
                  onClick={() => toggleCategoryId(cid)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-accent text-accent-foreground"
                >
                  {c?.name ?? "Kategori"} <X className="w-3 h-3" />
                </button>
              );
            })}
            {hasEventFilter && (
              <button
                type="button"
                onClick={() => setEvtFilter("all")}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-accent text-accent-foreground"
              >
                {evtFilter === "__none__"
                  ? "Tanpa Event"
                  : evtFilter === "__events_only__"
                    ? "Khusus Event"
                    : `Event: ${eventMap.get(evtFilter)?.name ?? "Terpilih"}`}
                <X className="w-3 h-3" />
              </button>
            )}
            {memberFilter !== "all" && (
              <button
                type="button"
                onClick={() => setMemberFilter("all")}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-accent text-accent-foreground"
              >
                {memberFilter === "unknown"
                  ? "Pencatat: Tidak tercatat"
                  : memberLabelMap.get(memberFilter)}
                <X className="w-3 h-3" />
              </button>
            )}
            {!includeSavings && (
              <button
                type="button"
                onClick={() => setIncludeSavings(true)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-accent text-accent-foreground"
              >
                Tanpa Nabung <X className="w-3 h-3" />
              </button>
            )}
            {(minAmt > 0 || maxAmt > 0) && (
              <button
                type="button"
                onClick={() => {
                  setMinAmountText("");
                  setMaxAmountText("");
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-accent text-accent-foreground"
              >
                {minAmt > 0 ? `>=${formatCompactIDR(minAmt)}` : ""}
                {minAmt > 0 && maxAmt > 0 ? " " : ""}
                {maxAmt > 0 ? `<=${formatCompactIDR(maxAmt)}` : ""}
                <X className="w-3 h-3" />
              </button>
            )}
            {search.trim() && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-accent text-accent-foreground"
              >
                &quot;{search.trim()}&quot; <X className="w-3 h-3" />
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

      {/* B. Dynamic Metrics Summary Card */}
      <section
        id="history-list-top"
        className="bg-accent/65 border border-brand-200 dark:border-brand-800/40 rounded-2xl p-4 shadow-sm space-y-3"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-medium text-accent-foreground truncate">
              {activeContextLabel} &middot; {filtered.length} item
            </p>
            <p className="font-mono font-bold text-foreground text-2xl mt-0.5 tabular-nums">
              {formatIDR(total)}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowMetricPicker((v) => !v)}
            className={cn(
              "min-h-[34px] px-2.5 py-1 rounded-xl text-[11px] font-semibold border inline-flex items-center gap-1 transition-colors shrink-0",
              showMetricPicker
                ? "bg-foreground text-background border-foreground"
                : "bg-card text-foreground border-border hover:bg-muted"
            )}
          >
            <SlidersHorizontal className="w-3 h-3" />
            Atur Metrik
          </button>
        </div>

        {showMetricPicker && (
          <div className="p-2.5 bg-card border border-border rounded-xl space-y-2 animate-slide-up">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-foreground">
                Pilih Indikator Ringkasan
              </span>
              <button
                type="button"
                onClick={resetMetricKeys}
                className="text-[11px] font-medium text-primary hover:underline inline-flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" /> Reset
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {HISTORY_METRIC_DEFS.map((def) => {
                const active = visibleMetrics.includes(def.key);
                return (
                  <button
                    key={def.key}
                    type="button"
                    onClick={() => toggleMetricKey(def.key)}
                    className={cn(
                      "px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-colors",
                      active
                        ? "bg-accent text-accent-foreground border-primary/50"
                        : "bg-background text-muted-foreground border-border"
                    )}
                  >
                    {def.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Dynamic Metric Tiles */}
        <div
          className={cn(
            "grid gap-2",
            activeMetricDefs.length === 1
              ? "grid-cols-1"
              : activeMetricDefs.length === 2
                ? "grid-cols-2"
                : "grid-cols-3"
          )}
        >
          {activeMetricDefs.map((def) => {
            if (def.key === "avg_tx") {
              return (
                <div
                  key={def.key}
                  className="bg-card/90 border border-border rounded-xl px-2.5 py-2 min-w-0"
                >
                  <p className="text-[10px] text-muted-foreground truncate">Rata2 / Item</p>
                  <p className="font-mono text-xs font-bold text-foreground truncate tabular-nums mt-0.5">
                    {formatCompactIDR(dynamicMetrics.avgTx)}
                  </p>
                </div>
              );
            }
            if (def.key === "avg_day") {
              return (
                <div
                  key={def.key}
                  className="bg-card/90 border border-border rounded-xl px-2.5 py-2 min-w-0"
                >
                  <p className="text-[10px] text-muted-foreground truncate">
                    Rata2 / Hr ({dynamicMetrics.spanDays}h)
                  </p>
                  <p className="font-mono text-xs font-bold text-foreground truncate tabular-nums mt-0.5">
                    {formatCompactIDR(dynamicMetrics.avgDay)}
                  </p>
                </div>
              );
            }
            if (def.key === "max_tx") {
              return (
                <div
                  key={def.key}
                  className="bg-card/90 border border-border rounded-xl px-2.5 py-2 min-w-0"
                >
                  <p className="text-[10px] text-muted-foreground truncate">Tertinggi</p>
                  <p className="font-mono text-xs font-bold text-primary truncate tabular-nums mt-0.5">
                    {dynamicMetrics.maxTx ? formatCompactIDR(Number(dynamicMetrics.maxTx.amount)) : "0"}
                  </p>
                </div>
              );
            }
            if (def.key === "median_tx") {
              return (
                <div
                  key={def.key}
                  className="bg-card/90 border border-border rounded-xl px-2.5 py-2 min-w-0"
                >
                  <p className="text-[10px] text-muted-foreground truncate">Median</p>
                  <p className="font-mono text-xs font-bold text-foreground truncate tabular-nums mt-0.5">
                    {formatCompactIDR(dynamicMetrics.medianTx)}
                  </p>
                </div>
              );
            }
            if (def.key === "active_days") {
              return (
                <div
                  key={def.key}
                  className="bg-card/90 border border-border rounded-xl px-2.5 py-2 min-w-0"
                >
                  <p className="text-[10px] text-muted-foreground truncate">Hari Aktif</p>
                  <p className="font-mono text-xs font-bold text-foreground truncate tabular-nums mt-0.5">
                    {dynamicMetrics.activeDays} hari
                  </p>
                </div>
              );
            }
            return (
              <div
                key={def.key}
                className="bg-card/90 border border-border rounded-xl px-2.5 py-2 min-w-0"
              >
                <p className="text-[10px] text-muted-foreground truncate">Top Kategori</p>
                <p className="text-xs font-bold text-foreground truncate mt-0.5">
                  {dynamicMetrics.topCat
                    ? `${dynamicMetrics.topCat.name} (${
                        total > 0 ? Math.round((dynamicMetrics.topCat.value / total) * 100) : 0
                      }%)`
                    : "-"}
                </p>
              </div>
            );
          })}
        </div>

        {/* Mini Stacked Proportion Bar */}
        {dynamicMetrics.catBreakdown.length > 1 && total > 0 && (
          <div className="h-1.5 w-full rounded-full overflow-hidden flex bg-muted gap-[1px]">
            {dynamicMetrics.catBreakdown.map((c) => (
              <div
                key={c.name}
                style={{
                  width: `${Math.max(3, (c.value / total) * 100)}%`,
                  backgroundColor: c.color,
                }}
                title={`${c.name}: ${formatIDR(c.value)}`}
              />
            ))}
          </div>
        )}
      </section>

      {/* C. Inline Expandable Category Chart */}
      {chartOpen && filtered.length > 0 && (
        <section
          id="category-analysis-chart"
          className="bg-card border border-border rounded-2xl p-4 space-y-3 shadow-sm animate-slide-up"
        >
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div>
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <PieIcon className="w-4 h-4 text-primary" /> Proporsi Kategori
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Mengikuti filter aktif saat ini
              </p>
            </div>
            <div className="flex bg-muted rounded-xl p-1 border border-border">
              <button
                type="button"
                onClick={() => setChartMode("pie")}
                className={cn(
                  "p-1.5 rounded-lg transition-colors",
                  chartMode === "pie" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
                )}
                aria-label="Diagram lingkaran"
              >
                <PieIcon className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setChartMode("bar")}
                className={cn(
                  "p-1.5 rounded-lg transition-colors",
                  chartMode === "bar" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
                )}
                aria-label="Grafik batang"
              >
                <BarChart3 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {chartMode === "pie" ? (
            <CategoryPieChart data={dynamicMetrics.catBreakdown} total={total} />
          ) : (
            <CategoryBarChart data={dynamicMetrics.catBreakdown} total={total} />
          )}

          <div className="pt-2 border-t border-border flex justify-end">
            <Link
              href={analysisLink}
              className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
            >
              Buka Analisis Tren Lengkap <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </section>
      )}

      {/* D. Transactions List */}
      {loading ? (
        <div className="bg-card border border-border rounded-2xl p-8 text-center shadow-sm flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          Memuat riwayat transaksi...
        </div>
      ) : paginatedItems.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-8 text-center shadow-sm space-y-2">
          <p className="text-xs text-muted-foreground">
            Tidak ada pengeluaran yang cocok dengan filter saat ini.
          </p>
          {activeFilterCount > 0 && (
            <button
              type="button"
              onClick={clearAllFilters}
              className="text-xs font-semibold text-primary hover:underline"
            >
              Reset Semua Filter
            </button>
          )}
        </div>
      ) : isDateGrouped ? (
        grouped.map(([date, items]) => {
          const dayTotal = items.reduce((s, r) => s + Number(r.amount), 0);
          return (
            <div key={date} className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-semibold text-foreground">
                  {formatGroupDateLabel(date, todayStr)}
                  <span className="text-muted-foreground font-normal ml-1.5">
                    ({items.length})
                  </span>
                </span>
                <span className="font-mono text-xs font-medium text-muted-foreground tabular-nums">
                  {formatIDR(dayTotal)}
                </span>
              </div>
              <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm divide-y divide-border">
                {items.map((r) => renderTransactionRow(r))}
              </div>
            </div>
          );
        })
      ) : (
        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm divide-y divide-border">
          {paginatedItems.map((r) => renderTransactionRow(r))}
        </div>
      )}

      {/* E. Dynamic Pagination Bar */}
      {filtered.length > 0 && (
        <div className="bg-card border border-border rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
            <span>
              {startIndex + 1}-{endIndex} dari {totalCount} item
            </span>
            <span className="text-border">|</span>
            <div className="flex items-center gap-1.5">
              <span>Per hal:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="bg-background border border-input rounded-lg px-2 py-1 text-xs text-foreground font-medium focus:outline-none"
              >
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (safePage > 1) {
                  setCurrentPage(safePage - 1);
                  document.getElementById("history-list-top")?.scrollIntoView({ behavior: "smooth" });
                }
              }}
              disabled={safePage <= 1}
              className="w-9 h-9 rounded-xl border border-border bg-background text-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
              aria-label="Halaman sebelumnya"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <span className="px-2 text-xs font-mono font-semibold text-foreground">
              {safePage} / {totalPages}
            </span>

            <button
              type="button"
              onClick={() => {
                if (safePage < totalPages) {
                  setCurrentPage(safePage + 1);
                  document.getElementById("history-list-top")?.scrollIntoView({ behavior: "smooth" });
                }
              }}
              disabled={safePage >= totalPages}
              className="w-9 h-9 rounded-xl border border-border bg-background text-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
              aria-label="Halaman berikutnya"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* F. Multi-Select Action Dock */}
      {isSelectionMode && (
        <div className="fixed bottom-24 sm:bottom-8 left-1/2 -translate-x-1/2 z-40 w-[94%] max-w-md">
          <div className="bg-card text-card-foreground border border-border rounded-2xl p-3.5 shadow-xl space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-medium text-primary">
                  Terpilih {selectedIds.size} item
                </p>
                <p className="font-mono font-bold text-lg text-foreground tabular-nums truncate">
                  {formatIDR(selectedSum)}
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() =>
                    setSelectedIds((prev) => {
                      const next = new Set(prev);
                      paginatedItems.forEach((p) => next.add(p.id));
                      return next;
                    })
                  }
                  className="min-h-[36px] px-2.5 py-1.5 rounded-xl text-xs font-medium bg-secondary text-secondary-foreground border border-border hover:bg-muted"
                >
                  Pilih Hal.
                </button>
                <button
                  type="button"
                  onClick={exitSelectionMode}
                  className="min-h-[36px] px-3 py-1.5 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs rounded-xl shadow-sm"
                >
                  Tutup
                </button>
              </div>
            </div>

            {selectedIds.size > 0 && (
              <div className="pt-2 border-t border-border space-y-2">
                <div className="flex items-center gap-2">
                  {events.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setBulkEventMenuOpen((v) => !v)}
                      className="flex-1 min-h-[36px] px-3 py-1.5 rounded-xl border border-border bg-background hover:bg-muted text-xs font-semibold inline-flex items-center justify-center gap-1.5"
                    >
                      <Link2 className="w-3.5 h-3.5 text-primary" />
                      Atur Event
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setDeleteTargetIds(Array.from(selectedIds))}
                    className="flex-1 min-h-[36px] px-3 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60 hover:bg-rose-600 hover:text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Hapus ({selectedIds.size})
                  </button>
                </div>

                {bulkEventMenuOpen && (
                  <div className="flex items-center gap-2 pt-1">
                    <select
                      value={bulkTargetEventId}
                      onChange={(e) => setBulkTargetEventId(e.target.value)}
                      className="flex-1 min-h-[38px] bg-background border border-input rounded-xl px-2.5 py-1 text-base sm:text-xs text-foreground"
                    >
                      <option value="">(Lepas dari Event)</option>
                      {events.map((ev) => (
                        <option key={ev.id} value={ev.id}>
                          {ev.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={bulkUpdating}
                      onClick={handleBulkSetEvent}
                      className="min-h-[38px] px-3 rounded-xl bg-primary text-primary-foreground text-xs font-semibold inline-flex items-center gap-1 disabled:opacity-50"
                    >
                      {bulkUpdating ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        "Terapkan"
                      )}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* G. Warm Shadcn Delete Confirmation Modal */}
      {deleteTargetIds && deleteTargetIds.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl w-full max-w-sm p-5 shadow-xl space-y-4">
            <div className="space-y-1.5">
              <h3 className="font-semibold text-base text-foreground">
                {deleteTargetIds.length === 1
                  ? "Hapus pengeluaran ini?"
                  : `Hapus ${deleteTargetIds.length} pengeluaran terpilih?`}
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Tindakan ini akan menghapus data transaksi secara permanen dari catatan keluarga.
              </p>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setDeleteTargetIds(null)}
                className="flex-1 min-h-[42px] py-2 bg-secondary text-secondary-foreground font-medium text-xs rounded-xl border border-border hover:bg-muted transition-colors disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleConfirmDelete}
                className="flex-1 min-h-[42px] py-2 bg-destructive text-destructive-foreground hover:bg-destructive/90 font-semibold text-xs rounded-xl shadow-sm transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {deleting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Menghapus...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Hapus
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

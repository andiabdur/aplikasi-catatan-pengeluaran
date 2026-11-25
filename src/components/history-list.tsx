"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatIDR, formatIDRInput, parseIDRInput } from "@/lib/format";
import {
  currentPeriodLabelWithCustom,
  labelMonthKey,
  getPeriodRange,
  periodRangeTextWithCustom,
} from "@/lib/period";
import Link from "next/link";
import { PeriodSelector } from "@/components/period-selector";
import { CategoryPieChart, CategoryBarChart } from "@/components/expense-charts";
import { getCategoryIcon } from "@/components/category-icon";
import { Search, Trash2, X, PieChart as PieIcon, BarChart3, Pencil, Check, ArrowUpRight, ChevronLeft, ChevronRight, Target } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Category, Expense, Goal } from "@/lib/types";

function isSavingsCategory(name: string | undefined): boolean {
  if (!name) return false;
  return /nabung|tabung/i.test(name);
}

type Row = Expense & {
  categories: { name: string; color: string | null } | null;
};

type FilterMode = "period" | "custom";
type ChartMode = "pie" | "bar";

function parseLabelMonth(str: string): Date {
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function HistoryList({
  events = [],
  goals = [],
  categories,
  householdId,
  payDay,
  initialLabelMonth,
  initialCatFilter = "",
  initialEvtFilter = "",
  customPeriods: initialCustomPeriods,
}: {
  events?: { id: string; name: string; status: string; start_date?: string; end_date?: string | null }[];
  goals?: Goal[];
  categories: Category[];
  householdId: string;
  payDay: number;
  initialLabelMonth: string;
  initialCatFilter?: string;
  initialEvtFilter?: string;
  customPeriods: { label_month: string; start_date: string; end_date: string }[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [customPeriods] = useState(initialCustomPeriods);
  const [filterMode, setFilterMode] = useState<FilterMode>("period");
  const [labelMonth, setLabelMonth] = useState<Date>(() => parseLabelMonth(initialLabelMonth));
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [catFilter, setCatFilter] = useState<string>(initialCatFilter);
  const [evtFilter, setEvtFilter] = useState<string>(initialEvtFilter);

  useEffect(() => {
    if (initialEvtFilter !== undefined) {
      setEvtFilter(initialEvtFilter);
    }
  }, [initialEvtFilter]);

  useEffect(() => {
    if (initialLabelMonth) {
      setLabelMonth(parseLabelMonth(initialLabelMonth));
    }
  }, [initialLabelMonth]);

  useEffect(() => {
    if (initialCatFilter !== undefined) {
      setCatFilter(initialCatFilter);
    }
  }, [initialCatFilter]);

  const [search, setSearch] = useState("");
  const [chartMode, setChartMode] = useState<ChartMode>("pie");
  const [chartOpen, setChartOpen] = useState(true);

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
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
        } catch {}
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
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
      if (newSet.size === 0) setIsSelectionMode(false);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  }

  const selectedSum = useMemo(() => {
    return rows.filter((r) => selectedIds.has(r.id)).reduce((acc, r) => acc + Number(r.amount), 0);
  }, [selectedIds, rows]);

  const range = useMemo(() => {
    if (filterMode === "period") {
      const r = getPeriodRange(labelMonth, payDay, customPeriods);
      return {
        from: r.from,
        to: r.to,
      };
    }
    return { from: from || null, to: to || null };
  }, [filterMode, labelMonth, payDay, customPeriods, from, to]);

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
    if (evtFilter === "__none__") q = q.is("event_id", null);
    else if (evtFilter) q = q.eq("event_id", evtFilter);
    if (range.from) q = q.gte("spent_at", range.from);
    if (range.to) q = q.lte("spent_at", range.to);
    const { data } = await q;
    setRows((data ?? []) as Row[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catFilter, evtFilter, range.from, range.to, householdId]);

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

  async function handleSave(
    id: string,
    patch: {
      description: string;
      category_id: string;
      amount: number;
      spent_at: string;
      event_id: string | null;
      goal_id: string | null;
    },
  ) {
    const supabase = createClient();
    const { data } = await supabase
      .from("expenses")
      .update(patch)
      .eq("id", id)
      .select("*,categories(name,color)")
      .single();
    if (data) {
      setRows((rs) => rs.map((r) => (r.id === id ? (data as Row) : r)));
    }
    setEditingId(null);
    startTransition(() => {
      router.refresh();
    });
  }

  async function handleDelete(id: string) {
    if (!confirm("Hapus pengeluaran ini?")) return;
    const supabase = createClient();
    await supabase.from("expenses").delete().eq("id", id);
    setRows((rs) => rs.filter((r) => r.id !== id));
    startTransition(() => {
      router.refresh();
    });
  }

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  useEffect(() => {
    setCurrentPage(1);
  }, [catFilter, evtFilter, range.from, range.to, search]);

  const totalCount = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);

  const startIndex = (safePage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalCount);

  const paginatedItems = useMemo(() => {
    return filtered.slice(startIndex, endIndex);
  }, [filtered, startIndex, endIndex]);

  const grouped = useMemo(() => {
    const map = new Map<string, Row[]>();
    paginatedItems.forEach((r) => {
      if (!map.has(r.spent_at)) map.set(r.spent_at, []);
      map.get(r.spent_at)!.push(r);
    });
    return [...map.entries()];
  }, [paginatedItems]);

  function EditExpenseRow({
    row,
    categories: cats,
    activeEvents,
    goals: goalList = [],
    onSave,
    onCancel,
  }: {
    row: Row;
    categories: Category[];
    activeEvents: { id: string; name: string }[];
    goals?: Goal[];
    onSave: (patch: {
      description: string;
      category_id: string;
      amount: number;
      spent_at: string;
      event_id: string | null;
      goal_id: string | null;
    }) => void;
    onCancel: () => void;
  }) {
    const [desc, setDesc] = useState(row.description);
    const [catId, setCatId] = useState(row.category_id);
    const [spentAt, setSpentAt] = useState(row.spent_at);
    const [amtText, setAmtText] = useState(
      row.amount ? Number(row.amount).toLocaleString("id-ID") : "",
    );
    const [evtId, setEvtId] = useState(row.event_id || "");
    const [goalId, setGoalId] = useState(row.goal_id || "");

    const selectedCat = cats.find((c) => c.id === catId);
    const isSavings = isSavingsCategory(selectedCat?.name);
    const generalGoal = goalList.find((g) => /general|umum/i.test(g.name));

    return (
      <div className="p-3.5 space-y-2.5 bg-muted/40 border-t border-border">
        <div className="grid grid-cols-2 gap-2">
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
        <select
          value={catId}
          onChange={(e) => setCatId(e.target.value)}
          className="input text-base sm:text-xs py-1.5"
        >
          {cats.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        {isSavings && goalList.length > 0 && (
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
              {goalList.filter((g) => !/general|umum/i.test(g.name)).map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>
        )}
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
        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={() =>
              onSave({
                description: desc.trim(),
                category_id: catId,
                amount: parseIDRInput(amtText),
                spent_at: spentAt,
                event_id: evtId || null,
                goal_id: isSavings ? (goalId || generalGoal?.id || null) : null,
              })
            }
            className="btn-primary flex-1 text-xs py-2 flex items-center justify-center gap-1.5"
          >
            <Check className="w-4 h-4" /> Simpan
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="btn-ghost text-xs py-2 px-4 border border-border"
          >
            Batal
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter panel */}
      <div className="bg-card border border-border p-4 rounded-2xl shadow-sm space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari transaksi..."
            className="w-full min-h-[42px] bg-background border border-input rounded-xl py-2 pl-10 pr-4 text-base sm:text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        <div className="grid grid-cols-2 gap-1 p-1 bg-muted rounded-xl border border-border">
          <button
            type="button"
            onClick={() => setFilterMode("period")}
            className={cn(
              "min-h-[38px] py-1.5 text-xs rounded-lg transition-all",
              filterMode === "period"
                ? "bg-card text-foreground font-semibold shadow-sm"
                : "text-muted-foreground font-medium hover:text-foreground"
            )}
          >
            Periode Gajian
          </button>
          <button
            type="button"
            onClick={() => setFilterMode("custom")}
            className={cn(
              "min-h-[38px] py-1.5 text-xs rounded-lg transition-all",
              filterMode === "custom"
                ? "bg-card text-foreground font-semibold shadow-sm"
                : "text-muted-foreground font-medium hover:text-foreground"
            )}
          >
            Custom Tanggal
          </button>
        </div>

        {filterMode === "period" ? (
          <div>
            <PeriodSelector
              labelMonth={labelMonth}
              payDay={payDay}
              onChange={setLabelMonth}
              customRangeText={periodRangeTextWithCustom(labelMonth, payDay, customPeriods)}
            />
            {labelMonthKey(labelMonth) !== labelMonthKey(currentPeriodLabelWithCustom(payDay, customPeriods)) && (
              <button
                type="button"
                onClick={() => setLabelMonth(currentPeriodLabelWithCustom(payDay, customPeriods))}
                className="mt-1.5 text-xs font-medium text-primary w-full text-center hover:underline py-1"
              >
                Ke periode sekarang
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 pt-1">
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Dari</label>
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="w-full min-h-[40px] bg-background border border-input rounded-xl px-3 py-1.5 text-base sm:text-xs font-mono text-foreground"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Sampai</label>
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="w-full min-h-[40px] bg-background border border-input rounded-xl px-3 py-1.5 text-base sm:text-xs font-mono text-foreground"
              />
            </div>
          </div>
        )}

        {/* Category chips */}
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1 pt-1">
          <button
            type="button"
            onClick={() => setCatFilter("")}
            className={cn(
              "px-3 min-h-[34px] py-1 rounded-full text-xs font-medium whitespace-nowrap transition-all border",
              !catFilter
                ? "bg-primary text-primary-foreground border-primary shadow-sm"
                : "bg-secondary text-secondary-foreground border-border hover:bg-muted"
            )}
          >
            Semua
          </button>
          {categories.map((c) => {
            const Icon = getCategoryIcon(c.name);
            return (
              <button
                type="button"
                key={c.id}
                onClick={() => setCatFilter(c.id)}
                className={cn(
                  "px-3 min-h-[34px] py-1 rounded-full text-xs font-medium whitespace-nowrap flex items-center gap-1.5 transition-all border",
                  catFilter === c.id
                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                    : "bg-secondary text-secondary-foreground border-border hover:bg-muted"
                )}
              >
                <div
                  className="w-4 h-4 rounded-md flex items-center justify-center shrink-0"
                  style={{ backgroundColor: c.color ?? "#B85138" }}
                >
                  <Icon className="w-2.5 h-2.5 text-white" />
                </div>
                {c.name}
              </button>
            );
          })}
        </div>

        {/* Event chips */}
        {events && events.length > 0 && (
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
            <button
              type="button"
              onClick={() => setEvtFilter("")}
              className={cn(
                "px-3 min-h-[34px] py-1 rounded-full text-xs font-medium whitespace-nowrap transition-all border",
                !evtFilter
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "bg-secondary text-secondary-foreground border-border hover:bg-muted"
              )}
            >
              Semua Event
            </button>
            <button
              type="button"
              onClick={() => setEvtFilter("__none__")}
              className={cn(
                "px-3 min-h-[34px] py-1 rounded-full text-xs font-medium whitespace-nowrap transition-all border",
                evtFilter === "__none__"
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "bg-secondary text-secondary-foreground border-border hover:bg-muted"
              )}
            >
              Tanpa Event
            </button>
            {events.map((evt) => (
              <button
                type="button"
                key={evt.id}
                onClick={() => setEvtFilter(evt.id)}
                className={cn(
                  "px-3 min-h-[34px] py-1 rounded-full text-xs font-medium whitespace-nowrap flex items-center gap-1.5 transition-all border",
                  evtFilter === evt.id
                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                    : "bg-secondary text-secondary-foreground border-border hover:bg-muted"
                )}
              >
                {evt.name}
              </button>
            ))}
          </div>
        )}

        {(catFilter || evtFilter || search) && (
          <button
            type="button"
            onClick={() => {
              setCatFilter("");
              setEvtFilter("");
              setSearch("");
            }}
            className="text-xs font-medium text-rose-700 dark:text-rose-300 flex items-center gap-1 hover:underline pt-1"
          >
            <X className="w-3.5 h-3.5" /> Reset filter
          </button>
        )}
      </div>

      {/* Summary card */}
      <div
        id="history-list-top"
        className="bg-accent/70 border border-brand-200 dark:border-brand-800/40 rounded-2xl p-4 flex items-center justify-between shadow-sm"
      >
        <div>
          <p className="text-xs font-medium text-accent-foreground">
            {evtFilter && evtFilter !== "__none__"
              ? `${events?.find((e) => e.id === evtFilter)?.name ?? "Event"} · ${filtered.length} item`
              : `Total Pengeluaran (${filtered.length} item)`}
          </p>
          <p className="font-mono font-bold text-foreground text-2xl mt-0.5 tabular-nums">{formatIDR(total)}</p>
        </div>
        <button
          type="button"
          onClick={() => {
            const chartElem = document.getElementById("category-analysis-chart");
            if (chartElem) {
              chartElem.scrollIntoView({ behavior: "smooth" });
            } else {
              setChartOpen((v) => !v);
            }
          }}
          className="min-h-[38px] text-xs font-semibold text-foreground bg-card border border-border px-3.5 py-2 rounded-xl shadow-sm flex items-center gap-1.5 hover:bg-muted active:scale-95 transition-all"
        >
          <PieIcon className="w-4 h-4 text-primary" />
          <span>Chart</span>
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div className="bg-card border border-border rounded-2xl p-8 text-center shadow-sm">
          <p className="text-xs text-muted-foreground">Memuat riwayat transaksi...</p>
        </div>
      ) : grouped.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-8 text-center shadow-sm">
          <p className="text-xs text-muted-foreground">Tidak ada pengeluaran ditemukan.</p>
        </div>
      ) : (
        grouped.map(([date, items]) => {
          const dayTotal = items.reduce((s, r) => s + Number(r.amount), 0);
          return (
            <div key={date} className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-semibold text-foreground">
                  {new Date(date).toLocaleDateString("id-ID", {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
                <span className="font-mono text-xs font-medium text-muted-foreground tabular-nums">
                  {formatIDR(dayTotal)}
                </span>
              </div>
              <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm divide-y divide-border">
                {items.map((r) =>
                  editingId === r.id ? (
                    <EditExpenseRow
                      key={r.id}
                      row={r}
                      categories={categories}
                      activeEvents={events}
                      goals={goals}
                      onSave={(patch) => handleSave(r.id, patch)}
                      onCancel={() => setEditingId(null)}
                    />
                  ) : (
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
                            {r.description}
                          </p>
                          <div className="flex items-center gap-2 mt-1 flex-wrap text-xs text-muted-foreground">
                            <span>{r.categories?.name}</span>
                            {r.goal_id && (() => {
                              const g = goals?.find((item) => item.id === r.goal_id);
                              return g ? (
                                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800/60 flex items-center gap-1">
                                  <Target className="w-3 h-3" />
                                  {g.name}
                                </span>
                              ) : null;
                            })()}
                            {r.event_id && (() => {
                              const evt = events?.find((e) => e.id === r.event_id);
                              return evt ? (
                                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground border border-border">
                                  {evt.name}
                                </span>
                              ) : null;
                            })()}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0 ml-3 self-center sm:self-start sm:pt-0.5">
                        <p className="font-mono font-semibold text-sm text-foreground mr-1 tabular-nums">
                          {formatIDR(r.amount)}
                        </p>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingId(r.id);
                          }}
                          onTouchStart={(e) => e.stopPropagation()}
                          onMouseDown={(e) => e.stopPropagation()}
                          className="min-h-[34px] min-w-[34px] rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                          aria-label="Edit"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(r.id);
                          }}
                          onTouchStart={(e) => e.stopPropagation()}
                          onMouseDown={(e) => e.stopPropagation()}
                          className="min-h-[34px] min-w-[34px] rounded-lg flex items-center justify-center text-muted-foreground hover:text-rose-700 dark:hover:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                          aria-label="Hapus"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )
                )}
              </div>
            </div>
          );
        })
      )}

      {/* Dynamic Pagination Bar */}
      {filtered.length > 0 && (
        <div className="bg-card border border-border rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
            <span>
              {totalCount > 0 ? startIndex + 1 : 0}-{endIndex} dari {totalCount} item
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
                <option value={15}>15</option>
                <option value={30}>30</option>
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
                  const listElem = document.getElementById("history-list-top");
                  if (listElem) listElem.scrollIntoView({ behavior: "smooth" });
                }
              }}
              disabled={safePage <= 1}
              className="w-9 h-9 rounded-xl border border-border bg-background text-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
              title="Halaman Sebelumnya"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="flex items-center px-2 text-xs font-mono font-semibold text-foreground">
              <span>
                {safePage} / {totalPages}
              </span>
            </div>

            <button
              type="button"
              onClick={() => {
                if (safePage < totalPages) {
                  setCurrentPage(safePage + 1);
                  const listElem = document.getElementById("history-list-top");
                  if (listElem) listElem.scrollIntoView({ behavior: "smooth" });
                }
              }}
              disabled={safePage >= totalPages}
              className="w-9 h-9 rounded-xl border border-border bg-background text-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
              title="Halaman Selanjutnya"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Chart Section */}
      {chartOpen && filtered.length > 0 && (
        <div id="category-analysis-chart" className="bg-card border border-border rounded-2xl p-4 space-y-3 mt-6 shadow-sm">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div>
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <PieIcon className="w-4 h-4 text-primary" /> Analisis Visual Kategori
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">Proporsi per kategori</p>
            </div>
            <div className="flex bg-muted rounded-xl p-1 border border-border">
              <button
                type="button"
                onClick={() => setChartMode("pie")}
                className={cn(
                  "p-1.5 rounded-lg transition-colors",
                  chartMode === "pie" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
                )}
                aria-label="Pie chart"
                title="Diagram Lingkaran"
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
                aria-label="Bar chart"
                title="Grafik Batang"
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

          <div className="pt-2 border-t border-border flex justify-end">
            <Link
              href="/analysis"
              className="text-xs font-medium text-primary hover:underline flex items-center gap-1"
            >
              Lihat Tren Analisis Lengkap <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      )}

      {isSelectionMode && selectedIds.size > 0 && (
        <div className="fixed bottom-24 sm:bottom-8 left-1/2 -translate-x-1/2 z-50 w-[92%] max-w-sm">
          <div className="bg-card text-card-foreground border border-border rounded-2xl p-4 flex items-center justify-between shadow-xl">
            <div>
              <p className="text-xs font-medium text-primary">
                Terpilih {selectedIds.size} item
              </p>
              <p className="font-mono font-bold text-xl text-foreground mt-0.5 tabular-nums">
                {formatIDR(selectedSum)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setSelectedIds(new Set());
                setIsSelectionMode(false);
              }}
              className="min-h-[40px] px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs rounded-xl shadow-sm active:scale-95 transition-all"
            >
              Tutup
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

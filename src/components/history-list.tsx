"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatIDR, formatIDRInput, parseIDRInput } from "@/lib/format";
import {
  currentPeriodLabelWithCustom,
  labelMonthKey,
  isoDate,
  getPeriodRange,
  periodRangeTextWithCustom,
} from "@/lib/period";
import Link from "next/link";
import { PeriodSelector } from "@/components/period-selector";
import { CategoryPieChart, CategoryBarChart } from "@/components/expense-charts";
import { getCategoryIcon } from "@/components/category-icon";
import { Search, Trash2, X, PieChart as PieIcon, BarChart3, ChevronDown, ChevronUp, Pencil, Check, ArrowUpRight, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Category, Expense } from "@/lib/types";

type Row = Expense & {
  categories: { name: string; color: string | null } | null;
};

type FilterMode = "period" | "custom";
type ChartMode = "pie" | "bar";

export function HistoryList({
  events = [],
  categories,
  householdId,
  payDay,
  initialLabelMonth,
  initialCatFilter = "",
  customPeriods: initialCustomPeriods,
}: {
  events?: { id: string, name: string, status: string }[];
  categories: Category[];
  householdId: string;
  payDay: number;
  initialLabelMonth: string;
  initialCatFilter?: string;
  customPeriods: { label_month: string; start_date: string; end_date: string }[];
}) {
  const [customPeriods, setCustomPeriods] = useState(initialCustomPeriods);
  const [filterMode, setFilterMode] = useState<FilterMode>("period");
  const [labelMonth, setLabelMonth] = useState<Date>(new Date(initialLabelMonth));
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [catFilter, setCatFilter] = useState<string>(initialCatFilter);
  const [evtFilter, setEvtFilter] = useState<string>("");
  const [search, setSearch] = useState("");
  const [chartMode, setChartMode] = useState<ChartMode>("pie");
  const [chartOpen, setChartOpen] = useState(true);

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Selection mode states
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  
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
    return rows.filter(r => selectedIds.has(r.id)).reduce((acc, r) => acc + Number(r.amount), 0);
  }, [selectedIds, rows]);


  // Derive effective date range
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
    patch: { description: string; category_id: string; amount: number; spent_at: string },
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
  }

  async function handleDelete(id: string) {
    if (!confirm("Hapus pengeluaran ini?")) return;
    const supabase = createClient();
    await supabase.from("expenses").delete().eq("id", id);
    setRows((rs) => rs.filter((r) => r.id !== id));
  }

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  // Reset page when filters change
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

  // Group by date for current page
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
    onSave,
    onCancel,
  }: {
    row: Row;
    categories: Category[];
    activeEvents: { id: string, name: string }[];
    onSave: (patch: { description: string; category_id: string; amount: number; spent_at: string; event_id: string | null }) => void;
    onCancel: () => void;
  }) {
    const [desc, setDesc] = useState(row.description);
    const [catId, setCatId] = useState(row.category_id);
    const [spentAt, setSpentAt] = useState(row.spent_at);
    const [amtText, setAmtText] = useState(
      row.amount ? Number(row.amount).toLocaleString("id-ID") : "",
    );
    const [evtId, setEvtId] = useState(row.event_id || "");

    return (
      <div className="p-3.5 space-y-2.5 bg-slate-50 dark:bg-slate-950 border-t-4 border-slate-950 dark:border-slate-100">
        <div className="grid grid-cols-2 gap-2">
          <input
            type="text"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            className="input text-xs py-1.5 rounded-none border-2 border-slate-950 dark:border-slate-100 bg-white dark:bg-slate-950 font-headline font-bold uppercase"
            autoFocus
            placeholder="Nama kebutuhan"
          />
          <input
            type="date"
            value={spentAt}
            onChange={(e) => setSpentAt(e.target.value)}
            className="input text-xs py-1.5 rounded-none border-2 border-slate-950 dark:border-slate-100 bg-white dark:bg-slate-950 font-mono font-bold"
          />
        </div>
        <select
          value={catId}
          onChange={(e) => setCatId(e.target.value)}
          className="input text-xs py-1.5 rounded-none border-2 border-slate-950 dark:border-slate-100 bg-white dark:bg-slate-950 font-headline font-bold uppercase"
        >
          {cats.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        {activeEvents.length > 0 && (
          <select
            value={evtId}
            onChange={(e) => setEvtId(e.target.value)}
            className="input text-xs py-1.5 rounded-none border-2 border-slate-950 dark:border-slate-100 bg-white dark:bg-slate-950 font-headline font-bold uppercase"
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
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-headline font-black text-slate-950 dark:text-slate-100">
            Rp
          </span>
          <input
            type="text"
            inputMode="numeric"
            value={amtText}
            onChange={(e) => setAmtText(formatIDRInput(e.target.value))}
            className="input pl-9 text-xs py-1.5 font-mono font-bold text-right rounded-none border-2 border-slate-950 dark:border-slate-100 bg-white dark:bg-slate-950"
          />
        </div>
        <div className="flex gap-2 pt-1">
          <button
            onClick={() =>
              onSave({
                description: desc.trim(),
                category_id: catId,
                amount: parseIDRInput(amtText),
                spent_at: spentAt,
                event_id: evtId || null,
              })
            }
            className="btn-primary flex-1 text-xs py-2 flex items-center justify-center gap-1.5 font-headline font-bold rounded-none shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] uppercase"
          >
            <Check className="w-4 h-4" /> Simpan
          </button>
          <button
            onClick={onCancel}
            className="btn-ghost text-xs py-2 px-4 rounded-none border-2 border-slate-950 dark:border-slate-100 font-headline font-bold uppercase"
          >
            Batal
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter panel (Bauhaus V2 Style) */}
      <div className="bg-white dark:bg-surface-dark border-4 border-slate-950 dark:border-slate-100 p-4 rounded-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)] space-y-3">
        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-950 dark:text-slate-100 font-bold" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari transaksi, kategori, atau jumlah..."
            className="w-full bg-slate-50 dark:bg-slate-950 border-2 border-slate-950 dark:border-slate-100 rounded-none py-2.5 pl-10 pr-4 text-xs font-headline font-bold text-slate-950 dark:text-slate-100 focus:outline-none placeholder:text-slate-400 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,1)]"
          />
        </div>

        {/* Mode tabs */}
        <div className="grid grid-cols-2 gap-1.5 p-1 bg-white dark:bg-slate-950 border-2 border-slate-950 dark:border-slate-100">
          <button
            onClick={() => setFilterMode("period")}
            className={cn(
              "py-1.5 text-xs font-headline font-bold uppercase tracking-wider transition-all rounded-none",
              filterMode === "period"
                ? "bg-slate-950 text-white dark:bg-slate-100 dark:text-slate-950 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,1)]"
                : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-900"
            )}
          >
            Periode Gajian
          </button>
          <button
            onClick={() => setFilterMode("custom")}
            className={cn(
              "py-1.5 text-xs font-headline font-bold uppercase tracking-wider transition-all rounded-none",
              filterMode === "custom"
                ? "bg-slate-950 text-white dark:bg-slate-100 dark:text-slate-950 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,1)]"
                : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-900"
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
                onClick={() => setLabelMonth(currentPeriodLabelWithCustom(payDay, customPeriods))}
                className="mt-1.5 text-xs font-mono font-bold text-brand-600 dark:text-brand-400 w-full text-center hover:underline uppercase"
              >
                Ke periode sekarang
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 pt-1">
            <div>
              <label className="text-[11px] font-headline font-bold text-slate-950 dark:text-slate-100 uppercase tracking-wider">Dari</label>
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border-2 border-slate-950 dark:border-slate-100 rounded-none px-3 py-2 text-xs font-mono font-bold text-slate-950 dark:text-slate-100 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
              />
            </div>
            <div>
              <label className="text-[11px] font-headline font-bold text-slate-950 dark:text-slate-100 uppercase tracking-wider">Sampai</label>
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border-2 border-slate-950 dark:border-slate-100 rounded-none px-3 py-2 text-xs font-mono font-bold text-slate-950 dark:text-slate-100 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
              />
            </div>
          </div>
        )}

        {/* Category chips */}
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1 pt-1">
          <button
            onClick={() => setCatFilter("")}
            className={cn(
              "px-3 py-1.5 rounded-none text-xs font-headline font-bold uppercase tracking-wider whitespace-nowrap transition-all border-2 border-slate-950 dark:border-slate-100",
              !catFilter
                ? "bg-slate-950 text-white dark:bg-slate-100 dark:text-slate-950 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,1)]"
                : "bg-white dark:bg-surface-dark text-slate-950 dark:text-slate-100 shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] hover:bg-slate-100"
            )}
          >
            Semua
          </button>
          {categories.map((c) => {
            const Icon = getCategoryIcon(c.name);
            return (
              <button
                key={c.id}
                onClick={() => setCatFilter(c.id)}
                className={cn(
                  "px-3 py-1.5 rounded-none text-xs font-headline font-bold uppercase tracking-wider whitespace-nowrap flex items-center gap-1.5 transition-all border-2 border-slate-950 dark:border-slate-100",
                  catFilter === c.id
                    ? "bg-slate-950 text-white dark:bg-slate-100 dark:text-slate-950 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,1)]"
                    : "bg-white dark:bg-surface-dark text-slate-950 dark:text-slate-100 shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] hover:bg-slate-100"
                )}
              >
                <div
                  className="w-4 h-4 rounded-none flex items-center justify-center shrink-0 border border-slate-950"
                  style={{ backgroundColor: c.color ?? "#16a34a" }}
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
              onClick={() => setEvtFilter("")}
              className={cn(
                "px-3 py-1.5 rounded-none text-xs font-headline font-bold uppercase tracking-wider whitespace-nowrap transition-all border-2 border-slate-950 dark:border-slate-100",
                !evtFilter
                  ? "bg-slate-950 text-white dark:bg-slate-100 dark:text-slate-950 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                  : "bg-white dark:bg-surface-dark text-slate-950 dark:text-slate-100 shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]"
              )}
            >
              Semua Event
            </button>
            <button
              onClick={() => setEvtFilter("__none__")}
              className={cn(
                "px-3 py-1.5 rounded-none text-xs font-headline font-bold uppercase tracking-wider whitespace-nowrap transition-all border-2 border-slate-950 dark:border-slate-100",
                evtFilter === "__none__"
                  ? "bg-slate-950 text-white dark:bg-slate-100 dark:text-slate-950 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                  : "bg-white dark:bg-surface-dark text-slate-950 dark:text-slate-100 shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]"
              )}
            >
              Tanpa Event
            </button>
            {events.map((evt) => (
              <button
                key={evt.id}
                onClick={() => setEvtFilter(evt.id)}
                className={cn(
                  "px-3 py-1.5 rounded-none text-xs font-headline font-bold uppercase tracking-wider whitespace-nowrap flex items-center gap-1.5 transition-all border-2 border-slate-950 dark:border-slate-100",
                  evtFilter === evt.id
                    ? "bg-slate-950 text-white dark:bg-slate-100 dark:text-slate-950 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                    : "bg-white dark:bg-surface-dark text-slate-950 dark:text-slate-100 shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]"
                )}
              >
                {evt.name}
              </button>
            ))}
          </div>
        )}

        {(catFilter || evtFilter || search) && (
          <button
            onClick={() => {
              setCatFilter("");
              setEvtFilter("");
              setSearch("");
            }}
            className="text-xs font-mono font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1 hover:underline pt-1 uppercase"
          >
            <X className="w-3.5 h-3.5" /> Reset filter
          </button>
        )}
      </div>

      {/* Summary card (Bauhaus V2 Highlight) */}
      <div
        id="history-list-top"
        className="bg-brand-500 text-slate-950 border-4 border-slate-950 dark:border-slate-100 rounded-none p-4 flex items-center justify-between shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] dark:shadow-[6px_6px_0px_0px_rgba(255,255,255,1)]"
      >
        <div>
          <p className="text-[11px] font-headline font-black text-slate-950 uppercase tracking-wider">
            {evtFilter && evtFilter !== "__none__"
              ? `${events?.find((e) => e.id === evtFilter)?.name ?? "Event"} · ${filtered.length} item`
              : `Total Pengeluaran (${filtered.length} item)`}
          </p>
          <p className="font-headline font-black text-slate-950 text-2xl mt-0.5">{formatIDR(total)}</p>
        </div>
        <button
          onClick={() => {
            const chartElem = document.getElementById("category-analysis-chart");
            if (chartElem) {
              chartElem.scrollIntoView({ behavior: "smooth" });
            } else {
              setChartOpen((v) => !v);
            }
          }}
          className="text-xs font-headline font-bold text-slate-950 bg-white border-2 border-slate-950 px-3.5 py-2 rounded-none shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center gap-1.5 active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all uppercase tracking-wider"
        >
          <PieIcon className="w-4 h-4" />
          <span>Chart</span>
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div className="bg-white dark:bg-surface-dark border-4 border-slate-950 dark:border-slate-100 p-8 text-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <p className="text-xs font-mono font-bold uppercase tracking-wider text-slate-500">Memuat riwayat transaksi...</p>
        </div>
      ) : grouped.length === 0 ? (
        <div className="bg-white dark:bg-surface-dark border-4 border-slate-950 dark:border-slate-100 p-8 text-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <p className="text-xs font-mono font-bold uppercase tracking-wider text-slate-500">Tidak ada pengeluaran ditemukan.</p>
        </div>
      ) : (
        grouped.map(([date, items]) => {
          const dayTotal = items.reduce((s, r) => s + Number(r.amount), 0);
          return (
            <div key={date} className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <span className="font-headline text-xs font-black uppercase tracking-wider bg-brand-400 text-slate-950 border-2 border-slate-950 px-3 py-1 inline-block shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                  {new Date(date).toLocaleDateString("id-ID", {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
                <span className="font-mono text-xs font-bold text-slate-950 dark:text-slate-100 bg-white dark:bg-surface-dark border-2 border-slate-950 dark:border-slate-100 px-2.5 py-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,1)]">
                  {formatIDR(dayTotal)}
                </span>
              </div>
              <div className="bg-white dark:bg-surface-dark border-4 border-slate-950 dark:border-slate-100 rounded-none overflow-hidden shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)]">
                {items.map((r, itemIdx) =>
                  editingId === r.id ? (
                    <EditExpenseRow
                      key={r.id}
                      row={r}
                      categories={categories}
                      activeEvents={events}
                      onSave={(patch) => handleSave(r.id, patch)}
                      onCancel={() => setEditingId(null)}
                    />
                  ) : (
                    <div
                      key={r.id}
                      className={cn(
                        "flex items-center justify-between p-3.5 group select-none transition-colors hover:bg-slate-950 dark:hover:bg-slate-100 hover:text-white dark:hover:text-slate-950",
                        itemIdx !== items.length - 1 && "border-b-4 border-slate-950 dark:border-slate-100",
                        selectedIds.has(r.id) && "bg-brand-500/20"
                      )}
                      onClick={() => {
                        if (isSelectionMode) {
                          toggleSelection(r.id);
                        }
                      }}
                    >
                      <div className="min-w-0 flex-1 flex items-center gap-3">
                        {isSelectionMode && (
                          <div
                            className={cn(
                              "w-6 h-6 rounded-none border-2 border-slate-950 dark:border-slate-100 flex items-center justify-center shrink-0 transition-colors",
                              selectedIds.has(r.id)
                                ? "bg-brand-500 text-slate-950"
                                : "bg-white dark:bg-slate-950"
                            )}
                          >
                            {selectedIds.has(r.id) && <Check className="w-4 h-4 font-bold" />}
                          </div>
                        )}
                        <div
                          className="w-10 h-10 rounded-none flex items-center justify-center border-2 border-slate-950 dark:border-slate-100 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,1)] shrink-0"
                          style={{ backgroundColor: r.categories?.color ?? "#16a34a" }}
                        >
                          {(() => {
                            const Icon = getCategoryIcon(r.categories?.name ?? "");
                            return <Icon className="w-5 h-5 text-white" />;
                          })()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-headline font-bold text-sm text-slate-950 dark:text-slate-100 group-hover:text-white dark:group-hover:text-slate-950 uppercase tracking-wider truncate">
                            {r.description}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap text-xs text-slate-500 dark:text-slate-400 group-hover:text-slate-300 dark:group-hover:text-slate-700 font-mono uppercase">
                            <span>{r.categories?.name}</span>
                            {r.event_id && (() => {
                              const evt = events?.find((e) => e.id === r.event_id);
                              return evt ? (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-none bg-slate-950 text-white dark:bg-slate-100 dark:text-slate-950 border border-slate-950">
                                  {evt.name}
                                </span>
                              ) : null;
                            })()}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-3">
                        <p className="font-mono font-black text-sm text-slate-950 dark:text-slate-100 group-hover:text-white dark:group-hover:text-slate-950 mr-1">
                          {formatIDR(r.amount)}
                        </p>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingId(r.id);
                          }}
                          className="p-1.5 text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white rounded-none border border-transparent hover:border-slate-950 transition-colors"
                          aria-label="Edit"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(r.id);
                          }}
                          className="p-1.5 text-slate-600 dark:text-slate-400 hover:text-rose-600 rounded-none border border-transparent hover:border-rose-600 transition-colors"
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
        <div className="bg-white dark:bg-surface-dark border-4 border-slate-950 dark:border-slate-100 rounded-none flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)]">
          <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase text-slate-700 dark:text-slate-300">
            <span>
              {totalCount > 0 ? startIndex + 1 : 0}–{endIndex} dari {totalCount} item
            </span>
            <span className="text-slate-400">|</span>
            <div className="flex items-center gap-1">
              <span>Per page:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="bg-slate-50 dark:bg-slate-950 border-2 border-slate-950 dark:border-slate-100 rounded-none px-2 py-0.5 text-xs text-slate-950 dark:text-slate-100 font-bold focus:outline-none"
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
              className="p-1.5 rounded-none border-2 border-slate-950 dark:border-slate-100 bg-white dark:bg-slate-950 text-slate-950 dark:text-slate-100 disabled:opacity-40 disabled:cursor-not-allowed shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all"
              title="Halaman Sebelumnya"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="flex items-center px-2 text-xs font-mono font-bold text-slate-950 dark:text-slate-100">
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
              className="p-1.5 rounded-none border-2 border-slate-950 dark:border-slate-100 bg-white dark:bg-slate-950 text-slate-950 dark:text-slate-100 disabled:opacity-40 disabled:cursor-not-allowed shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all"
              title="Halaman Selanjutnya"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Chart Section */}
      {chartOpen && filtered.length > 0 && (
        <div id="category-analysis-chart" className="bg-white dark:bg-surface-dark border-4 border-slate-950 dark:border-slate-100 rounded-none p-4 space-y-3 mt-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] dark:shadow-[6px_6px_0px_0px_rgba(255,255,255,1)]">
          <div className="flex items-center justify-between border-b-4 border-slate-950 dark:border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-headline font-bold text-slate-950 dark:text-slate-100 uppercase tracking-wider flex items-center gap-1.5">
                <PieIcon className="w-4 h-4 text-brand-500" /> Analisis Visual Kategori
              </h3>
              <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400 uppercase tracking-wider mt-0.5">Proporsi per kategori</p>
            </div>
            <div className="flex bg-slate-50 dark:bg-slate-950 rounded-none p-1 border-2 border-slate-950 dark:border-slate-100 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              <button
                onClick={() => setChartMode("pie")}
                className={cn(
                  "p-1.5 rounded-none transition font-bold",
                  chartMode === "pie" ? "bg-slate-950 text-white dark:bg-slate-100 dark:text-slate-950" : "text-slate-500"
                )}
                aria-label="Pie chart"
                title="Diagram Lingkaran"
              >
                <PieIcon className="w-4 h-4" />
              </button>
              <button
                onClick={() => setChartMode("bar")}
                className={cn(
                  "p-1.5 rounded-none transition font-bold",
                  chartMode === "bar" ? "bg-slate-950 text-white dark:bg-slate-100 dark:text-slate-950" : "text-slate-500"
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

          <div className="pt-2 border-t-2 border-slate-950 dark:border-slate-100 flex justify-end">
            <Link
              href="/analysis"
              className="text-xs font-mono font-bold text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-1 uppercase tracking-wider"
            >
              Lihat Tren Analisis Lengkap <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      )}

      {isSelectionMode && selectedIds.size > 0 && (
        <div className="fixed bottom-24 sm:bottom-8 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-sm">
          <div className="bg-slate-950 text-white border-4 border-slate-100 p-4 flex items-center justify-between shadow-[6px_6px_0px_0px_rgba(255,255,255,1)]">
            <div>
              <p className="text-xs font-mono uppercase text-slate-400 font-bold">Terpilih {selectedIds.size} item</p>
              <p className="font-headline font-black text-xl text-brand-400">{formatIDR(selectedSum)}</p>
            </div>
            <button
              onClick={() => {
                setSelectedIds(new Set());
                setIsSelectionMode(false);
              }}
              className="px-4 py-2 bg-white text-slate-950 font-headline font-bold text-xs uppercase border-2 border-white shadow-[2px_2px_0px_0px_rgba(255,255,255,0.5)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all"
            >
              Tutup
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

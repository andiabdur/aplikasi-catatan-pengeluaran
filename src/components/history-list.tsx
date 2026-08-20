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
      <div className="p-3 space-y-2 bg-slate-50 dark:bg-slate-900/80 border-t border-slate-200 dark:border-slate-800">
        <div className="grid grid-cols-2 gap-2">
          <input
            type="text"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            className="input text-sm py-1.5 rounded-xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950"
            autoFocus
            placeholder="Nama kebutuhan"
          />
          <input
            type="date"
            value={spentAt}
            onChange={(e) => setSpentAt(e.target.value)}
            className="input text-sm py-1.5 rounded-xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 font-mono"
          />
        </div>
        <select
          value={catId}
          onChange={(e) => setCatId(e.target.value)}
          className="input text-sm py-1.5 rounded-xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950"
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
            className="input text-sm py-1.5 rounded-xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950"
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
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono font-bold text-brand-600 dark:text-brand-400">
            Rp
          </span>
          <input
            type="text"
            inputMode="numeric"
            value={amtText}
            onChange={(e) => setAmtText(formatIDRInput(e.target.value))}
            className="input pl-9 text-sm py-1.5 font-mono font-bold text-right rounded-xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950"
          />
        </div>
        <div className="flex gap-2 pt-1">
          <button
            onClick={() =>
              onSave({
                description: desc.trim(),
                category_id: catId,
                amount: parseIDRInput(amtText),
                spent_at: spentAt, event_id: evtId || null,
              })
            }
            className="btn-primary flex-1 text-sm py-2 flex items-center justify-center gap-1.5 font-bold rounded-xl shadow-sm"
          >
            <Check className="w-4 h-4" /> Simpan
          </button>
          <button onClick={onCancel} className="btn-ghost text-sm py-2 px-4 rounded-xl border border-slate-200 dark:border-slate-800">
            Batal
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3.5">
      {/* Filter panel */}
      <div className="neo-card p-4 space-y-3">
        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari transaksi, kategori, atau jumlah..."
            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl py-2.5 pl-10 pr-4 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 placeholder:text-slate-400 transition-colors"
          />
        </div>

        {/* Mode tabs */}
        <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
          <button
            onClick={() => setFilterMode("period")}
            className={cn(
              "py-1.5 text-xs font-bold rounded-lg transition-all",
              filterMode === "period" ? "bg-white dark:bg-slate-900 shadow-sm text-brand-600 dark:text-brand-400" : "text-slate-500 dark:text-slate-400",
            )}
          >
            Periode Gajian
          </button>
          <button
            onClick={() => setFilterMode("custom")}
            className={cn(
              "py-1.5 text-xs font-bold rounded-lg transition-all",
              filterMode === "custom" ? "bg-white dark:bg-slate-900 shadow-sm text-brand-600 dark:text-brand-400" : "text-slate-500 dark:text-slate-400",
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
                className="mt-1.5 text-xs font-semibold text-brand-600 dark:text-brand-400 w-full text-center hover:underline"
              >
                Ke periode sekarang
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 pt-1">
            <div>
              <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase">Dari</label>
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase">Sampai</label>
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>
        )}

        {/* Category chips */}
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1 pt-1">
          <button
            onClick={() => setCatFilter("")}
            className={cn(
              "px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all",
              !catFilter ? "bg-brand-600 text-white shadow-sm" : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700",
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
                  "px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap flex items-center gap-1.5 transition-all border",
                  catFilter === c.id
                    ? "bg-brand-600 text-white border-brand-600 shadow-sm"
                    : "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700",
                )}
              >
                <Icon
                  className="w-3.5 h-3.5 shrink-0"
                  style={{ color: catFilter === c.id ? "#ffffff" : c.color ?? "#94a3b8" }}
                />
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
                "px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all",
                !evtFilter ? "bg-indigo-600 text-white shadow-sm" : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700",
              )}
            >
              Semua Event
            </button>
            <button
              onClick={() => setEvtFilter("__none__")}
              className={cn(
                "px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border",
                evtFilter === "__none__" ? "bg-indigo-600 text-white border-indigo-600 shadow-sm" : "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300",
              )}
            >
              Tanpa Event
            </button>
            {events.map((evt) => (
              <button
                key={evt.id}
                onClick={() => setEvtFilter(evt.id)}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap flex items-center gap-1.5 transition-all border",
                  evtFilter === evt.id ? "bg-indigo-600 text-white border-indigo-600 shadow-sm" : "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300",
                )}
              >
                {evt.name}
                {evt.status === "active" && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                )}
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
            className="text-xs font-semibold text-rose-500 dark:text-rose-400 flex items-center gap-1 hover:underline pt-1"
          >
            <X className="w-3.5 h-3.5" /> Reset filter
          </button>
        )}
      </div>

      {/* Summary card */}
      <div id="history-list-top" className="neo-card p-4 flex items-center justify-between bg-brand-500/10 border-brand-500/30">
        <div>
          <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            {evtFilter && evtFilter !== "__none__"
              ? `${events?.find(e => e.id === evtFilter)?.name ?? "Event"} · ${filtered.length} item`
              : `Total Pengeluaran (${filtered.length} item)`}
          </p>
          <p className="font-mono font-bold text-brand-600 dark:text-brand-400 text-xl mt-0.5">{formatIDR(total)}</p>
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
          className="text-xs font-bold text-brand-700 dark:text-brand-300 bg-white dark:bg-slate-800 px-3.5 py-2 rounded-xl border border-brand-500/30 shadow-sm flex items-center gap-1.5 hover:bg-slate-50 dark:hover:bg-slate-700 transition active:scale-95"
        >
          <PieIcon className="w-4 h-4" />
          <span>Lihat Chart</span>
        </button>
      </div>

      {/* List */}
      {loading ? (
        <p className="text-center text-sm font-medium text-slate-500 dark:text-slate-400 py-8">Memuat data...</p>
      ) : grouped.length === 0 ? (
        <p className="text-center text-sm font-medium text-slate-500 dark:text-slate-400 py-8">Tidak ada pengeluaran ditemukan.</p>
      ) : (
        grouped.map(([date, items]) => {
          const dayTotal = items.reduce((s, r) => s + Number(r.amount), 0);
          return (
            <div key={date} className="space-y-1.5">
              <div className="flex items-center justify-between px-1 py-1">
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  {new Date(date).toLocaleDateString("id-ID", {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </p>
                <p className="text-xs font-mono font-bold text-slate-500 dark:text-slate-400">{formatIDR(dayTotal)}</p>
              </div>
              <div className="neo-card divide-y divide-slate-100 dark:divide-slate-800/80 p-0 overflow-hidden">
                {items.map((r) =>
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
                      className={`flex items-center justify-between p-3.5 group select-none transition-colors hover:bg-slate-50/50 dark:hover:bg-slate-800/30 ${selectedIds.has(r.id) ? 'bg-indigo-50/80 dark:bg-indigo-950/40 relative before:absolute before:inset-0 before:border-2 before:border-indigo-400 before:pointer-events-none before:z-10' : ''}`}
                      onTouchStart={() => {
                        const t = setTimeout(() => {
                          if (!isSelectionMode) setIsSelectionMode(true);
                          toggleSelection(r.id);
                        }, 500);
                        (r as any)._timer = t;
                      }}
                      onTouchEnd={() => clearTimeout((r as any)._timer)}
                      onTouchMove={() => clearTimeout((r as any)._timer)}
                      onMouseDown={() => {
                        const t = setTimeout(() => {
                          if (!isSelectionMode) setIsSelectionMode(true);
                          toggleSelection(r.id);
                        }, 500);
                        (r as any)._timer = t;
                      }}
                      onMouseUp={() => clearTimeout((r as any)._timer)}
                      onMouseLeave={() => clearTimeout((r as any)._timer)}
                      onClick={() => {
                        if (isSelectionMode) {
                          toggleSelection(r.id);
                        }
                      }}
                    >
                      <div className="min-w-0 flex-1 flex items-center gap-3">
                        {isSelectionMode && (
                          <div className={cn("w-5 h-5 rounded-lg border-2 flex items-center justify-center shrink-0 transition-colors", selectedIds.has(r.id) ? "bg-indigo-600 border-indigo-600 text-white" : "border-slate-300 dark:border-slate-700")}>
                            {selectedIds.has(r.id) && <Check className="w-3.5 h-3.5" />}
                          </div>
                        )}
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center border border-slate-200 dark:border-slate-800 shadow-sm shrink-0"
                          style={{ backgroundColor: `${r.categories?.color ?? "#94a3b8"}15` }}
                        >
                          {(() => {
                            const Icon = getCategoryIcon(r.categories?.name ?? "");
                            return (
                              <Icon
                                className="w-5 h-5 shrink-0"
                                style={{ color: r.categories?.color ?? "#94a3b8" }}
                              />
                            );
                          })()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-sm text-slate-900 dark:text-slate-100 truncate">{r.description}</p>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap text-xs text-slate-500 dark:text-slate-400">
                            <span className="font-medium">{r.categories?.name}</span>
                            {r.event_id && (() => {
                              const evt = events?.find(e => e.id === r.event_id);
                              return evt ? (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                                  {evt.name}
                                </span>
                              ) : null;
                            })()}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0 ml-3">
                        <p className="font-mono font-bold text-sm text-slate-900 dark:text-slate-100 mr-1">{formatIDR(r.amount)}</p>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingId(r.id);
                          }}
                          className="p-1.5 text-slate-400 hover:text-brand-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                          aria-label="Edit"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(r.id);
                          }}
                          className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                          aria-label="Hapus"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ),
                )}
              </div>
            </div>
          );
        })
      )}

      {/* Dynamic Pagination Bar */}
      {filtered.length > 0 && (
        <div className="neo-card flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 bg-slate-50 dark:bg-slate-900/60">
          <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
            <span>Menampilkan <strong>{totalCount > 0 ? startIndex + 1 : 0}–{endIndex}</strong> dari <strong>{totalCount}</strong> item</span>
            <span className="text-slate-300 dark:text-slate-700">|</span>
            <div className="flex items-center gap-1">
              <span>Per halaman:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1 text-xs text-slate-800 dark:text-slate-200 font-bold focus:outline-none"
              >
                <option value={15}>15</option>
                <option value={30}>30</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
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
              className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              title="Halaman Sebelumnya"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-1 px-2 text-xs font-bold text-slate-700 dark:text-slate-300">
              <span>{safePage} / {totalPages}</span>
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
              className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              title="Halaman Selanjutnya"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Chart Section */}
      {chartOpen && filtered.length > 0 && (
        <div id="category-analysis-chart" className="neo-card p-4 space-y-3 mt-6">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                <PieIcon className="w-4 h-4 text-brand-600 dark:text-brand-400" /> Analisis Visual Kategori
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Proporsi pengeluaran per kategori di periode ini</p>
            </div>
            <div className="flex bg-slate-100 dark:bg-slate-800 rounded-xl p-0.5 border border-slate-200 dark:border-slate-700">
              <button
                onClick={() => setChartMode("pie")}
                className={cn(
                  "p-1.5 rounded-lg text-slate-500 dark:text-slate-400 transition",
                  chartMode === "pie" && "bg-white dark:bg-slate-900 shadow-sm text-brand-600 dark:text-brand-400 font-bold",
                )}
                aria-label="Pie chart"
                title="Diagram Lingkaran"
              >
                <PieIcon className="w-4 h-4" />
              </button>
              <button
                onClick={() => setChartMode("bar")}
                className={cn(
                  "p-1.5 rounded-lg text-slate-500 dark:text-slate-400 transition",
                  chartMode === "bar" && "bg-white dark:bg-slate-900 shadow-sm text-brand-600 dark:text-brand-400 font-bold",
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

          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-end">
            <Link
              href="/analysis"
              className="text-xs font-bold text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-1"
            >
              Lihat Tren Temporal Berkala <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      )}

      {isSelectionMode && selectedIds.size > 0 && (
        <div className="fixed bottom-20 sm:bottom-6 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-sm">
          <div className="neo-card-lg bg-slate-950 text-white dark:bg-slate-900 border-2 border-slate-700 p-4 flex items-center justify-between shadow-2xl">
            <div>
              <p className="text-xs text-slate-400 font-semibold">Terpilih {selectedIds.size} item</p>
              <p className="font-mono font-bold text-lg text-brand-400">{formatIDR(selectedSum)}</p>
            </div>
            <button 
              onClick={() => {
                setSelectedIds(new Set());
                setIsSelectionMode(false);
              }}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-bold text-white border border-slate-700 transition-colors"
            >
              Tutup
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

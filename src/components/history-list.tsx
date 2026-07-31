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
import { PeriodSelector } from "@/components/period-selector";
import { CategoryPieChart, CategoryBarChart } from "@/components/expense-charts";
import { getCategoryIcon } from "@/components/category-icon";
import { Search, Trash2, X, PieChart as PieIcon, BarChart3, ChevronDown, ChevronUp, Pencil, Check } from "lucide-react";
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

  // Group by date
  const grouped = useMemo(() => {
    const map = new Map<string, Row[]>();
    filtered.forEach((r) => {
      if (!map.has(r.spent_at)) map.set(r.spent_at, []);
      map.get(r.spent_at)!.push(r);
    });
    return [...map.entries()];
  }, [filtered]);

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
      <div className="p-3 space-y-2 bg-slate-50 dark:bg-slate-900/60">
        <div className="grid grid-cols-2 gap-2">
          <input
            type="text"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            className="input text-sm py-1.5"
            autoFocus
            placeholder="Nama kebutuhan"
          />
          <input
            type="date"
            value={spentAt}
            onChange={(e) => setSpentAt(e.target.value)}
            className="input text-sm py-1.5"
          />
        </div>
        <select
          value={catId}
          onChange={(e) => setCatId(e.target.value)}
          className="input text-sm py-1.5"
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
            className="input text-sm py-1.5"
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
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
            Rp
          </span>
          <input
            type="text"
            inputMode="numeric"
            value={amtText}
            onChange={(e) => setAmtText(formatIDRInput(e.target.value))}
            className="input pl-8 text-sm py-1.5 text-right"
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={() =>
              onSave({
                description: desc.trim(),
                category_id: catId,
                amount: parseIDRInput(amtText),
                spent_at: spentAt, event_id: evtId || null,
              })
            }
            className="btn-primary flex-1 text-sm py-2 flex items-center justify-center gap-1.5"
          >
            <Check className="w-3.5 h-3.5" /> Simpan
          </button>
          <button onClick={onCancel} className="btn-ghost text-sm py-2 px-4">
            Batal
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Filter panel */}
      <div className="card space-y-3">
        {/* Mode tabs */}
        <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 dark:bg-slate-700 rounded-xl">
          <button
            onClick={() => setFilterMode("period")}
            className={cn(
              "py-1.5 text-sm font-medium rounded-lg transition",
              filterMode === "period" ? "bg-white dark:bg-slate-600 shadow-sm text-slate-900 dark:text-slate-100" : "text-slate-500 dark:text-slate-400",
            )}
          >
            Per Periode
          </button>
          <button
            onClick={() => setFilterMode("custom")}
            className={cn(
              "py-1.5 text-sm font-medium rounded-lg transition",
              filterMode === "custom" ? "bg-white dark:bg-slate-600 shadow-sm text-slate-900 dark:text-slate-100" : "text-slate-500 dark:text-slate-400",
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
                className="mt-1 text-xs text-brand-600 dark:text-brand-400 w-full text-center"
              >
                Ke periode sekarang
              </button>
            )}
          </div>

        ) : (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-slate-500 dark:text-slate-400">Dari</label>
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="input py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 dark:text-slate-400">Sampai</label>
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
              !catFilter ? "bg-brand-600 text-white" : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300",
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
                  "px-3 py-1.5 rounded-full text-xs whitespace-nowrap flex items-center gap-1.5",
                  catFilter === c.id ? "bg-brand-600 text-white" : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300",
                )}
              >
                <Icon
                  className="w-3.5 h-3.5 shrink-0"
                  style={{ color: c.color ?? "#94a3b8" }}
                />
                {c.name}
              </button>
            );
          })}
        </div>

        {/* Event chips — hanya tampil kalau ada events */}
        {events && events.length > 0 && (
          <div className="flex gap-2 overflow-x-auto -mx-1 px-1 pb-1">
            <button
              onClick={() => setEvtFilter("")}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs whitespace-nowrap",
                !evtFilter ? "bg-indigo-600 text-white" : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300",
              )}
            >
              Semua Event
            </button>
            <button
              onClick={() => setEvtFilter("__none__")}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs whitespace-nowrap",
                evtFilter === "__none__" ? "bg-indigo-600 text-white" : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300",
              )}
            >
              Tanpa Event
            </button>
            {events.map((evt) => (
              <button
                key={evt.id}
                onClick={() => setEvtFilter(evt.id)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs whitespace-nowrap flex items-center gap-1.5",
                  evtFilter === evt.id ? "bg-indigo-600 text-white" : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300",
                )}
              >
                {evt.name}
                {evt.status === "active" && (
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" />
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
            className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1"
          >
            <X className="w-3 h-3" /> Reset filter
          </button>
        )}
      </div>

      {/* Summary card */}
      <div className="card flex items-center justify-between bg-brand-50 dark:bg-brand-500/10 border-brand-200 dark:border-brand-500/30">
        <div>
          <p className="text-xs text-slate-600 dark:text-slate-300">
            {evtFilter && evtFilter !== "__none__"
              ? `${events?.find(e => e.id === evtFilter)?.name ?? "Event"} · ${filtered.length} item`
              : `Total (${filtered.length} item)`}
          </p>
          <p className="font-bold text-brand-700 dark:text-brand-400 text-lg">{formatIDR(total)}</p>
        </div>
        <button
          onClick={() => setChartOpen(!chartOpen)}
          className="text-xs text-brand-700 dark:text-brand-400 flex items-center gap-1"
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
            <div className="flex bg-slate-100 dark:bg-slate-700 rounded-lg p-0.5">
              <button
                onClick={() => setChartMode("pie")}
                className={cn(
                  "p-1.5 rounded text-slate-500 dark:text-slate-400",
                  chartMode === "pie" && "bg-white dark:bg-slate-600 shadow-sm text-slate-900 dark:text-slate-100",
                )}
                aria-label="Pie chart"
              >
                <PieIcon className="w-4 h-4" />
              </button>
              <button
                onClick={() => setChartMode("bar")}
                className={cn(
                  "p-1.5 rounded text-slate-500 dark:text-slate-400",
                  chartMode === "bar" && "bg-white dark:bg-slate-600 shadow-sm text-slate-900 dark:text-slate-100",
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
        <p className="text-center text-sm text-slate-500 dark:text-slate-400 py-8">Memuat...</p>
      ) : grouped.length === 0 ? (
        <p className="text-center text-sm text-slate-500 dark:text-slate-400 py-8">Tidak ada pengeluaran.</p>
      ) : (
        grouped.map(([date, items]) => {
          const dayTotal = items.reduce((s, r) => s + Number(r.amount), 0);
          return (
            <div key={date}>
              <div className="flex items-center justify-between px-2 py-2">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                  {new Date(date).toLocaleDateString("id-ID", {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </p>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{formatIDR(dayTotal)}</p>
              </div>
              <div className="card divide-y divide-slate-100 dark:divide-slate-700 p-0">
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
                      className={`flex items-center justify-between p-3 group select-none transition-colors ${selectedIds.has(r.id) ? 'bg-indigo-50/70 dark:bg-indigo-900/40 relative before:absolute before:inset-0 before:border-2 before:border-indigo-400 before:pointer-events-none before:z-10' : ''}`}
                      onTouchStart={() => {
                        const t = setTimeout(() => {
                          if (!isSelectionMode) setIsSelectionMode(true);
                          toggleSelection(r.id);
                        }, 500); // 500ms long press
                        // Store timer ID on the element
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
                      onClick={(e) => {
                        // If in selection mode, any click just toggles
                        if (isSelectionMode) {
                          toggleSelection(r.id);
                        }
                      }}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          {(() => {
                            const Icon = getCategoryIcon(r.categories?.name ?? "");
                            return (
                              <Icon
                                className="w-4 h-4 shrink-0"
                                style={{ color: r.categories?.color ?? "#94a3b8" }}
                              />
                            );
                          })()}
                          <p className="font-medium truncate">{r.description}</p>
                        </div>
                        <div className="flex items-center gap-2 ml-4 mt-0.5 flex-wrap">
                          <p className="text-xs text-slate-500 dark:text-slate-400">{r.categories?.name}</p>
                          {r.event_id && (() => {
                            const evt = events?.find(e => e.id === r.event_id);
                            return evt ? (
                              <span className="text-xs px-1.5 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 flex items-center gap-1">
                                {evt.name}
                              </span>
                            ) : null;
                          })()}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <p className="font-semibold text-sm mr-1">{formatIDR(r.amount)}</p>
                        <button
                          onClick={() => setEditingId(r.id)}
                          className="p-1.5 text-slate-300 dark:text-slate-600 hover:text-brand-500 hover:bg-brand-50 dark:hover:bg-brand-500/10 rounded-lg"
                          aria-label="Edit"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(r.id)}
                          className="p-1.5 text-slate-300 dark:text-slate-600 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg"
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

      {isSelectionMode && selectedIds.size > 0 && (
        <div className="fixed bottom-20 sm:bottom-6 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-sm">
          <div className="bg-slate-900 dark:bg-slate-50 text-white dark:text-slate-900 shadow-2xl rounded-2xl p-4 flex items-center justify-between border border-slate-700 dark:border-slate-300">
            <div>
              <p className="text-xs text-slate-300 dark:text-slate-600 font-medium">Terpilih {selectedIds.size} item</p>
              <p className="font-bold text-lg">{formatIDR(selectedSum)}</p>
            </div>
            <button 
              onClick={() => {
                setSelectedIds(new Set());
                setIsSelectionMode(false);
              }}
              className="px-4 py-2 bg-slate-800 dark:bg-slate-200 hover:bg-slate-700 dark:hover:bg-slate-300 rounded-xl text-sm font-medium transition-colors"
            >
              Tutup
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

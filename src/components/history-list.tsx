"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatIDR } from "@/lib/format";
import { Search, Trash2, X } from "lucide-react";
import type { Category, Expense } from "@/lib/types";

type Row = Expense & {
  categories: { name: string; color: string | null } | null;
};

export function HistoryList({ categories }: { categories: Category[] }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState<string>("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  async function load() {
    setLoading(true);
    const supabase = createClient();
    let q = supabase
      .from("expenses")
      .select("*,categories(name,color)")
      .order("spent_at", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(200);

    if (catFilter) q = q.eq("category_id", catFilter);
    if (from) q = q.gte("spent_at", from);
    if (to) q = q.lte("spent_at", to);

    const { data } = await q;
    setRows((data ?? []) as Row[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catFilter, from, to]);

  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const s = search.toLowerCase();
    return rows.filter((r) => r.description.toLowerCase().includes(s));
  }, [rows, search]);

  const total = filtered.reduce((s, r) => s + Number(r.amount), 0);

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
      const k = r.spent_at;
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(r);
    });
    return [...map.entries()];
  }, [filtered]);

  return (
    <div className="space-y-3">
      <div className="card space-y-3">
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
        <div className="flex gap-2 overflow-x-auto -mx-1 px-1 pb-1">
          <button
            onClick={() => setCatFilter("")}
            className={`px-3 py-1.5 rounded-full text-xs whitespace-nowrap ${
              !catFilter ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-600"
            }`}
          >
            Semua
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setCatFilter(c.id)}
              className={`px-3 py-1.5 rounded-full text-xs whitespace-nowrap flex items-center gap-1.5 ${
                catFilter === c.id ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-600"
              }`}
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{ background: c.color ?? "#94a3b8" }}
              />
              {c.name}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-slate-500">Dari</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="input py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs text-slate-500">Sampai</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="input py-2 text-sm" />
          </div>
        </div>
        {(from || to || catFilter) && (
          <button
            onClick={() => { setFrom(""); setTo(""); setCatFilter(""); }}
            className="text-xs text-slate-500 flex items-center gap-1"
          >
            <X className="w-3 h-3" /> Reset filter
          </button>
        )}
      </div>

      <div className="card flex items-center justify-between bg-brand-50 border-brand-200">
        <span className="text-sm text-slate-600">Total hasil filter</span>
        <span className="font-bold text-brand-700">{formatIDR(total)}</span>
      </div>

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
                    weekday: "short", day: "numeric", month: "short", year: "numeric",
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

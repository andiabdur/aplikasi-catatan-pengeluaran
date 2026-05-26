"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatIDRInput, parseIDRInput, todayISO } from "@/lib/format";
import type { Category } from "@/lib/types";
import { Check, Loader2, Calculator } from "lucide-react";
import { cn } from "@/lib/utils";

export function ExpenseForm({
  categories,
  topCategories,
}: {
  categories: Category[];
  topCategories: Category[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [spentAt, setSpentAt] = useState(todayISO());
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState<string>(topCategories[0]?.id ?? categories[0]?.id ?? "");
  const [costText, setCostText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);
  const [calcOpen, setCalcOpen] = useState(false);
  const [calcExpr, setCalcExpr] = useState("");
  const descRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    descRef.current?.focus();
  }, []);

  function calcPress(key: string) {
    if (key === "AC") { setCalcExpr(""); return; }
    if (key === "⌫") { setCalcExpr((e) => e.slice(0, -1)); return; }
    if (key === "=") {
      const clean = calcExpr.replace(/×/g, "*").replace(/÷/g, "/");
      if (!/^[\d\s+\-*/().]+$/.test(clean)) return;
      try {
        // eslint-disable-next-line no-new-func
        const result = Function('"use strict"; return (' + clean + ")")() as number;
        if (isFinite(result) && result >= 0) {
          setCostText(formatIDRInput(String(Math.round(result))));
          setCalcOpen(false);
          setCalcExpr("");
        }
      } catch { /* ignore bad expr */ }
      return;
    }
    setCalcExpr((e) => e + key);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const amount = parseIDRInput(costText);
    if (!description.trim()) return setError("Isi nama kebutuhan dulu");
    if (!categoryId) return setError("Pilih kategori");
    if (amount <= 0) return setError("Cost harus lebih dari 0");

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { data: member } = await supabase
      .from("household_members")
      .select("household_id")
      .eq("user_id", user!.id)
      .single();

    const { error: insertError } = await supabase.from("expenses").insert({
      household_id: member!.household_id,
      category_id: categoryId,
      spent_at: spentAt,
      description: description.trim(),
      amount,
      created_by: user!.id,
    });

    if (insertError) return setError(insertError.message);

    setJustSaved(true);
    setDescription("");
    setCostText("");
    descRef.current?.focus();
    setTimeout(() => setJustSaved(false), 1500);
    startTransition(() => router.refresh());
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Tanggal */}
      <div className="card space-y-3">
        <div>
          <label className="label">Tanggal</label>
          <input
            type="date"
            value={spentAt}
            onChange={(e) => setSpentAt(e.target.value)}
            className="input"
          />
        </div>

        <div>
          <label className="label">Kebutuhan</label>
          <input
            ref={descRef}
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="contoh: Susu ultra, Bensin, dll"
            className="input"
            autoComplete="off"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="label mb-0">Cost (Rp)</label>
            <button
              type="button"
              onClick={() => { setCalcOpen((o) => !o); setCalcExpr(""); }}
              className={cn(
                "flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg transition",
                calcOpen
                  ? "bg-brand-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200",
              )}
            >
              <Calculator className="w-3.5 h-3.5" />
              Kalkulator
            </button>
          </div>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-medium">
              Rp
            </span>
            <input
              type="text"
              inputMode="numeric"
              value={costText}
              onChange={(e) => setCostText(formatIDRInput(e.target.value))}
              placeholder="0"
              className="input pl-12 text-lg font-semibold"
              autoComplete="off"
            />
          </div>

          {/* Calculator panel */}
          {calcOpen && (
            <div className="mt-2 border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-3 py-2 bg-slate-50 border-b border-slate-100 text-right min-h-9 flex items-center justify-end">
                <span className="text-sm font-mono text-slate-600 truncate">
                  {calcExpr || "0"}
                </span>
              </div>
              <div className="grid grid-cols-4 gap-px bg-slate-100">
                {(["AC", "⌫", "÷", "×", "7", "8", "9", "-", "4", "5", "6", "+", "1", "2", "3", "=", "0", "00", "000", "."] as const).map(
                  (k) => (
                    <button
                      type="button"
                      key={k}
                      onClick={() => calcPress(k)}
                      className={cn(
                        "py-3.5 text-sm font-semibold bg-white hover:bg-slate-50 active:bg-slate-100 transition",
                        (k === "AC" || k === "⌫") && "text-red-500",
                        (k === "÷" || k === "×" || k === "-" || k === "+") &&
                          "text-brand-600",
                        k === "=" && "bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-800",
                      )}
                    >
                      {k}
                    </button>
                  ),
                )}
              </div>
            </div>
          )}

          {!calcOpen && (
            <div className="flex gap-2 mt-2">
              {[5000, 10000, 25000, 50000, 100000].map((v) => (
                <button
                  type="button"
                  key={v}
                  onClick={() =>
                    setCostText(formatIDRInput(String(parseIDRInput(costText) + v)))
                  }
                  className="text-xs px-2.5 py-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200"
                >
                  +{(v / 1000).toFixed(0)}rb
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Kategori */}
      <div className="card space-y-3">
        <label className="label">Kategori</label>
        {topCategories.length > 0 && (
          <div>
            <p className="text-xs text-slate-500 mb-2">Sering dipakai</p>
            <div className="flex flex-wrap gap-2">
              {topCategories.map((c) => (
                <CategoryChip
                  key={c.id}
                  category={c}
                  selected={categoryId === c.id}
                  onSelect={() => setCategoryId(c.id)}
                />
              ))}
            </div>
          </div>
        )}
        <div>
          <p className="text-xs text-slate-500 mb-2">Semua kategori</p>
          <div className="grid grid-cols-2 gap-2">
            {categories.map((c) => (
              <CategoryChip
                key={c.id}
                category={c}
                selected={categoryId === c.id}
                onSelect={() => setCategoryId(c.id)}
                full
              />
            ))}
          </div>
        </div>
      </div>

      {error && <p className="text-sm text-red-600 px-1">{error}</p>}

      <button type="submit" disabled={pending} className="btn-primary w-full text-base py-3.5">
        {pending ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : justSaved ? (
          <>
            <Check className="w-5 h-5" /> Tersimpan!
          </>
        ) : (
          "Simpan Pengeluaran"
        )}
      </button>

      <p className="text-xs text-slate-500 text-center">
        Setelah simpan, form kosong otomatis biar Anda bisa input cepat berturut-turut.
      </p>
    </form>
  );
}

function CategoryChip({
  category,
  selected,
  onSelect,
  full,
}: {
  category: Category;
  selected: boolean;
  onSelect: () => void;
  full?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-xl text-sm border transition",
        full ? "w-full justify-start" : "",
        selected
          ? "bg-brand-50 border-brand-500 text-brand-700 font-medium"
          : "bg-white border-slate-200 text-slate-700 hover:border-slate-300",
      )}
    >
      <span
        className="w-2.5 h-2.5 rounded-full shrink-0"
        style={{ background: category.color ?? "#94a3b8" }}
      />
      <span className="truncate">{category.name}</span>
    </button>
  );
}

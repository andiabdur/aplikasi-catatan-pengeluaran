"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { formatIDR, formatIDRInput, parseIDRInput } from "@/lib/format";
import { currentPeriodLabelWithCustom, labelMonthKey, periodTitle, getPeriodRange, periodRangeTextWithCustom } from "@/lib/period";
import { PeriodSelector } from "@/components/period-selector";
import { getCategoryIcon } from "@/components/category-icon";
import type { Category, Budget, Income, CustomPeriod, MonthlySummaryRow } from "@/lib/types";
import { Plus, Trash2, LogOut, Save, CalendarCog, Edit3, RotateCcw, Tent } from "lucide-react";

const COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e", "#06b6d4",
  "#3b82f6", "#a855f7", "#ec4899", "#14b8a6", "#64748b",
];

export function SettingsClient({
  householdId,
  categories: initialCats,
  payDay: initialPayDay,
  initialLabelMonth,
  email,
  customPeriods: initialCustomPeriods,
}: {
  householdId: string;
  categories: Category[];
  payDay: number;
  initialLabelMonth: string;
  email: string;
  customPeriods: { label_month: string; start_date: string; end_date: string }[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [cats, setCats] = useState(initialCats);
  const [payDay, setPayDay] = useState(initialPayDay);
  const [customPeriods, setCustomPeriods] = useState(initialCustomPeriods);
  const [labelMonth, setLabelMonth] = useState<Date>(new Date(initialLabelMonth));
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [summary, setSummary] = useState<MonthlySummaryRow[]>([]);
  const [savingKey, setSavingKey] = useState<string | null>(null);


  const labelKey = labelMonthKey(labelMonth);

  // Reload budgets/incomes/summary when period changes
  useEffect(() => {
    if (!householdId) return;
    Promise.all([
      supabase.from("budgets").select("*").eq("household_id", householdId).eq("month", labelKey),
      supabase.from("incomes").select("*").eq("household_id", householdId).eq("month", labelKey),
      supabase.rpc("f_period_summary", { p_household_id: householdId, p_label_month: labelKey }),
    ]).then(([bRes, iRes, sRes]) => {
      setBudgets((bRes.data ?? []) as Budget[]);
      setIncomes((iRes.data ?? []) as Income[]);
      setSummary((sRes.data ?? []) as MonthlySummaryRow[]);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [labelKey, householdId]);

  function budgetFor(catId: string): Budget | undefined {
    return budgets.find((b) => b.category_id === catId);
  }

  async function setBudget(cat: Category, amount: number) {
    setSavingKey("b-" + cat.id);
    const existing = budgetFor(cat.id);
    if (existing) {
      const { data } = await supabase
        .from("budgets")
        .update({ amount })
        .eq("id", existing.id)
        .select()
        .single();
      if (data) setBudgets((bs) => bs.map((b) => (b.id === data.id ? data : b)));
    } else {
      const { data } = await supabase
        .from("budgets")
        .insert({
          household_id: householdId,
          category_id: cat.id,
          month: labelKey,
          amount,
        })
        .select()
        .single();
      if (data) setBudgets((bs) => [...bs, data]);
    }
    setSavingKey(null);
  }

  async function copyBudgetsFromPrevPeriod() {
    const prev = new Date(labelMonth.getFullYear(), labelMonth.getMonth() - 1, 1);
    const prevKey = labelMonthKey(prev);
    const { data: prevBudgets } = await supabase
      .from("budgets")
      .select("category_id, amount")
      .eq("household_id", householdId)
      .eq("month", prevKey);
    if (!prevBudgets || prevBudgets.length === 0) {
      alert(`Tidak ada budget di ${periodTitle(prev)}.`);
      return;
    }
    if (!confirm(`Copy ${prevBudgets.length} budget dari ${periodTitle(prev)} ke ${periodTitle(labelMonth)}?`))
      return;
    const rows = prevBudgets.map((b) => ({
      household_id: householdId,
      category_id: b.category_id,
      month: labelKey,
      amount: b.amount,
    }));
    // Upsert
    for (const row of rows) {
      const existing = budgets.find((b) => b.category_id === row.category_id);
      if (existing) {
        await supabase.from("budgets").update({ amount: row.amount }).eq("id", existing.id);
      } else {
        await supabase.from("budgets").insert(row);
      }
    }
    // Reload
    const { data } = await supabase
      .from("budgets")
      .select("*")
      .eq("household_id", householdId)
      .eq("month", labelKey);
    setBudgets((data ?? []) as Budget[]);
  }

  async function addCategory() {
    const name = prompt("Nama kategori baru:");
    if (!name?.trim()) return;
    const color = COLORS[cats.length % COLORS.length];
    const { data, error } = await supabase
      .from("categories")
      .insert({
        household_id: householdId,
        name: name.trim(),
        color,
        sort_order: cats.length + 1,
      })
      .select()
      .single();
    if (error) return alert(error.message);
    if (data) setCats((cs) => [...cs, data]);
  }

  async function deleteCategory(cat: Category) {
    if (
      !confirm(
        `Hapus kategori "${cat.name}"? Pengeluaran yang sudah dicatat dengan kategori ini juga akan ikut terhapus.`,
      )
    )
      return;
    const { error } = await supabase.from("categories").delete().eq("id", cat.id);
    if (error) return alert(error.message);
    setCats((cs) => cs.filter((c) => c.id !== cat.id));
  }

  async function setIncomeAmount(inc: Income, amount: number) {
    setSavingKey("i-" + inc.id);
    const { data } = await supabase
      .from("incomes")
      .update({ amount })
      .eq("id", inc.id)
      .select()
      .single();
    if (data) setIncomes((is) => is.map((i) => (i.id === data.id ? data : i)));
    setSavingKey(null);
  }

  async function addIncome() {
    const source = prompt("Sumber income (contoh: Bonus, Freelance):");
    if (!source?.trim()) return;
    const { data } = await supabase
      .from("incomes")
      .insert({
        household_id: householdId,
        month: labelKey,
        source: source.trim(),
        amount: 0,
      })
      .select()
      .single();
    if (data) setIncomes((is) => [...is, data]);
  }

  async function deleteIncome(inc: Income) {
    if (!confirm(`Hapus income "${inc.source}"?`)) return;
    await supabase.from("incomes").delete().eq("id", inc.id);
    setIncomes((is) => is.filter((i) => i.id !== inc.id));
  }

  async function savePayDay(v: number) {
    if (v < 1 || v > 28) return alert("Pay day harus antara 1-28.");
    setSavingKey("pd");
    const { error } = await supabase
      .from("households")
      .update({ pay_day_of_month: v })
      .eq("id", householdId);
    setSavingKey(null);
    if (error) return alert(error.message);
    setPayDay(v);
    // Refresh because periods recalc
    router.refresh();
  }

  async function saveCustomPeriod(start: string, end: string) {
    if (!start || !end) return alert("Tanggal start dan end harus diisi.");
    if (new Date(start) > new Date(end)) {
      return alert("Tanggal mulai tidak boleh melebihi tanggal selesai.");
    }
    setSavingKey("cp");
    const { data, error } = await supabase
      .from("custom_periods")
      .upsert({
        household_id: householdId,
        label_month: labelKey,
        start_date: start,
        end_date: end,
      }, {
        onConflict: "household_id,label_month"
      })
      .select()
      .single();
    
    setSavingKey(null);
    if (error) return alert(error.message);

    // Update local state
    setCustomPeriods((prev) => {
      const filtered = prev.filter((p) => p.label_month !== labelKey);
      if (data) {
        filtered.push({
          label_month: data.label_month,
          start_date: data.start_date,
          end_date: data.end_date,
        });
      }
      return filtered;
    });

    router.refresh();
  }

  async function resetCustomPeriod() {
    if (!confirm("Kembalikan tanggal gajian periode ini ke default?")) return;
    setSavingKey("cp");
    const { error } = await supabase
      .from("custom_periods")
      .delete()
      .eq("household_id", householdId)
      .eq("label_month", labelKey);
    
    setSavingKey(null);
    if (error) return alert(error.message);

    // Remove from local state
    setCustomPeriods((prev) => prev.filter((p) => p.label_month !== labelKey));

    router.refresh();
  }

  async function logout() {
    await supabase.auth.signOut();
    router.push("/login");
  }


  return (
    <div className="space-y-4">
      <section>
        <Link href="/events" className="neo-card p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-900/80 transition-colors">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 flex items-center justify-center">
              <Tent className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-slate-900 dark:text-slate-100">Kelola Event / Perjalanan</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Grup pengeluaran untuk liburan, renovasi, dsb.
              </p>
            </div>
          </div>
          <p className="text-slate-400 font-bold text-lg">›</p>
        </Link>
      </section>

      {/* Pay day setting */}
      <section>
        <div className="neo-card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/20 flex items-center justify-center">
            <CalendarCog className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-slate-900 dark:text-slate-100">Pay Day (Tanggal Gajian)</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Periode dihitung dari tanggal ini setiap bulan
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              min={1}
              max={28}
              defaultValue={payDay}
              onBlur={(e) => {
                const v = Number(e.target.value);
                if (v !== payDay) savePayDay(v);
              }}
              className="w-16 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 rounded-xl px-2 py-2 text-center text-sm font-mono font-bold focus:outline-none focus:border-brand-500"
            />
            {savingKey === "pd" && <Save className="w-4 h-4 text-brand-500 animate-pulse" />}
          </div>
        </div>
      </section>

      {/* Period selector */}
      <div className="neo-card p-4 space-y-4">
        <PeriodSelector
          labelMonth={labelMonth}
          payDay={payDay}
          onChange={setLabelMonth}
          customRangeText={periodRangeTextWithCustom(labelMonth, payDay, customPeriods)}
        />
        {labelMonthKey(labelMonth) !== labelMonthKey(currentPeriodLabelWithCustom(payDay, customPeriods)) && (
          <button
            onClick={() => setLabelMonth(currentPeriodLabelWithCustom(payDay, customPeriods))}
            className="mt-2 text-xs font-semibold text-brand-600 dark:text-brand-400 w-full text-center hover:underline"
          >
            Ke periode sekarang
          </button>
        )}
        <CustomPeriodEditor
          labelMonth={labelMonth}
          payDay={payDay}
          customPeriods={customPeriods}
          onSave={saveCustomPeriod}
          onReset={resetCustomPeriod}
          saving={savingKey === "cp"}
        />
      </div>

      {/* Income */}
      <section>
        <div className="flex items-center justify-between mb-2 px-1">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Income / Pemasukan</h2>
          <button onClick={addIncome} className="text-xs font-bold text-brand-600 dark:text-brand-400 flex items-center gap-1 hover:underline">
            <Plus className="w-3.5 h-3.5" /> Tambah
          </button>
        </div>
        <div className="neo-card divide-y divide-slate-100 dark:divide-slate-800/80 p-0 overflow-hidden">
          {incomes.length === 0 && (
            <p className="p-4 text-xs font-medium text-slate-500 dark:text-slate-400">Belum ada income di periode ini.</p>
          )}
          {incomes.map((inc) => (
            <IncomeRow
              key={inc.id}
              income={inc}
              saving={savingKey === "i-" + inc.id}
              onChange={(v) => setIncomeAmount(inc, v)}
              onDelete={() => deleteIncome(inc)}
            />
          ))}
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 px-1">
          Total income:{" "}
          <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
            {formatIDR(incomes.reduce((s, i) => s + Number(i.amount), 0))}
          </span>
        </p>
      </section>

      {/* Categories & budgets */}
      <section>
        <div className="flex items-center justify-between mb-2 px-1">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Kategori &amp; Budget</h2>
          <div className="flex items-center gap-3">
            <button
              onClick={copyBudgetsFromPrevPeriod}
              className="text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-brand-600 dark:hover:text-brand-400"
              title="Copy budget dari periode sebelumnya"
            >
              Copy prev
            </button>
            <button onClick={addCategory} className="text-xs font-bold text-brand-600 dark:text-brand-400 flex items-center gap-1 hover:underline">
              <Plus className="w-3.5 h-3.5" /> Tambah
            </button>
          </div>
        </div>

        {/* Budget spent summary pills */}
        {budgets.some((b) => b.amount > 0) && (() => {
          const totalSpent = summary.reduce((s, r) => s + Number(r.spent), 0);
          const totalBudget = budgets.reduce((s, b) => s + Number(b.amount), 0);
          const totalIncome = incomes.reduce((s, i) => s + Number(i.amount), 0);
          const sisa = totalBudget - totalSpent;
          const vsIncome = totalIncome - totalBudget;
          return (
            <>
              <div className="grid grid-cols-3 gap-2 mb-2">
                <div className="neo-card p-2.5 bg-rose-500/10 border-rose-500/20">
                  <p className="text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider mb-0.5">Terpakai</p>
                  <p className="text-xs sm:text-sm font-mono font-bold text-rose-600 dark:text-rose-400 truncate">{formatIDR(totalSpent)}</p>
                </div>
                <div className={`neo-card p-2.5 ${sisa >= 0 ? "bg-emerald-500/10 border-emerald-500/20" : "bg-rose-500/10 border-rose-500/20"}`}>
                  <p className={`text-[10px] font-bold uppercase tracking-wider mb-0.5 ${sisa >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>Sisa Budget</p>
                  <p className={`text-xs sm:text-sm font-mono font-bold truncate ${sisa >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>{formatIDR(sisa)}</p>
                </div>
                <div className="neo-card p-2.5 bg-blue-500/10 border-blue-500/20">
                  <p className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-0.5">Total Budget</p>
                  <p className="text-xs sm:text-sm font-mono font-bold text-blue-600 dark:text-blue-400 truncate">{formatIDR(totalBudget)}</p>
                </div>
              </div>
              {totalIncome > 0 && (
                <div className={`neo-card p-2.5 mb-3 flex items-center justify-between text-xs ${vsIncome >= 0 ? "bg-emerald-500/10 border-emerald-500/20" : "bg-rose-500/10 border-rose-500/20"}`}>
                  <span className="text-slate-600 dark:text-slate-400 font-medium">
                    Budget vs Income <span className="font-mono font-bold">({formatIDR(totalIncome)})</span>
                  </span>
                  <span className={`font-mono font-bold ${vsIncome >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                    {vsIncome >= 0 ? `Surplus ${formatIDR(vsIncome)}` : `Defisit ${formatIDR(Math.abs(vsIncome))}`}
                  </span>
                </div>
              )}
            </>
          );
        })()}

        <div className="neo-card divide-y divide-slate-100 dark:divide-slate-800/80 p-0 overflow-hidden">
          {cats.map((c) => (
            <CategoryRow
              key={c.id + labelKey}
              category={c}
              budget={budgetFor(c.id)?.amount ?? 0}
              saving={savingKey === "b-" + c.id}
              onBudgetChange={(v) => setBudget(c, v)}
              onDelete={() => deleteCategory(c)}
            />
          ))}
        </div>
      </section>

      {/* Account */}
      <section>
        <div className="neo-card p-4 flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Masuk Sebagai</p>
            <p className="font-semibold truncate text-sm text-slate-900 dark:text-slate-100 mt-0.5">{email}</p>
          </div>
          <button onClick={logout} className="btn-ghost text-xs font-bold px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
            <LogOut className="w-4 h-4" /> Keluar
          </button>
        </div>
      </section>
    </div>
  );
}

function IncomeRow({
  income,
  saving,
  onChange,
  onDelete,
}: {
  income: Income;
  saving: boolean;
  onChange: (v: number) => void;
  onDelete: () => void;
}) {
  const [text, setText] = useState(
    income.amount ? Number(income.amount).toLocaleString("id-ID") : "",
  );
  const isFocused = useRef(false);
  useEffect(() => {
    if (!isFocused.current) {
      setText(income.amount ? Number(income.amount).toLocaleString("id-ID") : "");
    }
  }, [income.amount]);
  return (
    <div className="flex items-center gap-3 p-3.5 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
      <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex-1 truncate">{income.source}</span>
      <div className="relative w-36">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono font-bold text-brand-600 dark:text-brand-400">
          Rp
        </span>
        <input
          type="text"
          inputMode="numeric"
          value={text}
          onChange={(e) => setText(formatIDRInput(e.target.value))}
          onFocus={() => { isFocused.current = true; }}
          onBlur={() => {
            isFocused.current = false;
            onChange(parseIDRInput(text));
          }}
          className="w-full border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 rounded-xl pl-8 pr-2.5 py-1.5 text-xs font-mono font-bold text-right focus:outline-none focus:border-brand-500"
          placeholder="0"
        />
      </div>
      {saving && <Save className="w-4 h-4 text-brand-500 animate-pulse" />}
      <button onClick={onDelete} className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}

function CategoryRow({
  category,
  budget,
  saving,
  onBudgetChange,
  onDelete,
}: {
  category: Category;
  budget: number;
  saving: boolean;
  onBudgetChange: (v: number) => void;
  onDelete: () => void;
}) {
  const [text, setText] = useState(budget ? Number(budget).toLocaleString("id-ID") : "");
  const isFocused = useRef(false);
  useEffect(() => {
    if (!isFocused.current) {
      setText(budget ? Number(budget).toLocaleString("id-ID") : "");
    }
  }, [budget]);
  const Icon = getCategoryIcon(category.name);
  return (
    <div className="flex items-center gap-3 p-3.5 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center border border-slate-200 dark:border-slate-800 shrink-0"
        style={{ backgroundColor: `${category.color ?? "#94a3b8"}15` }}
      >
        <Icon
          className="w-4 h-4 shrink-0"
          style={{ color: category.color ?? "#94a3b8" }}
        />
      </div>
      <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex-1 truncate">{category.name}</span>
      <div className="relative w-36">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono font-bold text-brand-600 dark:text-brand-400">
          Rp
        </span>
        <input
          type="text"
          inputMode="numeric"
          value={text}
          onChange={(e) => setText(formatIDRInput(e.target.value))}
          onFocus={() => { isFocused.current = true; }}
          onBlur={() => {
            isFocused.current = false;
            onBudgetChange(parseIDRInput(text));
          }}
          className="w-full border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 rounded-xl pl-8 pr-2.5 py-1.5 text-xs font-mono font-bold text-right focus:outline-none focus:border-brand-500"
          placeholder="0"
        />
      </div>
      {saving && <Save className="w-4 h-4 text-brand-500 animate-pulse" />}
      <button onClick={onDelete} className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}

function CustomPeriodEditor({
  labelMonth,
  payDay,
  customPeriods,
  onSave,
  onReset,
  saving,
}: {
  labelMonth: Date;
  payDay: number;
  customPeriods: { label_month: string; start_date: string; end_date: string }[];
  onSave: (start: string, end: string) => Promise<any>;
  onReset: () => Promise<any>;
  saving: boolean;
}) {
  const range = getPeriodRange(labelMonth, payDay, customPeriods);
  const [isEditing, setIsEditing] = useState(false);
  const [start, setStart] = useState(range.from);
  const [end, setEnd] = useState(range.to);

  useEffect(() => {
    setStart(range.from);
    setEnd(range.to);
  }, [range.from, range.to]);

  if (!isEditing) {
    return (
      <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-3">
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {range.isCustom ? (
            <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-bold bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-lg">
              Custom Range
            </span>
          ) : (
            <span className="text-slate-400 font-mono">Rentang default</span>
          )}
        </span>
        <div className="flex items-center gap-2">
          {range.isCustom && (
            <button
              onClick={onReset}
              className="text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              disabled={saving}
            >
              <RotateCcw className="w-3 h-3" /> Reset
            </button>
          )}
          <button
            onClick={() => setIsEditing(true)}
            className="text-xs font-bold text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-brand-500/10 border border-brand-500/20 transition"
            disabled={saving}
          >
            <Edit3 className="w-3 h-3" /> Ubah Range
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="border-t border-slate-100 dark:border-slate-800 pt-3 space-y-3">
      <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Custom Rentang Tanggal</p>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-1 uppercase">Mulai</label>
          <input
            type="date"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className="w-full border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 rounded-xl px-2.5 py-2 text-xs font-mono font-bold focus:outline-none focus:border-brand-500"
          />
        </div>
        <div>
          <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-1 uppercase">Selesai</label>
          <input
            type="date"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            className="w-full border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 rounded-xl px-2.5 py-2 text-xs font-mono font-bold focus:outline-none focus:border-brand-500"
          />
        </div>
      </div>
      <div className="flex gap-2 justify-end pt-1">
        <button
          onClick={() => setIsEditing(false)}
          className="text-xs font-bold text-slate-500 dark:text-slate-400 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          disabled={saving}
        >
          Batal
        </button>
        <button
          onClick={async () => {
            await onSave(start, end);
            setIsEditing(false);
          }}
          className="btn-primary text-xs font-bold px-4 py-1.5 rounded-xl flex items-center gap-1.5 shadow-sm"
          disabled={saving}
        >
          {saving ? "Menyimpan..." : "Simpan"}
        </button>
      </div>
    </div>
  );
}


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
    <div className="space-y-4 pb-20">
      <section>
        <Link href="/events" className="bg-white dark:bg-surface-dark border-4 border-slate-950 dark:border-slate-100 rounded-none p-4 flex items-center justify-between shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)] hover:bg-slate-950 hover:text-white dark:hover:bg-slate-100 dark:hover:text-slate-950 group transition-all">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-none bg-indigo-200 text-indigo-950 border-2 border-slate-950 flex items-center justify-center shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              <Tent className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-headline font-bold uppercase tracking-wider text-slate-950 dark:text-slate-100 group-hover:text-white dark:group-hover:text-slate-950">Kelola Event &amp; Perjalanan</p>
              <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400 group-hover:text-slate-300 dark:group-hover:text-slate-700">
                Grup pengeluaran untuk liburan, renovasi, dsb.
              </p>
            </div>
          </div>
          <p className="font-headline font-black text-xl">›</p>
        </Link>
      </section>

      {/* Pay day setting */}
      <section>
        <div className="bg-white dark:bg-surface-dark border-4 border-slate-950 dark:border-slate-100 rounded-none p-4 flex items-center gap-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)]">
          <div className="w-10 h-10 rounded-none bg-brand-400 text-slate-950 border-2 border-slate-950 flex items-center justify-center shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
            <CalendarCog className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-headline font-bold uppercase tracking-wider text-slate-950 dark:text-slate-100">Pay Day (Tanggal Gajian)</p>
            <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
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
              className="w-16 border-2 border-slate-950 dark:border-slate-100 bg-slate-50 dark:bg-slate-950 text-slate-950 dark:text-slate-100 rounded-none px-2 py-1.5 text-center text-xs font-mono font-bold focus:outline-none shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
            />
            {savingKey === "pd" && <Save className="w-4 h-4 text-brand-500 animate-pulse" />}
          </div>
        </div>
      </section>

      {/* Period selector */}
      <div className="bg-white dark:bg-surface-dark border-4 border-slate-950 dark:border-slate-100 rounded-none p-4 space-y-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)]">
        <PeriodSelector
          labelMonth={labelMonth}
          payDay={payDay}
          onChange={setLabelMonth}
          customRangeText={periodRangeTextWithCustom(labelMonth, payDay, customPeriods)}
        />
        {labelMonthKey(labelMonth) !== labelMonthKey(currentPeriodLabelWithCustom(payDay, customPeriods)) && (
          <button
            onClick={() => setLabelMonth(currentPeriodLabelWithCustom(payDay, customPeriods))}
            className="mt-2 text-xs font-mono font-bold uppercase text-brand-600 dark:text-brand-400 w-full text-center hover:underline"
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
          <h2 className="text-xs font-headline font-bold uppercase tracking-wider text-slate-950 dark:text-slate-100">Income / Pemasukan</h2>
          <button onClick={addIncome} className="text-xs font-headline font-bold uppercase text-brand-600 dark:text-brand-400 flex items-center gap-1 hover:underline">
            <Plus className="w-3.5 h-3.5" /> Tambah
          </button>
        </div>
        <div className="bg-white dark:bg-surface-dark border-4 border-slate-950 dark:border-slate-100 rounded-none divide-y-2 divide-slate-100 dark:divide-slate-800 p-0 overflow-hidden shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)]">
          {incomes.length === 0 && (
            <p className="p-4 text-xs font-mono uppercase text-slate-500 dark:text-slate-400">Belum ada income di periode ini.</p>
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
        <p className="text-xs font-mono font-bold uppercase text-slate-600 dark:text-slate-400 mt-2 px-1">
          Total income:{" "}
          <span className="text-slate-950 dark:text-slate-100">
            {formatIDR(incomes.reduce((s, i) => s + Number(i.amount), 0))}
          </span>
        </p>
      </section>

      {/* Categories & budgets */}
      <section>
        <div className="flex items-center justify-between mb-2 px-1">
          <h2 className="text-xs font-headline font-bold uppercase tracking-wider text-slate-950 dark:text-slate-100">Kategori &amp; Budget</h2>
          <div className="flex items-center gap-3">
            <button
              onClick={copyBudgetsFromPrevPeriod}
              className="text-xs font-mono font-bold uppercase text-slate-500 hover:text-slate-950 dark:hover:text-white"
              title="Copy budget dari periode sebelumnya"
            >
              Copy prev
            </button>
            <button onClick={addCategory} className="text-xs font-headline font-bold uppercase text-brand-600 dark:text-brand-400 flex items-center gap-1 hover:underline">
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
              <div className="grid grid-cols-3 gap-2 mb-3">
                <div className="bg-rose-100 dark:bg-rose-950/60 border-2 border-slate-950 dark:border-slate-100 rounded-none p-2.5 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                  <p className="text-[10px] font-headline font-bold uppercase text-rose-800 dark:text-rose-300 tracking-wider mb-0.5">Terpakai</p>
                  <p className="text-xs sm:text-sm font-mono font-black text-rose-900 dark:text-rose-200 truncate">{formatIDR(totalSpent)}</p>
                </div>
                <div className={`border-2 border-slate-950 dark:border-slate-100 rounded-none p-2.5 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] ${sisa >= 0 ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-900" : "bg-rose-100 dark:bg-rose-950/60 text-rose-900"}`}>
                  <p className="text-[10px] font-headline font-bold uppercase tracking-wider mb-0.5">Sisa</p>
                  <p className="text-xs sm:text-sm font-mono font-black truncate">{formatIDR(sisa)}</p>
                </div>
                <div className="bg-blue-100 dark:bg-blue-950/60 border-2 border-slate-950 dark:border-slate-100 rounded-none p-2.5 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                  <p className="text-[10px] font-headline font-bold uppercase text-blue-800 dark:text-blue-300 tracking-wider mb-0.5">Budget</p>
                  <p className="text-xs sm:text-sm font-mono font-black text-blue-900 dark:text-blue-200 truncate">{formatIDR(totalBudget)}</p>
                </div>
              </div>
              {totalIncome > 0 && (
                <div className={`border-2 border-slate-950 dark:border-slate-100 rounded-none p-2.5 mb-3 flex items-center justify-between text-xs shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] ${vsIncome >= 0 ? "bg-emerald-100 dark:bg-emerald-950/60" : "bg-rose-100 dark:bg-rose-950/60"}`}>
                  <span className="font-headline font-bold uppercase text-slate-950 dark:text-slate-100">
                    Budget vs Income <span className="font-mono font-bold">({formatIDR(totalIncome)})</span>
                  </span>
                  <span className={`font-mono font-black ${vsIncome >= 0 ? "text-emerald-800 dark:text-emerald-300" : "text-rose-800 dark:text-rose-300"}`}>
                    {vsIncome >= 0 ? `Surplus ${formatIDR(vsIncome)}` : `Defisit ${formatIDR(Math.abs(vsIncome))}`}
                  </span>
                </div>
              )}
            </>
          );
        })()}

        <div className="bg-white dark:bg-surface-dark border-4 border-slate-950 dark:border-slate-100 rounded-none divide-y-2 divide-slate-100 dark:divide-slate-800 p-0 overflow-hidden shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)]">
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
        <div className="bg-white dark:bg-surface-dark border-4 border-slate-950 dark:border-slate-100 rounded-none p-4 flex items-center justify-between shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)]">
          <div className="min-w-0">
            <p className="text-xs font-headline font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Masuk Sebagai</p>
            <p className="font-mono font-bold truncate text-xs text-slate-950 dark:text-slate-100 mt-0.5">{email}</p>
          </div>
          <button onClick={logout} className="text-xs font-headline font-bold uppercase px-3 py-2 rounded-none border-2 border-rose-600 bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none flex items-center gap-1.5 transition-all">
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
    <div className="flex items-center gap-3 p-3.5 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
      <span className="text-xs font-headline font-bold uppercase text-slate-950 dark:text-slate-100 flex-1 truncate">{income.source}</span>
      <div className="relative w-36">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-headline font-black text-slate-950 dark:text-slate-100">
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
          className="w-full border-2 border-slate-950 dark:border-slate-100 bg-slate-50 dark:bg-slate-950 text-slate-950 dark:text-slate-100 rounded-none pl-8 pr-2.5 py-1.5 text-xs font-mono font-bold text-right focus:outline-none shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
          placeholder="0"
        />
      </div>
      {saving && <Save className="w-4 h-4 text-brand-500 animate-pulse" />}
      <button onClick={onDelete} className="p-1.5 text-slate-600 hover:text-rose-600 rounded-none border border-transparent hover:border-rose-600 transition-colors">
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
    <div className="flex items-center gap-3 p-3.5 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
      <div
        className="w-8 h-8 rounded-none flex items-center justify-center border-2 border-slate-950 dark:border-slate-100 shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] shrink-0"
        style={{ backgroundColor: category.color ?? "#16a34a" }}
      >
        <Icon className="w-4 h-4 text-white shrink-0" />
      </div>
      <span className="text-xs font-headline font-bold uppercase text-slate-950 dark:text-slate-100 flex-1 truncate">{category.name}</span>
      <div className="relative w-36">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-headline font-black text-slate-950 dark:text-slate-100">
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
          className="w-full border-2 border-slate-950 dark:border-slate-100 bg-slate-50 dark:bg-slate-950 text-slate-950 dark:text-slate-100 rounded-none pl-8 pr-2.5 py-1.5 text-xs font-mono font-bold text-right focus:outline-none shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
          placeholder="0"
        />
      </div>
      {saving && <Save className="w-4 h-4 text-brand-500 animate-pulse" />}
      <button onClick={onDelete} className="p-1.5 text-slate-600 hover:text-rose-600 rounded-none border border-transparent hover:border-rose-600 transition-colors">
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
      <div className="flex items-center justify-between border-t-2 border-slate-950 dark:border-slate-100 pt-3">
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {range.isCustom ? (
            <span className="inline-flex items-center gap-1 text-amber-900 bg-amber-300 border-2 border-slate-950 px-2 py-0.5 rounded-none font-headline font-bold uppercase text-[10px]">
              Custom Range
            </span>
          ) : (
            <span className="text-slate-500 font-mono text-xs uppercase">Rentang default</span>
          )}
        </span>
        <div className="flex items-center gap-2">
          {range.isCustom && (
            <button
              onClick={onReset}
              className="text-xs font-headline font-bold uppercase text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1.5 px-2 py-1 rounded-none border border-slate-950 transition"
              disabled={saving}
            >
              <RotateCcw className="w-3 h-3" /> Reset
            </button>
          )}
          <button
            onClick={() => setIsEditing(true)}
            className="text-xs font-headline font-bold uppercase text-slate-950 dark:text-slate-100 bg-brand-400 border-2 border-slate-950 px-2.5 py-1.5 rounded-none shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition flex items-center gap-1.5"
            disabled={saving}
          >
            <Edit3 className="w-3 h-3" /> Ubah Range
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="border-t-2 border-slate-950 dark:border-slate-100 pt-3 space-y-3">
      <p className="text-xs font-headline font-bold uppercase tracking-wider text-slate-950 dark:text-slate-100">Custom Rentang Tanggal</p>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] font-headline font-bold text-slate-950 dark:text-slate-100 block mb-1 uppercase">Mulai</label>
          <input
            type="date"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className="w-full border-2 border-slate-950 dark:border-slate-100 bg-slate-50 dark:bg-slate-950 text-slate-950 dark:text-slate-100 rounded-none px-2.5 py-2 text-xs font-mono font-bold focus:outline-none shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
          />
        </div>
        <div>
          <label className="text-[10px] font-headline font-bold text-slate-950 dark:text-slate-100 block mb-1 uppercase">Selesai</label>
          <input
            type="date"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            className="w-full border-2 border-slate-950 dark:border-slate-100 bg-slate-50 dark:bg-slate-950 text-slate-950 dark:text-slate-100 rounded-none px-2.5 py-2 text-xs font-mono font-bold focus:outline-none shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
          />
        </div>
      </div>
      <div className="flex gap-2 justify-end pt-1">
        <button
          onClick={() => setIsEditing(false)}
          className="text-xs font-headline font-bold uppercase text-slate-950 dark:text-slate-100 px-3 py-1.5 rounded-none border-2 border-slate-950 hover:bg-slate-100 transition"
          disabled={saving}
        >
          Batal
        </button>
        <button
          onClick={async () => {
            await onSave(start, end);
            setIsEditing(false);
          }}
          className="text-xs font-headline font-bold uppercase px-4 py-1.5 rounded-none bg-brand-500 text-slate-950 border-2 border-slate-950 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none flex items-center gap-1.5"
          disabled={saving}
        >
          {saving ? "Menyimpan..." : "Simpan"}
        </button>
      </div>
    </div>
  );
}


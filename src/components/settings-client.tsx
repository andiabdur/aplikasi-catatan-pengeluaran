"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatIDR, formatIDRInput, parseIDRInput } from "@/lib/format";
import { currentPeriodLabel, labelMonthKey, periodTitle } from "@/lib/period";
import { PeriodSelector } from "@/components/period-selector";
import type { Category, Budget, Income } from "@/lib/types";
import { Plus, Trash2, LogOut, Save, CalendarCog } from "lucide-react";

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
}: {
  householdId: string;
  categories: Category[];
  payDay: number;
  initialLabelMonth: string;
  email: string;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [cats, setCats] = useState(initialCats);
  const [payDay, setPayDay] = useState(initialPayDay);
  const [labelMonth, setLabelMonth] = useState<Date>(new Date(initialLabelMonth));
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const labelKey = labelMonthKey(labelMonth);

  // Reload budgets/incomes when period changes
  useEffect(() => {
    if (!householdId) return;
    Promise.all([
      supabase.from("budgets").select("*").eq("household_id", householdId).eq("month", labelKey),
      supabase.from("incomes").select("*").eq("household_id", householdId).eq("month", labelKey),
    ]).then(([bRes, iRes]) => {
      setBudgets((bRes.data ?? []) as Budget[]);
      setIncomes((iRes.data ?? []) as Income[]);
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

  async function logout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <div className="space-y-4">
      {/* Pay day setting */}
      <section>
        <div className="card flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center">
            <CalendarCog className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">Pay Day (tanggal gajian)</p>
            <p className="text-xs text-slate-500">
              Periode dihitung dari tanggal ini setiap bulan
            </p>
          </div>
          <div className="flex items-center gap-1">
            <input
              type="number"
              min={1}
              max={28}
              defaultValue={payDay}
              onBlur={(e) => {
                const v = Number(e.target.value);
                if (v !== payDay) savePayDay(v);
              }}
              className="w-16 border border-slate-200 rounded-lg px-2 py-1.5 text-center text-sm font-semibold"
            />
            {savingKey === "pd" && <Save className="w-4 h-4 text-brand-500 animate-pulse" />}
          </div>
        </div>
      </section>

      {/* Period selector */}
      <div className="card">
        <PeriodSelector labelMonth={labelMonth} payDay={payDay} onChange={setLabelMonth} />
        {labelMonthKey(labelMonth) !== labelMonthKey(currentPeriodLabel(payDay)) && (
          <button
            onClick={() => setLabelMonth(currentPeriodLabel(payDay))}
            className="mt-2 text-xs text-brand-600 w-full text-center"
          >
            Ke periode sekarang
          </button>
        )}
      </div>

      {/* Income */}
      <section>
        <div className="flex items-center justify-between mb-2 px-1">
          <h2 className="font-semibold">Income</h2>
          <button onClick={addIncome} className="text-xs text-brand-600 flex items-center gap-1">
            <Plus className="w-3 h-3" /> Tambah
          </button>
        </div>
        <div className="card divide-y divide-slate-100 p-0">
          {incomes.length === 0 && (
            <p className="p-4 text-sm text-slate-500">Belum ada income di periode ini.</p>
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
        <p className="text-xs text-slate-500 mt-2 px-1">
          Total income:{" "}
          <span className="font-semibold text-slate-700">
            {formatIDR(incomes.reduce((s, i) => s + Number(i.amount), 0))}
          </span>
        </p>
      </section>

      {/* Categories & budgets */}
      <section>
        <div className="flex items-center justify-between mb-2 px-1">
          <h2 className="font-semibold">Kategori & Budget</h2>
          <div className="flex items-center gap-3">
            <button
              onClick={copyBudgetsFromPrevPeriod}
              className="text-xs text-slate-500 hover:text-brand-600"
              title="Copy budget dari periode sebelumnya"
            >
              Copy prev
            </button>
            <button onClick={addCategory} className="text-xs text-brand-600 flex items-center gap-1">
              <Plus className="w-3 h-3" /> Tambah
            </button>
          </div>
        </div>
        <div className="card divide-y divide-slate-100 p-0">
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
        <div className="card flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-xs text-slate-500">Masuk sebagai</p>
            <p className="font-medium truncate text-sm">{email}</p>
          </div>
          <button onClick={logout} className="btn-ghost text-sm">
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
  return (
    <div className="flex items-center gap-2 p-3">
      <span className="text-sm font-medium flex-1 truncate">{income.source}</span>
      <div className="relative w-36">
        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400">
          Rp
        </span>
        <input
          type="text"
          inputMode="numeric"
          value={text}
          onChange={(e) => setText(formatIDRInput(e.target.value))}
          onBlur={() => onChange(parseIDRInput(text))}
          className="w-full border border-slate-200 rounded-lg pl-7 pr-2 py-1.5 text-sm text-right"
          placeholder="0"
        />
      </div>
      {saving && <Save className="w-4 h-4 text-brand-500 animate-pulse" />}
      <button onClick={onDelete} className="p-1.5 text-slate-300 hover:text-red-500">
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
  return (
    <div className="flex items-center gap-2 p-3">
      <span
        className="w-2.5 h-2.5 rounded-full shrink-0"
        style={{ background: category.color ?? "#94a3b8" }}
      />
      <span className="text-sm font-medium flex-1 truncate">{category.name}</span>
      <div className="relative w-36">
        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400">
          Rp
        </span>
        <input
          type="text"
          inputMode="numeric"
          value={text}
          onChange={(e) => setText(formatIDRInput(e.target.value))}
          onBlur={() => onBudgetChange(parseIDRInput(text))}
          className="w-full border border-slate-200 rounded-lg pl-7 pr-2 py-1.5 text-sm text-right"
          placeholder="0"
        />
      </div>
      {saving && <Save className="w-4 h-4 text-brand-500 animate-pulse" />}
      <button onClick={onDelete} className="p-1.5 text-slate-300 hover:text-red-500">
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatIDR } from "@/lib/format";
import {
  Sparkles, Loader2, TrendingUp, AlertTriangle, CheckCircle2,
  ListChecks, Wallet, Target, Check, BarChart3, MessageCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { FinancialChat } from "@/components/financial-chat";

type Insight = { title: string; detail: string; severity: string };
type SuggestedBudget = { category_id: string; category_name: string; amount: number; reason: string };
type GoalAdvice = { goal_name: string; advice: string };

type Analysis = {
  summary: string;
  health: string;
  insights: Insight[];
  action_now: string[];
  suggested_budgets: SuggestedBudget[];
  goal_advice: GoalAdvice[];
  next_label_month: string;
  next_period_title: string;
  periods_analyzed: string[];
};

export function AsistenClient({ householdId }: { householdId: string }) {
  const storageKey = `fin_analysis_${householdId}`;
  const [tab, setTab] = useState<"analisa" | "chat">("analisa");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<Analysis | null>(null);
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // Restore last analysis so it survives navigation/reload.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) setData(JSON.parse(raw));
    } catch { /* ignore */ }
    setHydrated(true);
  }, [storageKey]);

  // Persist analysis (only overwritten when user re-analyzes).
  useEffect(() => {
    if (!hydrated) return;
    try {
      if (data) localStorage.setItem(storageKey, JSON.stringify(data));
    } catch { /* ignore */ }
  }, [data, hydrated, storageKey]);

  async function analyze() {
    setLoading(true);
    setError(null);
    setApplied(false);
    try {
      const res = await fetch("/api/financial-advisor", { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Gagal menganalisa.");
      } else {
        setData(json as Analysis);
      }
    } catch {
      setError("Gagal terhubung. Cek koneksi.");
    }
    setLoading(false);
  }

  async function applyBudgets() {
    if (!data || !householdId) return;
    setApplying(true);
    const supabase = createClient();
    const rows = data.suggested_budgets.map((s) => ({
      household_id: householdId,
      category_id: s.category_id,
      month: data.next_label_month,
      amount: s.amount,
    }));
    const { error: err } = await supabase
      .from("budgets")
      .upsert(rows, { onConflict: "category_id,month" });
    setApplying(false);
    if (err) {
      setError("Gagal menerapkan budget: " + err.message);
      return;
    }
    setApplied(true);
  }

  const tabBar = (
    <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 dark:bg-slate-700 rounded-xl">
      <button
        type="button"
        onClick={() => setTab("analisa")}
        className={cn(
          "flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition",
          tab === "analisa" ? "bg-white dark:bg-slate-600 text-brand-700 dark:text-brand-300 shadow-sm" : "text-slate-500 dark:text-slate-400",
        )}
      >
        <BarChart3 className="w-4 h-4" /> Analisa
      </button>
      <button
        type="button"
        onClick={() => setTab("chat")}
        className={cn(
          "flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition",
          tab === "chat" ? "bg-white dark:bg-slate-600 text-brand-700 dark:text-brand-300 shadow-sm" : "text-slate-500 dark:text-slate-400",
        )}
      >
        <MessageCircle className="w-4 h-4" /> Chat
      </button>
    </div>
  );

  if (tab === "chat") {
    return (
      <div className="space-y-4">
        {tabBar}
        <FinancialChat householdId={householdId} />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-4">
        {tabBar}
        <div className="card text-center py-8 space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-brand-100 dark:bg-brand-500/20 text-brand-600 dark:text-brand-400 flex items-center justify-center mx-auto">
            <Sparkles className="w-7 h-7" />
          </div>
          <div>
            <h2 className="font-semibold text-slate-900 dark:text-slate-100">Minta saran dari AI</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
              AI bakal baca pola belanja keluarga lu beberapa periode terakhir, kasih diagnosa,
              hal yang harus ditekan, dan usulan budget buat periode depan.
            </p>
          </div>
          <button onClick={analyze} disabled={loading} className="btn-primary w-full">
            {loading ? (
              <><Loader2 className="w-5 h-5 animate-spin" /> Menganalisa...</>
            ) : (
              <><Sparkles className="w-5 h-5" /> Analisa keuangan keluarga gue</>
            )}
          </button>
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {tabBar}
      {/* Summary + health */}
      <div className="card space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">
            Ringkasan
          </span>
          <HealthBadge health={data.health} />
        </div>
        <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed">{data.summary}</p>
        {data.periods_analyzed.length > 0 && (
          <p className="text-[11px] text-slate-400">
            Berdasarkan: {data.periods_analyzed.join(", ")}
          </p>
        )}
      </div>

      {/* Insights */}
      {data.insights.length > 0 && (
        <div className="card space-y-3">
          <SectionTitle icon={TrendingUp}>Temuan</SectionTitle>
          <div className="space-y-2.5">
            {data.insights.map((ins, i) => (
              <div key={i} className="flex gap-2.5">
                <SeverityIcon severity={ins.severity} />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{ins.title}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-snug">{ins.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action now */}
      {data.action_now.length > 0 && (
        <div className="card space-y-3">
          <SectionTitle icon={ListChecks}>Yang harus ditekan sekarang</SectionTitle>
          <ul className="space-y-2">
            {data.action_now.map((a, i) => (
              <li key={i} className="flex gap-2 text-sm text-slate-700 dark:text-slate-200">
                <span className="text-brand-600 dark:text-brand-400 font-bold shrink-0">{i + 1}.</span>
                <span>{a}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Goal advice */}
      {data.goal_advice.length > 0 && (
        <div className="card space-y-3">
          <SectionTitle icon={Target}>Soal goal kamu</SectionTitle>
          <div className="space-y-2.5">
            {data.goal_advice.map((g, i) => (
              <div key={i}>
                <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{g.goal_name}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-snug">{g.advice}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Suggested budgets */}
      {data.suggested_budgets.length > 0 && (
        <div className="card space-y-3">
          <SectionTitle icon={Wallet}>
            Usulan budget — {data.next_period_title}
          </SectionTitle>
          <div className="divide-y divide-slate-100 dark:divide-slate-700">
            {data.suggested_budgets.map((s) => (
              <div key={s.category_id} className="py-2 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{s.category_name}</p>
                  {s.reason && <p className="text-xs text-slate-500 dark:text-slate-400 leading-snug">{s.reason}</p>}
                </div>
                <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 shrink-0">
                  {formatIDR(s.amount)}
                </span>
              </div>
            ))}
          </div>

          {applied ? (
            <div className="flex items-center gap-2 text-sm font-medium text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-500/10 rounded-lg p-2.5">
              <Check className="w-4 h-4" /> Budget {data.next_period_title} berhasil di-set!
            </div>
          ) : (
            <button onClick={applyBudgets} disabled={applying} className="btn-primary w-full">
              {applying ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>Terapkan ke budget {data.next_period_title}</>
              )}
            </button>
          )}
          <p className="text-[11px] text-slate-400 text-center">
            Tetap bisa kamu ubah manual di menu Atur setelah diterapkan.
          </p>
        </div>
      )}

      {error && <p className="text-sm text-red-600 dark:text-red-400 px-1">{error}</p>}

      <button
        onClick={analyze}
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-medium py-2.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-700/50 transition disabled:opacity-60"
      >
        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Analisa ulang"}
      </button>
    </div>
  );
}

function SectionTitle({ icon: Icon, children }: { icon: React.ElementType; children: React.ReactNode }) {
  return (
    <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-900 dark:text-slate-100">
      <Icon className="w-4 h-4 text-brand-600 dark:text-brand-400" />
      {children}
    </h3>
  );
}

function HealthBadge({ health }: { health: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    sehat: { label: "Sehat", cls: "bg-green-100 dark:bg-green-500/15 text-green-700 dark:text-green-400" },
    waspada: { label: "Waspada", cls: "bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400" },
    boncos: { label: "Boncos", cls: "bg-red-100 dark:bg-red-500/15 text-red-700 dark:text-red-400" },
  };
  const m = map[health] ?? { label: health || "—", cls: "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300" };
  return <span className={cn("text-xs font-semibold px-2.5 py-1 rounded-full capitalize", m.cls)}>{m.label}</span>;
}

function SeverityIcon({ severity }: { severity: string }) {
  if (severity === "good") return <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />;
  if (severity === "danger") return <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />;
  return <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />;
}

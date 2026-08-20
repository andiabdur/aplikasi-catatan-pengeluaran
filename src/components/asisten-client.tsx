"use client";

import { useEffect, useState } from "react";
import { formatIDR } from "@/lib/format";
import {
  Sparkles, Loader2, TrendingUp, AlertTriangle, CheckCircle2,
  ListChecks, Wallet, Target, Check, BarChart3, MessageCircle, RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { FinancialChat } from "@/components/financial-chat";
import { useChatContext } from "@/contexts/chat-context";

export function AsistenClient({ householdId }: { householdId: string }) {
  const [tab, setTab] = useState<"analisa" | "chat">("analisa");

  const {
    analysisData: data,
    analysisLoading: loading,
    analysisError: error,
    analysisApplied: applied,
    applyingBudgets: applying,
    setHouseholdId,
    runAnalysis: analyze,
    applySuggestedBudgets: applyBudgets,
  } = useChatContext();

  useEffect(() => {
    if (householdId) setHouseholdId(householdId);
  }, [householdId, setHouseholdId]);

  const tabBar = (
    <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-800">
      <button
        type="button"
        onClick={() => setTab("analisa")}
        className={cn(
          "flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-bold transition-all",
          tab === "analisa"
            ? "bg-brand-500 text-slate-950 shadow-sm"
            : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200",
        )}
      >
        <BarChart3 className="w-4 h-4" />
        <span>Audit CFO {loading && "..."}</span>
      </button>
      <button
        type="button"
        onClick={() => setTab("chat")}
        className={cn(
          "flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-bold transition-all",
          tab === "chat"
            ? "bg-brand-500 text-slate-950 shadow-sm"
            : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200",
        )}
      >
        <MessageCircle className="w-4 h-4" /> Chat Interaktif
      </button>
    </div>
  );

  if (tab === "chat") {
    return (
      <div className="space-y-4">
        {tabBar}
        <FinancialChat householdId={householdId} fullPage />
      </div>
    );
  }

  // Loading indicator banner when analysis is processing in background
  const loadingBanner = loading && (
    <div className="neo-card bg-brand-500/10 border-brand-500/30 p-4 space-y-2 text-center animate-pulse">
      <div className="flex items-center justify-center gap-2 text-brand-700 dark:text-brand-300 font-bold text-sm">
        <Loader2 className="w-5 h-5 animate-spin text-brand-600 dark:text-brand-400" />
        <span>Sedang Menganalisis Keuangan Keluarga...</span>
      </div>
      <p className="text-xs text-brand-600 dark:text-brand-400 leading-relaxed">
        AI sedang membaca indikator cashflow, varians pengeluaran, dan memori keluarga Anda. Anda bisa bebas berpindah halaman, proses akan terus berjalan di background!
      </p>
    </div>
  );

  if (!data) {
    return (
      <div className="space-y-4">
        {tabBar}
        {loadingBanner}
        {!loading && (
          <div className="neo-card text-center py-10 px-6 space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-brand-500/15 text-brand-600 dark:text-brand-400 border border-brand-500/30 flex items-center justify-center mx-auto shadow-sm">
              <Sparkles className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Audit CFO &amp; Diagnosa Keuangan AI</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed max-w-sm mx-auto">
                AI CFO akan melakukan audit teknis mendalam atas indikator cashflow, Savings Rate %, Burn Rate, serta mengevaluasi kesesuaian dengan memori &amp; target keluarga Anda.
              </p>
            </div>
            <button
              onClick={() => analyze()}
              disabled={loading}
              className="btn-primary w-full py-4 text-sm font-bold rounded-xl shadow-[3px_3px_0px_0px_rgba(0,0,0,0.2)] dark:shadow-[3px_3px_0px_0px_rgba(0,0,0,0.6)]"
            >
              {loading ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> Menganalisa di background...</>
              ) : (
                <><Sparkles className="w-5 h-5" /> Mulai Audit Keuangan Keluarga</>
              )}
            </button>
            {error && <p className="text-sm font-semibold text-rose-600 dark:text-rose-400">{error}</p>}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {tabBar}
      {loadingBanner}

      {/* Summary + health (Stitch Style) */}
      <div className="neo-card p-5 space-y-3 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-28 h-28 bg-brand-500/5 rounded-bl-full pointer-events-none" />
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Diagnosa Eksekutif CFO
          </span>
          <HealthBadge health={data.health} />
        </div>
        <p className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed font-medium">{data.summary}</p>
        {data.periods_analyzed.length > 0 && (
          <p className="text-[11px] font-mono text-slate-400">
            Audit berbasis {data.periods_analyzed.length} periode: {data.periods_analyzed.join(", ")}
          </p>
        )}
      </div>

      {/* Insights */}
      {data.insights.length > 0 && (
        <div className="neo-card p-5 space-y-3">
          <SectionTitle icon={TrendingUp}>Temuan Analitis Mendalam</SectionTitle>
          <div className="space-y-2.5">
            {data.insights.map((ins, i) => (
              <div
                key={i}
                className={cn(
                  "p-3.5 rounded-xl border flex gap-3 items-start bg-slate-50/50 dark:bg-slate-900/60",
                  ins.severity === "danger" ? "border-l-4 border-l-rose-500 border-rose-200 dark:border-rose-900/40" :
                  ins.severity === "good" ? "border-l-4 border-l-emerald-500 border-emerald-200 dark:border-emerald-900/40" :
                  "border-l-4 border-l-amber-500 border-amber-200 dark:border-amber-900/40"
                )}
              >
                <SeverityIcon severity={ins.severity} />
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{ins.title}</p>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mt-0.5">{ins.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action now */}
      {data.action_now.length > 0 && (
        <div className="neo-card p-5 space-y-3">
          <SectionTitle icon={ListChecks}>Langkah Aksi Taktis Berprioritas</SectionTitle>
          <ul className="space-y-2">
            {data.action_now.map((a, i) => (
              <li key={i} className="flex gap-2.5 text-xs font-medium text-slate-800 dark:text-slate-200 bg-slate-50 dark:bg-slate-900/60 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                <span className="text-brand-600 dark:text-brand-400 font-mono font-bold shrink-0">{i + 1}.</span>
                <span className="leading-relaxed">{a}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Goal advice */}
      {data.goal_advice.length > 0 && (
        <div className="neo-card p-5 space-y-3">
          <SectionTitle icon={Target}>Analisis Kecepatan &amp; Kelayakan Goal</SectionTitle>
          <div className="space-y-2.5 divide-y divide-slate-100 dark:divide-slate-800/80">
            {data.goal_advice.map((g, i) => (
              <div key={i} className={cn(i > 0 && "pt-2.5")}>
                <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{g.goal_name}</p>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mt-0.5">{g.advice}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Suggested budgets */}
      {data.suggested_budgets.length > 0 && (
        <div className="neo-card p-5 space-y-3">
          <SectionTitle icon={Wallet}>
            Usulan Budget Terukur — {data.next_period_title}
          </SectionTitle>
          <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
            {data.suggested_budgets.map((s) => (
              <div key={s.category_id} className="py-2.5 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{s.category_name}</p>
                  {s.reason && <p className="text-xs text-slate-500 dark:text-slate-400 leading-snug mt-0.5">{s.reason}</p>}
                </div>
                <span className="text-sm font-mono font-bold text-brand-600 dark:text-brand-400 shrink-0">
                  {formatIDR(s.amount)}
                </span>
              </div>
            ))}
          </div>

          {applied ? (
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl p-3">
              <Check className="w-4 h-4" /> Budget {data.next_period_title} berhasil diterapkan!
            </div>
          ) : (
            <button
              onClick={() => applyBudgets()}
              disabled={applying}
              className="btn-primary w-full py-3.5 rounded-xl font-bold text-sm shadow-sm"
            >
              {applying ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>Terapkan ke Budget {data.next_period_title}</>
              )}
            </button>
          )}
          <p className="text-[11px] text-slate-400 text-center">
            Tetap dapat Anda sesuaikan manual di menu Pengaturan setelah diterapkan.
          </p>
        </div>
      )}

      {error && <p className="text-sm font-semibold text-rose-600 dark:text-rose-400 px-1">{error}</p>}

      <button
        onClick={() => analyze()}
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 font-bold py-3 text-xs hover:bg-slate-50 dark:hover:bg-slate-800/80 transition disabled:opacity-60 shadow-sm active:scale-[0.99]"
      >
        {loading ? (
          <><Loader2 className="w-4 h-4 animate-spin text-brand-600" /> Menganalisa ulang di background...</>
        ) : (
          <><RefreshCw className="w-4 h-4" /> Analisa Ulang (Audit Baru)</>
        )}
      </button>
    </div>
  );
}

function SectionTitle({ icon: Icon, children }: { icon: React.ElementType; children: React.ReactNode }) {
  return (
    <h3 className="flex items-center gap-1.5 text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
      <Icon className="w-4 h-4 text-brand-600 dark:text-brand-400" />
      {children}
    </h3>
  );
}

function HealthBadge({ health }: { health: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    sehat: { label: "Sehat", cls: "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800" },
    waspada: { label: "Waspada", cls: "bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800" },
    boncos: { label: "Boncos", cls: "bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800" },
  };
  const m = map[health] ?? { label: health || "—", cls: "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700" };
  return <span className={cn("text-xs font-bold px-3 py-1 rounded-full border", m.cls)}>{m.label}</span>;
}

function SeverityIcon({ severity }: { severity: string }) {
  if (severity === "good") return <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />;
  if (severity === "danger") return <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />;
  return <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />;
}

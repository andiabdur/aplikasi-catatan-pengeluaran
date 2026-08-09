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
    <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 dark:bg-slate-700 rounded-xl">
      <button
        type="button"
        onClick={() => setTab("analisa")}
        className={cn(
          "flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition",
          tab === "analisa" ? "bg-white dark:bg-slate-600 text-brand-700 dark:text-brand-300 shadow-sm" : "text-slate-500 dark:text-slate-400",
        )}
      >
        <BarChart3 className="w-4 h-4" />
        <span>Analisa {loading && "..."}</span>
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
        <FinancialChat householdId={householdId} fullPage />
      </div>
    );
  }

  // Loading indicator banner when analysis is processing in background
  const loadingBanner = loading && (
    <div className="card bg-brand-50 dark:bg-brand-900/30 border-brand-200 dark:border-brand-800 p-4 space-y-2 text-center animate-pulse">
      <div className="flex items-center justify-center gap-2 text-brand-700 dark:text-brand-300 font-semibold text-sm">
        <Loader2 className="w-5 h-5 animate-spin text-brand-600 dark:text-brand-400" />
        <span>Sedang Menganalisis Keuangan Keluarga...</span>
      </div>
      <p className="text-xs text-brand-600 dark:text-brand-400">
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
          <div className="card text-center py-8 space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-brand-100 dark:bg-brand-500/20 text-brand-600 dark:text-brand-400 flex items-center justify-center mx-auto">
              <Sparkles className="w-7 h-7" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-900 dark:text-slate-100">Audit CFO &amp; Diagnosa Keuangan AI</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                AI CFO akan melakukan audit teknis mendalam atas indikator cashflow, Savings Rate %, Burn Rate, serta mengevaluasi kesesuaian dengan memori &amp; target keluarga Anda.
              </p>
            </div>
            <button onClick={() => analyze()} disabled={loading} className="btn-primary w-full">
              {loading ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> Menganalisa di background...</>
              ) : (
                <><Sparkles className="w-5 h-5" /> Audit Keuangan Keluarga Mendalam</>
              )}
            </button>
            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {tabBar}
      {loadingBanner}

      {/* Summary + health */}
      <div className="card space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">
            Diagnosa Eksekutif CFO
          </span>
          <HealthBadge health={data.health} />
        </div>
        <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed font-normal">{data.summary}</p>
        {data.periods_analyzed.length > 0 && (
          <p className="text-[11px] text-slate-400">
            Audit berbasis {data.periods_analyzed.length} periode: {data.periods_analyzed.join(", ")}
          </p>
        )}
      </div>

      {/* Insights */}
      {data.insights.length > 0 && (
        <div className="card space-y-3">
          <SectionTitle icon={TrendingUp}>Temuan Analitis Mendalam</SectionTitle>
          <div className="space-y-2.5 divide-y divide-slate-100 dark:divide-slate-800/60">
            {data.insights.map((ins, i) => (
              <div key={i} className={cn("flex gap-2.5", i > 0 && "pt-2.5")}>
                <SeverityIcon severity={ins.severity} />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{ins.title}</p>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mt-0.5">{ins.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action now */}
      {data.action_now.length > 0 && (
        <div className="card space-y-3">
          <SectionTitle icon={ListChecks}>Langkah Aksi Taktis Berprioritas</SectionTitle>
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
          <SectionTitle icon={Target}>Analisis Kecepatan &amp; Kelayakan Goal</SectionTitle>
          <div className="space-y-2.5 divide-y divide-slate-100 dark:divide-slate-800/60">
            {data.goal_advice.map((g, i) => (
              <div key={i} className={cn(i > 0 && "pt-2.5")}>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{g.goal_name}</p>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mt-0.5">{g.advice}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Suggested budgets */}
      {data.suggested_budgets.length > 0 && (
        <div className="card space-y-3">
          <SectionTitle icon={Wallet}>
            Usulan Budget Terukur — {data.next_period_title}
          </SectionTitle>
          <div className="divide-y divide-slate-100 dark:divide-slate-700">
            {data.suggested_budgets.map((s) => (
              <div key={s.category_id} className="py-2.5 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{s.category_name}</p>
                  {s.reason && <p className="text-xs text-slate-500 dark:text-slate-400 leading-snug mt-0.5">{s.reason}</p>}
                </div>
                <span className="text-sm font-bold text-brand-700 dark:text-brand-300 shrink-0">
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
            <button onClick={() => applyBudgets()} disabled={applying} className="btn-primary w-full">
              {applying ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>Terapkan ke budget {data.next_period_title}</>
              )}
            </button>
          )}
          <p className="text-[11px] text-slate-400 text-center">
            Tetap bisa Anda ubah manual di menu Atur setelah diterapkan.
          </p>
        </div>
      )}

      {error && <p className="text-sm text-red-600 dark:text-red-400 px-1">{error}</p>}

      <button
        onClick={() => analyze()}
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold py-2.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-700/50 transition disabled:opacity-60"
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

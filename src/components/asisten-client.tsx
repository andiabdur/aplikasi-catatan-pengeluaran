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
    <div className="flex p-1 bg-white dark:bg-surface-dark border-4 border-slate-950 dark:border-slate-100 rounded-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)] gap-2">
      <button
        type="button"
        onClick={() => setTab("analisa")}
        className={cn(
          "flex-1 py-2.5 text-center font-headline text-xs font-bold uppercase tracking-widest rounded-none border-2 transition-all flex items-center justify-center gap-1.5",
          tab === "analisa"
            ? "bg-brand-500 text-slate-950 border-slate-950 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
            : "text-slate-700 dark:text-slate-300 border-transparent hover:bg-slate-950 hover:text-white dark:hover:bg-slate-100 dark:hover:text-slate-950"
        )}
      >
        <BarChart3 className="w-4 h-4" />
        <span>Audit CFO {loading && "..."}</span>
      </button>
      <button
        type="button"
        onClick={() => setTab("chat")}
        className={cn(
          "flex-1 py-2.5 text-center font-headline text-xs font-bold uppercase tracking-widest rounded-none border-2 transition-all flex items-center justify-center gap-1.5",
          tab === "chat"
            ? "bg-brand-500 text-slate-950 border-slate-950 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
            : "text-slate-700 dark:text-slate-300 border-transparent hover:bg-slate-950 hover:text-white dark:hover:bg-slate-100 dark:hover:text-slate-950"
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
    <div className="bg-brand-500/10 border-4 border-slate-950 dark:border-slate-100 rounded-none p-4 space-y-2 text-center animate-pulse shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
      <div className="flex items-center justify-center gap-2 text-slate-950 dark:text-slate-100 font-headline font-bold text-sm uppercase tracking-wider">
        <Loader2 className="w-5 h-5 animate-spin text-brand-500" />
        <span>Menganalisis Keuangan Keluarga...</span>
      </div>
      <p className="text-xs font-mono text-slate-700 dark:text-slate-300 leading-relaxed uppercase">
        AI membaca cashflow & memori keluarga di background. Anda bebas berpindah halaman!
      </p>
    </div>
  );

  if (!data) {
    return (
      <div className="space-y-4">
        {tabBar}
        {loadingBanner}
        {!loading && (
          <div className="bg-white dark:bg-surface-dark border-4 border-slate-950 dark:border-slate-100 rounded-none text-center py-10 px-6 space-y-4 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] dark:shadow-[6px_6px_0px_0px_rgba(255,255,255,1)]">
            <div className="w-16 h-16 rounded-none bg-brand-500 text-slate-950 border-4 border-slate-950 dark:border-slate-100 flex items-center justify-center mx-auto shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <Sparkles className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-lg font-headline font-bold text-slate-950 dark:text-slate-100 uppercase tracking-tight">Audit CFO &amp; Diagnosa Keuangan AI</h2>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1.5 leading-relaxed max-w-sm mx-auto">
                AI CFO akan melakukan audit teknis mendalam atas indikator cashflow, Savings Rate %, Burn Rate, serta memori keuangan keluarga Anda.
              </p>
            </div>
            <button
              onClick={() => analyze()}
              disabled={loading}
              className="w-full py-4 text-sm bg-brand-500 text-slate-950 hover:bg-brand-400 font-headline font-black uppercase tracking-wider rounded-none border-4 border-slate-950 dark:border-slate-100 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] dark:shadow-[6px_6px_0px_0px_rgba(255,255,255,1)] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none transition-all flex items-center justify-center gap-2"
            >
              {loading ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> Menganalisa di background...</>
              ) : (
                <><Sparkles className="w-5 h-5" /> Mulai Audit Keuangan Keluarga</>
              )}
            </button>
            {error && <p className="text-xs font-mono font-bold text-rose-600 dark:text-rose-400 uppercase">{error}</p>}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {tabBar}
      {loadingBanner}

      {/* Summary + health (Bauhaus V2 Diagnostic Card) */}
      <section className="bg-white dark:bg-surface-dark border-4 border-slate-950 dark:border-slate-100 rounded-none p-5 space-y-3 relative overflow-hidden shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] dark:shadow-[6px_6px_0px_0px_rgba(255,255,255,1)]">
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-brand-500 opacity-20 rotate-45 border-4 border-slate-950 pointer-events-none" />
        <div className="flex items-center justify-between relative z-10">
          <span className="text-xs font-headline font-bold text-slate-950 dark:text-slate-100 uppercase tracking-widest">
            Health Status
          </span>
          <HealthBadge health={data.health} />
        </div>
        <p className="text-sm font-headline font-bold text-slate-950 dark:text-slate-100 leading-relaxed relative z-10">{data.summary}</p>
        {data.periods_analyzed.length > 0 && (
          <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 relative z-10">
            Audit berbasis {data.periods_analyzed.length} periode: {data.periods_analyzed.join(", ")}
          </p>
        )}
      </section>

      {/* Insights / Anomalies */}
      {data.insights.length > 0 && (
        <section className="bg-white dark:bg-surface-dark border-4 border-slate-950 dark:border-slate-100 rounded-none p-5 space-y-3 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] dark:shadow-[6px_6px_0px_0px_rgba(255,255,255,1)]">
          <SectionTitle icon={TrendingUp}>Temuan &amp; Anomali Finansial</SectionTitle>
          <div className="space-y-3">
            {data.insights.map((ins, i) => (
              <div
                key={i}
                className={cn(
                  "p-3.5 rounded-none border-2 border-slate-950 dark:border-slate-100 flex gap-3 items-start bg-slate-50 dark:bg-slate-950 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,1)]",
                  ins.severity === "danger" ? "border-l-8 border-l-rose-500" :
                  ins.severity === "good" ? "border-l-8 border-l-emerald-500" :
                  "border-l-8 border-l-amber-400"
                )}
              >
                <SeverityIcon severity={ins.severity} />
                <div className="min-w-0">
                  <p className="text-xs font-headline font-bold uppercase tracking-wider text-slate-950 dark:text-slate-100">{ins.title}</p>
                  <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed mt-1 border-t border-slate-200 dark:border-slate-800 pt-1">{ins.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Action now */}
      {data.action_now.length > 0 && (
        <section className="bg-white dark:bg-surface-dark border-4 border-slate-950 dark:border-slate-100 rounded-none p-5 space-y-3 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] dark:shadow-[6px_6px_0px_0px_rgba(255,255,255,1)]">
          <SectionTitle icon={ListChecks}>Action Plan Taktis</SectionTitle>
          <ul className="space-y-2">
            {data.action_now.map((a, i) => (
              <li key={i} className="flex gap-2.5 text-xs font-bold text-slate-950 dark:text-slate-100 bg-slate-50 dark:bg-slate-950 p-3 rounded-none border-2 border-slate-950 dark:border-slate-100 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                <span className="text-brand-600 dark:text-brand-400 font-mono font-black shrink-0">{i + 1}.</span>
                <span className="leading-relaxed font-headline uppercase">{a}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Goal advice */}
      {data.goal_advice.length > 0 && (
        <section className="bg-white dark:bg-surface-dark border-4 border-slate-950 dark:border-slate-100 rounded-none p-5 space-y-3 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] dark:shadow-[6px_6px_0px_0px_rgba(255,255,255,1)]">
          <SectionTitle icon={Target}>Analisis Kelayakan Goal</SectionTitle>
          <div className="space-y-2.5 divide-y-2 divide-slate-100 dark:divide-slate-800">
            {data.goal_advice.map((g, i) => (
              <div key={i} className={cn(i > 0 && "pt-2.5")}>
                <p className="text-sm font-headline font-bold uppercase tracking-wider text-slate-950 dark:text-slate-100">{g.goal_name}</p>
                <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed mt-0.5">{g.advice}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Suggested budgets */}
      {data.suggested_budgets.length > 0 && (
        <section className="bg-white dark:bg-surface-dark border-4 border-slate-950 dark:border-slate-100 rounded-none p-5 space-y-3 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] dark:shadow-[6px_6px_0px_0px_rgba(255,255,255,1)]">
          <SectionTitle icon={Wallet}>
            Usulan Budget — {data.next_period_title}
          </SectionTitle>
          <div className="divide-y-2 divide-slate-100 dark:divide-slate-800">
            {data.suggested_budgets.map((s) => (
              <div key={s.category_id} className="py-2.5 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-headline font-bold uppercase tracking-wider text-slate-950 dark:text-slate-100">{s.category_name}</p>
                  {s.reason && <p className="text-xs text-slate-500 dark:text-slate-400 leading-snug mt-0.5">{s.reason}</p>}
                </div>
                <span className="text-sm font-mono font-black text-slate-950 dark:text-slate-100 shrink-0">
                  {formatIDR(s.amount)}
                </span>
              </div>
            ))}
          </div>

          {applied ? (
            <div className="flex items-center gap-2 text-xs font-headline font-bold uppercase text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/60 border-2 border-emerald-500 rounded-none p-3 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              <Check className="w-4 h-4" /> Budget {data.next_period_title} berhasil diterapkan!
            </div>
          ) : (
            <button
              onClick={() => applyBudgets()}
              disabled={applying}
              className="w-full py-3.5 bg-brand-500 text-slate-950 hover:bg-brand-400 font-headline font-black uppercase tracking-wider rounded-none border-2 border-slate-950 dark:border-slate-100 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all flex items-center justify-center gap-2"
            >
              {applying ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>Terapkan ke Budget {data.next_period_title}</>
              )}
            </button>
          )}
          <p className="text-[10px] font-mono uppercase tracking-wider text-slate-500 text-center">
            Dapat disesuaikan manual di Pengaturan setelah diterapkan.
          </p>
        </section>
      )}

      {error && <p className="text-xs font-mono font-bold text-rose-600 dark:text-rose-400 px-1 uppercase">{error}</p>}

      <button
        onClick={() => analyze()}
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 rounded-none border-2 border-slate-950 dark:border-slate-100 bg-white dark:bg-slate-900 text-slate-950 dark:text-slate-100 font-headline font-bold uppercase py-3 text-xs shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,1)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition disabled:opacity-60"
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
    <h3 className="flex items-center gap-1.5 text-sm font-headline font-bold text-slate-950 dark:text-slate-100 uppercase tracking-wider">
      <Icon className="w-4 h-4 text-brand-500" />
      {children}
    </h3>
  );
}

function HealthBadge({ health }: { health: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    sehat: { label: "Sehat", cls: "bg-emerald-400 text-slate-950 border-slate-950" },
    waspada: { label: "Waspada", cls: "bg-amber-400 text-slate-950 border-slate-950" },
    boncos: { label: "Boncos", cls: "bg-rose-500 text-white border-slate-950" },
  };
  const m = map[health] ?? { label: health || "—", cls: "bg-slate-200 text-slate-950 border-slate-950" };
  return (
    <span className={cn("text-xs font-headline font-black uppercase px-3 py-1 rounded-none border-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] tracking-wider inline-flex items-center gap-1", m.cls)}>
      <CheckCircle2 className="w-3.5 h-3.5" />
      {m.label}
    </span>
  );
}

function SeverityIcon({ severity }: { severity: string }) {
  if (severity === "good") return <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />;
  if (severity === "danger") return <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />;
  return <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />;
}

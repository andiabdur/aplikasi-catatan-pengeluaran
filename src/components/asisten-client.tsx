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

export function AsistenClient({
  householdId,
  initialTab = "analisa",
}: {
  householdId: string;
  initialTab?: "analisa" | "chat";
}) {
  const [tab, setTab] = useState<"analisa" | "chat">(initialTab);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

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
    <div
      role="tablist"
      aria-label="Mode Asisten Keuangan"
      className="flex p-1 bg-muted border border-border rounded-2xl gap-1"
    >
      <button
        type="button"
        role="tab"
        aria-selected={tab === "analisa"}
        onClick={() => setTab("analisa")}
        className={cn(
          "flex-1 min-h-[44px] py-2 text-center text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          tab === "analisa"
            ? "bg-card text-foreground font-semibold shadow-sm"
            : "text-muted-foreground font-medium hover:text-foreground"
        )}
      >
        <BarChart3 className="w-4 h-4" />
        <span>Audit CFO {loading ? "..." : ""}</span>
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={tab === "chat"}
        onClick={() => setTab("chat")}
        className={cn(
          "flex-1 min-h-[44px] py-2 text-center text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          tab === "chat"
            ? "bg-card text-foreground font-semibold shadow-sm"
            : "text-muted-foreground font-medium hover:text-foreground"
        )}
      >
        <MessageCircle className="w-4 h-4" />
        <span>Chat AI</span>
      </button>
    </div>
  );

  if (tab === "chat") {
    return (
      <div className="fixed inset-x-0 top-[68px] bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-20 bg-background flex flex-col">
        <div className="mx-auto w-full max-w-md flex-1 min-h-0 flex flex-col">
          <div className="px-4 pt-3 pb-2 shrink-0">{tabBar}</div>
          <FinancialChat householdId={householdId} />
        </div>
      </div>
    );
  }

  const loadingBanner = loading && (
    <div className="bg-accent/70 border border-brand-200 dark:border-brand-800/50 rounded-2xl p-4 space-y-1.5 text-center shadow-sm">
      <div className="flex items-center justify-center gap-2 text-foreground font-semibold text-sm">
        <Loader2 className="w-4 h-4 animate-spin text-primary" />
        <span>Menganalisis Keuangan Keluarga...</span>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">
        AI membaca cashflow &amp; memori keluarga di background. Anda bebas berpindah halaman.
      </p>
    </div>
  );

  if (!data) {
    return (
      <div className="space-y-4">
        {tabBar}
        {loadingBanner}
        {!loading && (
          <div className="bg-card border border-border rounded-2xl text-center py-10 px-6 space-y-4 shadow-sm">
            <div className="w-14 h-14 rounded-2xl bg-accent text-primary border border-brand-200 dark:border-brand-800/40 flex items-center justify-center mx-auto">
              <Sparkles className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">Audit CFO &amp; Diagnosa Keuangan AI</h2>
              <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed max-w-sm mx-auto">
                AI CFO akan melakukan audit teknis mendalam atas indikator cashflow, Savings Rate %, Burn Rate, serta memori keuangan keluarga Anda.
              </p>
            </div>
            <button
              type="button"
              onClick={() => analyze()}
              disabled={loading}
              className="w-full min-h-[48px] py-3 text-sm bg-primary text-primary-foreground hover:bg-primary/90 font-semibold rounded-xl shadow-sm active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            >
              {loading ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> Menganalisa di background...</>
              ) : (
                <><Sparkles className="w-5 h-5" /> Mulai Audit Keuangan Keluarga</>
              )}
            </button>
            {error && <p className="text-xs font-medium text-rose-700 dark:text-rose-300">{error}</p>}
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
      <section className="bg-card border border-border rounded-2xl p-5 space-y-3 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-muted-foreground">
            Health Status
          </span>
          <HealthBadge health={data.health} />
        </div>
        <p className="text-sm font-medium text-foreground leading-relaxed">{data.summary}</p>
        {data.periods_analyzed.length > 0 && (
          <p className="text-xs font-mono text-muted-foreground">
            Audit berbasis {data.periods_analyzed.length} periode: {data.periods_analyzed.join(", ")}
          </p>
        )}
      </section>

      {/* Insights / Anomalies */}
      {data.insights.length > 0 && (
        <section className="bg-card border border-border rounded-2xl p-5 space-y-3 shadow-sm">
          <SectionTitle icon={TrendingUp}>Temuan &amp; Anomali Finansial</SectionTitle>
          <div className="space-y-2.5">
            {data.insights.map((ins, i) => (
              <div
                key={i}
                className={cn(
                  "p-3.5 rounded-xl border flex gap-3 items-start bg-background border-l-4",
                  ins.severity === "danger" ? "border-border border-l-rose-600 dark:border-l-rose-400" :
                  ins.severity === "good" ? "border-border border-l-teal-600 dark:border-l-teal-400" :
                  "border-border border-l-amber-500 dark:border-l-amber-400"
                )}
              >
                <SeverityIcon severity={ins.severity} />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-foreground">{ins.title}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed mt-1">{ins.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Action now */}
      {data.action_now.length > 0 && (
        <section className="bg-card border border-border rounded-2xl p-5 space-y-3 shadow-sm">
          <SectionTitle icon={ListChecks}>Action Plan Taktis</SectionTitle>
          <ul className="space-y-2">
            {data.action_now.map((a, i) => (
              <li key={i} className="flex gap-2.5 text-xs text-foreground bg-muted/50 p-3 rounded-xl border border-border">
                <span className="text-primary font-mono font-bold shrink-0">{i + 1}.</span>
                <span className="leading-relaxed font-medium">{a}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Goal advice */}
      {data.goal_advice.length > 0 && (
        <section className="bg-card border border-border rounded-2xl p-5 space-y-3 shadow-sm">
          <SectionTitle icon={Target}>Analisis Kelayakan Goal</SectionTitle>
          <div className="space-y-2.5 divide-y divide-border">
            {data.goal_advice.map((g, i) => (
              <div key={i} className={cn(i > 0 && "pt-2.5")}>
                <p className="text-sm font-semibold text-foreground">{g.goal_name}</p>
                <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">{g.advice}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Suggested budgets */}
      {data.suggested_budgets.length > 0 && (
        <section className="bg-card border border-border rounded-2xl p-5 space-y-3 shadow-sm">
          <SectionTitle icon={Wallet}>
            Usulan Budget: {data.next_period_title}
          </SectionTitle>
          <div className="divide-y divide-border">
            {data.suggested_budgets.map((s) => (
              <div key={s.category_id} className="py-2.5 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">{s.category_name}</p>
                  {s.reason && <p className="text-xs text-muted-foreground leading-snug mt-0.5">{s.reason}</p>}
                </div>
                <span className="text-sm font-mono font-semibold text-foreground shrink-0 tabular-nums">
                  {formatIDR(s.amount)}
                </span>
              </div>
            ))}
          </div>

          {applied ? (
            <div className="flex items-center gap-2 text-xs font-semibold text-teal-800 dark:text-teal-200 bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800/60 rounded-xl p-3">
              <Check className="w-4 h-4" /> Budget {data.next_period_title} berhasil diterapkan!
            </div>
          ) : (
            <button
              type="button"
              onClick={() => applyBudgets()}
              disabled={applying}
              className="w-full min-h-[46px] py-3 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold text-sm rounded-xl shadow-sm active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            >
              {applying ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>Terapkan ke Budget {data.next_period_title}</>
              )}
            </button>
          )}
          <p className="text-xs text-muted-foreground text-center">
            Dapat disesuaikan manual di Pengaturan setelah diterapkan.
          </p>
        </section>
      )}

      {error && <p className="text-xs font-medium text-rose-700 dark:text-rose-300 px-1">{error}</p>}

      <button
        type="button"
        onClick={() => analyze()}
        disabled={loading}
        className="w-full min-h-[44px] flex items-center justify-center gap-2 rounded-xl border border-border bg-card text-foreground font-semibold py-2.5 text-xs hover:bg-muted active:scale-[0.98] transition-all disabled:opacity-60"
      >
        {loading ? (
          <><Loader2 className="w-4 h-4 animate-spin text-primary" /> Menganalisa ulang di background...</>
        ) : (
          <><RefreshCw className="w-4 h-4" /> Analisa Ulang (Audit Baru)</>
        )}
      </button>
    </div>
  );
}

function SectionTitle({ icon: Icon, children }: { icon: React.ElementType; children: React.ReactNode }) {
  return (
    <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
      <Icon className="w-4 h-4 text-primary" />
      {children}
    </h3>
  );
}

function HealthBadge({ health }: { health: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    sehat: { label: "Sehat", cls: "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-800/60" },
    waspada: { label: "Waspada", cls: "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/60" },
    boncos: { label: "Boncos", cls: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/60" },
  };
  const m = map[health] ?? { label: health || "-", cls: "bg-muted text-muted-foreground border-border" };
  return (
    <span className={cn("text-xs font-semibold px-2.5 py-1 rounded-full border inline-flex items-center gap-1", m.cls)}>
      <CheckCircle2 className="w-3.5 h-3.5" />
      {m.label}
    </span>
  );
}

function SeverityIcon({ severity }: { severity: string }) {
  if (severity === "good") return <CheckCircle2 className="w-4 h-4 text-teal-700 dark:text-teal-300 shrink-0 mt-0.5" />;
  if (severity === "danger") return <AlertTriangle className="w-4 h-4 text-rose-700 dark:text-rose-300 shrink-0 mt-0.5" />;
  return <AlertTriangle className="w-4 h-4 text-amber-700 dark:text-amber-300 shrink-0 mt-0.5" />;
}

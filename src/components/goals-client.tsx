"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Archive,
  ArrowDownLeft,
  ArrowRightLeft,
  ArrowUpRight,
  Calendar,
  Car,
  Check,
  ChevronDown,
  ChevronUp,
  Coins,
  Compass,
  Gift,
  GraduationCap,
  Heart,
  HelpCircle,
  Home,
  Loader2,
  Palmtree,
  Pencil,
  Plane,
  Plus,
  RotateCcw,
  Smartphone,
  Stethoscope,
  Target,
  Trash2,
  Trophy,
  Wallet,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatIDR, formatIDRInput, parseIDRInput } from "@/lib/format";
import { addDays, diffDaysInclusive, formatCompactIDR, formatDateShort } from "@/lib/analysis";
import { currentPeriodLabelWithCustom, labelMonthKey, periodTitle, shiftPeriod } from "@/lib/period";
import type { GoalStatus, GoalWithProgress } from "@/lib/types";
import { cn } from "@/lib/utils";

export type GoalTransactionItem = {
  id: string;
  type: "deposit" | "withdraw";
  date: string;
  monthKey?: string;
  title: string;
  note: string | null;
  amount: number;
};

export type GoalWithDetails = GoalWithProgress & {
  totalDeposited: number;
  totalWithdrawn: number;
  depositCount: number;
  withdrawCount: number;
  depositedThisPeriod: number;
  transactions: GoalTransactionItem[];
};

const ICON_MAP = {
  target: Target,
  plane: Plane,
  home: Home,
  car: Car,
  "graduation-cap": GraduationCap,
  heart: Heart,
  smartphone: Smartphone,
  "palm-tree": Palmtree,
  coins: Coins,
  gift: Gift,
  compass: Compass,
  stethoscope: Stethoscope,
};

const LEGACY_EMOJI_TO_ICON: Record<string, string> = {
  "\u{1F3AF}": "target",
  "\u{1F54B}": "compass",
  "\u{2708}\u{FE0F}": "plane",
  "\u{2708}": "plane",
  "\u{1F3E0}": "home",
  "\u{1F697}": "car",
  "\u{1F393}": "graduation-cap",
  "\u{1F48D}": "heart",
  "\u{1F4F1}": "smartphone",
  "\u{1F3D6}\u{FE0F}": "palm-tree",
  "\u{1F3D6}": "palm-tree",
  "\u{1F4B0}": "coins",
  "\u{1F381}": "gift",
  "\u{1FA7A}": "stethoscope",
};

const ICON_CHOICES = [
  "target",
  "coins",
  "compass",
  "plane",
  "home",
  "car",
  "graduation-cap",
  "heart",
  "smartphone",
  "palm-tree",
  "gift",
  "stethoscope",
];

const COLOR_SWATCHES = [
  { hex: "#B85138", label: "Terracotta" },
  { hex: "#0F766E", label: "Teal" },
  { hex: "#B45309", label: "Amber" },
  { hex: "#4F46E5", label: "Indigo" },
  { hex: "#BE123C", label: "Rose" },
  { hex: "#2563EB", label: "Blue" },
  { hex: "#4D7C0F", label: "Olive" },
  { hex: "#7E22CE", label: "Violet" },
];

const GOAL_TEMPLATES = [
  { name: "Dana Darurat", emoji: "coins", color: "#0F766E" },
  { name: "Umroh", emoji: "compass", color: "#4D7C0F" },
  { name: "Liburan Keluarga", emoji: "plane", color: "#B85138" },
  { name: "Pendidikan Anak", emoji: "graduation-cap", color: "#4F46E5" },
  { name: "DP Rumah", emoji: "home", color: "#B45309" },
  { name: "Kendaraan", emoji: "car", color: "#2563EB" },
];

function GoalIcon({
  iconNameOrEmoji,
  className = "w-5 h-5",
  style,
}: {
  iconNameOrEmoji: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const name = LEGACY_EMOJI_TO_ICON[iconNameOrEmoji] || iconNameOrEmoji || "target";
  const IconComponent = ICON_MAP[name as keyof typeof ICON_MAP] || HelpCircle;
  return <IconComponent className={className} style={style} />;
}

function formatTargetDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y || 1970, (m || 1) - 1, d || 1).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function isGeneralGoalName(name: string): boolean {
  return /general|umum/i.test(name);
}

function computeTargetPace(
  targetAmount: number,
  saved: number,
  targetDate: string | null,
  todayStr: string
): { overdue: boolean; label: string } | null {
  if (!targetDate || targetAmount <= 0 || saved >= targetAmount) return null;
  const remaining = targetAmount - saved;

  if (targetDate < todayStr) {
    return { overdue: true, label: "Lewat tenggat target" };
  }
  if (targetDate === todayStr) {
    return { overdue: false, label: `Tenggat hari ini (kurang ${formatCompactIDR(remaining)})` };
  }

  const daysLeft = Math.max(1, diffDaysInclusive(todayStr, targetDate) - 1);
  if (daysLeft < 30) {
    return {
      overdue: false,
      label: `Perlu ${formatCompactIDR(remaining)} dalam ${daysLeft} hari`,
    };
  }

  const monthsExact = daysLeft / 30.44;
  const perMonth = Math.round(remaining / monthsExact);
  const monthsRounded = Math.max(1, Math.round(monthsExact));
  return {
    overdue: false,
    label: `Perlu ~${formatCompactIDR(perMonth)}/bln · ${monthsRounded} bln lagi`,
  };
}

type StatusTab = "active" | "achieved" | "archived";
type EditState =
  | { mode: "closed" }
  | { mode: "new" }
  | { mode: "edit"; goal: GoalWithDetails };

export function GoalsClient({
  householdId,
  todayStr,
  initialGoals,
  savingsCategoryId,
  payDay = 25,
  customPeriods = [],
  currentPeriodTitle,
}: {
  householdId: string;
  todayStr: string;
  initialGoals: GoalWithDetails[];
  savingsCategoryId: string | null;
  payDay?: number;
  customPeriods?: { label_month: string; start_date: string; end_date: string }[];
  currentPeriodTitle: string;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [statusTab, setStatusTab] = useState<StatusTab>("active");
  const [expandedGoalId, setExpandedGoalId] = useState<string | null>(null);
  const [edit, setEdit] = useState<EditState>({ mode: "closed" });
  const [depositGoal, setDepositGoal] = useState<GoalWithDetails | null>(null);
  const [withdrawGoal, setWithdrawGoal] = useState<GoalWithDetails | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<GoalWithDetails | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const goals = initialGoals;
  const activeGoals = useMemo(() => goals.filter((g) => g.status === "active"), [goals]);
  const achievedGoals = useMemo(() => goals.filter((g) => g.status === "achieved"), [goals]);
  const archivedGoals = useMemo(() => goals.filter((g) => g.status === "archived"), [goals]);

  const tabGoals = useMemo(() => {
    const list =
      statusTab === "active"
        ? activeGoals
        : statusTab === "achieved"
          ? achievedGoals
          : archivedGoals;
    return list.slice().sort((a, b) => {
      const aGen = isGeneralGoalName(a.name) && a.target_amount <= 0 ? 1 : 0;
      const bGen = isGeneralGoalName(b.name) && b.target_amount <= 0 ? 1 : 0;
      if (aGen !== bGen) return aGen - bGen;
      return (a.sort_order ?? 0) - (b.sort_order ?? 0);
    });
  }, [statusTab, activeGoals, achievedGoals, archivedGoals]);

  const portfolio = useMemo(() => {
    const totalActiveSaved = activeGoals.reduce((s, g) => s + g.saved, 0);
    const depositedThisPeriod = goals.reduce((s, g) => s + g.depositedThisPeriod, 0);
    const targetedActive = activeGoals.filter((g) => g.target_amount > 0);
    const totalTarget = targetedActive.reduce((s, g) => s + g.target_amount, 0);
    const savedTowardTarget = targetedActive.reduce(
      (s, g) => s + Math.min(g.saved, g.target_amount),
      0
    );
    const overallPct = totalTarget > 0 ? Math.min(100, Math.round((savedTowardTarget / totalTarget) * 100)) : 0;
    const totalRemaining = Math.max(0, totalTarget - savedTowardTarget);
    const positiveShareGoals = activeGoals.filter((g) => g.saved > 0);

    return {
      totalActiveSaved,
      depositedThisPeriod,
      totalTarget,
      overallPct,
      totalRemaining,
      positiveShareGoals,
    };
  }, [activeGoals, goals]);

  async function setStatus(id: string, status: GoalStatus) {
    setBusyId(id);
    try {
      const supabase = createClient();
      await supabase
        .from("goals")
        .update({ status })
        .eq("id", id)
        .eq("household_id", householdId);
      startTransition(() => router.refresh());
    } finally {
      setBusyId(null);
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const supabase = createClient();
      await supabase
        .from("goals")
        .delete()
        .eq("id", deleteTarget.id)
        .eq("household_id", householdId);
      if (expandedGoalId === deleteTarget.id) {
        setExpandedGoalId(null);
      }
      setDeleteTarget(null);
      startTransition(() => router.refresh());
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-4 pb-12">
      {/* A. Hero Portfolio Summary Card */}
      <section className="bg-card border border-border rounded-2xl p-4 shadow-sm space-y-3.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Wallet className="w-3.5 h-3.5 text-primary" /> Total Tabungan Aktif
            </p>
            <p className="font-mono text-2xl font-bold text-foreground mt-0.5 tabular-nums truncate">
              {formatIDR(portfolio.totalActiveSaved)}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setEdit({ mode: "new" })}
            className="min-h-[42px] px-3.5 py-2 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold text-xs rounded-xl shadow-sm active:scale-[0.98] inline-flex items-center gap-1.5 transition-all shrink-0"
          >
            <Plus className="w-4 h-4" />
            Target Baru
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-xl bg-teal-50/70 dark:bg-teal-950/30 border border-teal-200/80 dark:border-teal-800/50 px-2.5 py-2 min-w-0">
            <p className="text-[10px] font-medium text-teal-800 dark:text-teal-300 truncate" title={currentPeriodTitle}>
              Setor Periode Ini
            </p>
            <p className="font-mono text-xs font-bold text-teal-900 dark:text-teal-200 truncate tabular-nums mt-0.5">
              +{formatCompactIDR(portfolio.depositedThisPeriod)}
            </p>
          </div>

          <div className="rounded-xl bg-accent/70 border border-brand-200/80 dark:border-brand-800/40 px-2.5 py-2 min-w-0">
            <p className="text-[10px] font-medium text-accent-foreground truncate">
              Progress Target
            </p>
            <p className="font-mono text-xs font-bold text-foreground truncate tabular-nums mt-0.5">
              {portfolio.totalTarget > 0 ? `${portfolio.overallPct}%` : "Fleksibel"}
            </p>
          </div>

          <div className="rounded-xl bg-muted/60 border border-border px-2.5 py-2 min-w-0">
            <p className="text-[10px] font-medium text-muted-foreground truncate">
              Sisa Target
            </p>
            <p className="font-mono text-xs font-bold text-foreground truncate tabular-nums mt-0.5">
              {portfolio.totalTarget > 0 ? formatCompactIDR(portfolio.totalRemaining) : "-"}
            </p>
          </div>
        </div>

        {portfolio.totalActiveSaved > 0 && portfolio.positiveShareGoals.length > 1 && (
          <div className="space-y-1.5">
            <div className="h-2 w-full rounded-full overflow-hidden flex bg-muted gap-[1px]">
              {portfolio.positiveShareGoals.map((g) => (
                <div
                  key={g.id}
                  style={{
                    width: `${Math.max(4, (g.saved / portfolio.totalActiveSaved) * 100)}%`,
                    backgroundColor: g.color || "#B85138",
                  }}
                  title={`${g.name}: ${formatIDR(g.saved)}`}
                />
              ))}
            </div>
            <div className="flex items-center gap-2.5 flex-wrap">
              {portfolio.positiveShareGoals.slice(0, 4).map((g) => (
                <span
                  key={g.id}
                  className="inline-flex items-center gap-1 text-[11px] text-muted-foreground"
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: g.color || "#B85138" }}
                  />
                  <span className="truncate max-w-[95px]">{g.name}</span>
                  <span className="font-mono font-medium text-foreground tabular-nums">
                    {Math.round((g.saved / portfolio.totalActiveSaved) * 100)}%
                  </span>
                </span>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* B. Status Filter Tabs */}
      <section className="grid grid-cols-3 gap-1 p-1 bg-muted rounded-xl border border-border">
        {[
          { id: "active" as const, label: `Aktif (${activeGoals.length})` },
          { id: "achieved" as const, label: `Tercapai (${achievedGoals.length})` },
          { id: "archived" as const, label: `Arsip (${archivedGoals.length})` },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setStatusTab(t.id)}
            className={cn(
              "min-h-[36px] rounded-lg text-xs font-semibold transition-all truncate px-1",
              statusTab === t.id
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t.label}
          </button>
        ))}
      </section>

      {/* C. Goals Cards List */}
      {tabGoals.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl text-center py-10 px-4 space-y-3 shadow-sm">
          <div className="w-12 h-12 rounded-2xl bg-accent text-primary border border-brand-200 dark:border-brand-800/40 flex items-center justify-center mx-auto">
            {statusTab === "achieved" ? (
              <Trophy className="w-6 h-6" />
            ) : statusTab === "archived" ? (
              <Archive className="w-6 h-6" />
            ) : (
              <Target className="w-6 h-6" />
            )}
          </div>
          <p className="text-xs text-muted-foreground max-w-xs mx-auto leading-relaxed">
            {statusTab === "achieved"
              ? "Belum ada target yang ditandai tercapai."
              : statusTab === "archived"
                ? "Tidak ada goal yang sedang diarsipkan."
                : "Belum ada target aktif. Buat target pertama keluarga seperti Dana Darurat, Umroh, atau Liburan."}
          </p>
          {statusTab === "active" && (
            <button
              type="button"
              onClick={() => setEdit({ mode: "new" })}
              className="min-h-[40px] px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold rounded-xl shadow-sm inline-flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              Buat Target Pertama
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {tabGoals.map((g) => (
            <GoalCard
              key={g.id}
              goal={g}
              todayStr={todayStr}
              householdId={householdId}
              activeTargets={activeGoals.filter((ag) => ag.id !== g.id)}
              busy={busyId === g.id}
              isExpanded={expandedGoalId === g.id}
              onToggleExpand={() =>
                setExpandedGoalId((prev) => (prev === g.id ? null : g.id))
              }
              onDeposit={() => setDepositGoal(g)}
              onWithdraw={() => setWithdrawGoal(g)}
              onEdit={() => setEdit({ mode: "edit", goal: g })}
              onAchieve={() => setStatus(g.id, "achieved")}
              onArchive={() => setStatus(g.id, "archived")}
              onReactivate={() => setStatus(g.id, "active")}
              onDelete={() => setDeleteTarget(g)}
              onMutated={() => startTransition(() => router.refresh())}
            />
          ))}
        </div>
      )}

      {/* E. Modals */}
      {edit.mode !== "closed" && (
        <GoalEditorModal
          householdId={householdId}
          todayStr={todayStr}
          goal={edit.mode === "edit" ? edit.goal : null}
          existingCount={goals.length}
          onClose={() => setEdit({ mode: "closed" })}
          onSaved={() => {
            setEdit({ mode: "closed" });
            startTransition(() => router.refresh());
          }}
        />
      )}

      {depositGoal && (
        <GoalDepositModal
          goal={depositGoal}
          householdId={householdId}
          todayStr={todayStr}
          savingsCategoryId={savingsCategoryId}
          onClose={() => setDepositGoal(null)}
          onSaved={() => {
            setDepositGoal(null);
            startTransition(() => router.refresh());
          }}
        />
      )}

      {withdrawGoal && (
        <GoalWithdrawModal
          goal={withdrawGoal}
          householdId={householdId}
          payDay={payDay}
          customPeriods={customPeriods}
          onClose={() => setWithdrawGoal(null)}
          onSaved={() => {
            setWithdrawGoal(null);
            startTransition(() => router.refresh());
          }}
        />
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl w-full max-w-sm p-5 shadow-xl space-y-4">
            <div className="space-y-1.5">
              <h3 className="font-semibold text-base text-foreground">
                Hapus Goal &quot;{deleteTarget.name}&quot;?
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Riwayat transaksi setoran tetap aman dan otomatis akan dialihkan kembali ke Tabungan General.
              </p>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setDeleteTarget(null)}
                className="flex-1 min-h-[42px] py-2 bg-secondary text-secondary-foreground font-medium text-xs rounded-xl border border-border hover:bg-muted transition-colors disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleConfirmDelete}
                className="flex-1 min-h-[42px] py-2 bg-destructive text-destructive-foreground hover:bg-destructive/90 font-semibold text-xs rounded-xl shadow-sm transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {deleting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Menghapus...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Hapus Goal
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function GoalCard({
  goal,
  todayStr,
  householdId,
  activeTargets,
  busy,
  isExpanded,
  onToggleExpand,
  onDeposit,
  onWithdraw,
  onEdit,
  onAchieve,
  onArchive,
  onReactivate,
  onDelete,
  onMutated,
}: {
  goal: GoalWithDetails;
  todayStr: string;
  householdId: string;
  activeTargets: GoalWithDetails[];
  busy: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onDeposit: () => void;
  onWithdraw: () => void;
  onEdit: () => void;
  onAchieve: () => void;
  onArchive: () => void;
  onReactivate: () => void;
  onDelete: () => void;
  onMutated: () => void;
}) {
  const isGeneral = isGeneralGoalName(goal.name) && goal.target_amount <= 0;
  const pct =
    goal.target_amount > 0
      ? Math.min(100, Math.round((goal.saved / goal.target_amount) * 100))
      : 0;
  const remaining = Math.max(0, goal.target_amount - goal.saved);
  const reached = goal.target_amount > 0 && goal.saved >= goal.target_amount;
  const isActive = goal.status === "active";
  const pace = isActive
    ? computeTargetPace(goal.target_amount, goal.saved, goal.target_date, todayStr)
    : null;

  const [movingTxId, setMovingTxId] = useState<string | null>(null);
  const [moveTargetGoalId, setMoveTargetGoalId] = useState<string>(
    activeTargets[0]?.id ?? ""
  );
  const [movingSaving, setMovingSaving] = useState(false);

  async function handleReallocate(txId: string) {
    if (!moveTargetGoalId || movingSaving) return;
    setMovingSaving(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("expenses")
        .update({ goal_id: moveTargetGoalId })
        .eq("id", txId)
        .eq("household_id", householdId);
      if (!error) {
        setMovingTxId(null);
        onMutated();
      }
    } finally {
      setMovingSaving(false);
    }
  }

  return (
    <article
      className={cn(
        "bg-card border border-border rounded-2xl p-4 space-y-3 shadow-sm transition-opacity",
        !isActive && "opacity-85"
      )}
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
          style={{ backgroundColor: goal.color || "#B85138" }}
        >
          <GoalIcon iconNameOrEmoji={goal.emoji} className="w-5 h-5 text-white" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <h3 className="font-semibold text-sm text-foreground truncate">{goal.name}</h3>
            {isGeneral && (
              <span className="text-[10px] font-semibold bg-accent text-accent-foreground border border-brand-200 dark:border-brand-800/50 px-2 py-0.5 rounded-full">
                Kas Fleksibel
              </span>
            )}
            {goal.status === "achieved" && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-teal-50 text-teal-800 border border-teal-200 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-800/60 px-2 py-0.5 rounded-full">
                <Trophy className="w-3 h-3" /> Tercapai
              </span>
            )}
            {goal.status === "archived" && (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-muted text-muted-foreground border border-border px-2 py-0.5 rounded-full">
                <Archive className="w-3 h-3" /> Arsip
              </span>
            )}
          </div>

          <div className="flex items-baseline gap-1.5 flex-wrap mt-1">
            <span className="font-mono text-lg font-bold text-foreground tabular-nums">
              {formatIDR(goal.saved)}
            </span>
            {!isGeneral && goal.target_amount > 0 && (
              <span className="text-xs font-mono text-muted-foreground tabular-nums">
                / {formatIDR(goal.target_amount)}
              </span>
            )}
          </div>
        </div>

        {!isGeneral && goal.target_amount > 0 && (
          <span
            className={cn(
              "text-base font-mono font-bold shrink-0 tabular-nums",
              reached ? "text-teal-700 dark:text-teal-300" : "text-primary"
            )}
          >
            {pct}%
          </span>
        )}
      </div>

      {/* Progress Bar */}
      <div className="space-y-1.5">
        <div className="h-2.5 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: isGeneral || goal.target_amount <= 0 ? "100%" : `${pct}%`,
              background: reached ? "#0F766E" : goal.color || "#B85138",
            }}
          />
        </div>

        <div className="flex items-center justify-between gap-2 text-[11px] flex-wrap">
          <div className="text-muted-foreground">
            {isGeneral || goal.target_amount <= 0 ? (
              <span className="text-teal-700 dark:text-teal-300 font-medium">
                Dana siap dicairkan atau dipindah kapan saja
              </span>
            ) : reached ? (
              <span className="text-teal-700 dark:text-teal-300 font-semibold">
                Target tercapai!
              </span>
            ) : (
              <>
                Kurang{" "}
                <span className="font-mono font-semibold text-foreground">
                  {formatIDR(remaining)}
                </span>
              </>
            )}
          </div>

          {goal.target_date && (
            <span className="inline-flex items-center gap-1 text-muted-foreground font-mono">
              <Calendar className="w-3 h-3" />
              {formatTargetDate(goal.target_date)}
            </span>
          )}
        </div>

        {pace && (
          <div
            className={cn(
              "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium",
              pace.overdue
                ? "bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/50"
                : "bg-muted/60 text-foreground"
            )}
          >
            {pace.label}
          </div>
        )}
      </div>

      {/* Quick Action Row */}
      <div className="flex items-center gap-1.5 pt-2 border-t border-border flex-wrap">
        {busy ? (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground py-1.5">
            <Loader2 className="w-4 h-4 animate-spin" /> Memproses...
          </div>
        ) : (
          <>
            {isActive ? (
              <>
                <button
                  type="button"
                  onClick={onDeposit}
                  className="min-h-[38px] px-3 py-1.5 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold text-xs rounded-xl shadow-sm transition-all inline-flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Setor
                </button>
                {goal.saved > 0 && (
                  <button
                    type="button"
                    onClick={onWithdraw}
                    className="min-h-[38px] px-3 py-1.5 bg-secondary text-secondary-foreground border border-border hover:bg-muted font-semibold text-xs rounded-xl transition-colors inline-flex items-center gap-1"
                  >
                    <ArrowDownLeft className="w-3.5 h-3.5" />
                    Tarik
                  </button>
                )}
                {reached && !isGeneral && (
                  <button
                    type="button"
                    onClick={onAchieve}
                    className="min-h-[38px] px-2.5 py-1.5 bg-teal-50 text-teal-800 border border-teal-200 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-800/60 font-semibold text-xs rounded-xl transition-opacity hover:opacity-90 inline-flex items-center gap-1"
                  >
                    <Check className="w-3.5 h-3.5" />
                    Selesai
                  </button>
                )}
              </>
            ) : (
              <button
                type="button"
                onClick={onReactivate}
                className="min-h-[38px] px-3 py-1.5 bg-accent text-accent-foreground border border-brand-200 dark:border-brand-800/50 font-semibold text-xs rounded-xl inline-flex items-center gap-1"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Aktifkan Lagi
              </button>
            )}

            <button
              type="button"
              onClick={onEdit}
              aria-label={`Edit ${goal.name}`}
              title="Edit Goal"
              className="min-h-[38px] min-w-[38px] px-2.5 py-1.5 rounded-xl border border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={onToggleExpand}
              className={cn(
                "min-h-[38px] px-2.5 py-1.5 text-xs font-medium rounded-xl border transition-colors inline-flex items-center gap-1 ml-auto",
                isExpanded
                  ? "bg-foreground text-background border-foreground"
                  : "bg-background text-foreground border-border hover:bg-muted"
              )}
            >
              Mutasi ({goal.transactions.length})
              {isExpanded ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>
          </>
        )}
      </div>

      {/* D. Expandable Mutation & Management Drawer */}
      {isExpanded && (
        <div className="pt-3 border-t border-border space-y-3 animate-slide-up">
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-muted/45 border border-border px-3 py-2">
              <p className="text-[10px] text-muted-foreground">Total Disetor ({goal.depositCount}x)</p>
              <p className="font-mono text-xs font-bold text-teal-700 dark:text-teal-300 mt-0.5 tabular-nums">
                +{formatIDR(goal.totalDeposited)}
              </p>
            </div>
            <div className="rounded-xl bg-muted/45 border border-border px-3 py-2">
              <p className="text-[10px] text-muted-foreground">Total Ditarik ({goal.withdrawCount}x)</p>
              <p className="font-mono text-xs font-bold text-amber-800 dark:text-amber-300 mt-0.5 tabular-nums">
                -{formatIDR(goal.totalWithdrawn)}
              </p>
            </div>
          </div>

          {goal.transactions.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4 border border-dashed border-border rounded-xl">
              Belum ada mutasi setoran atau penarikan pada goal ini.
            </p>
          ) : (
            <div className="space-y-1.5 max-h-64 overflow-y-auto pr-0.5">
              {goal.transactions.map((tx) => {
                const isDeposit = tx.type === "deposit";
                const isMoving = movingTxId === tx.id;
                return (
                  <div
                    key={`${tx.type}-${tx.id}`}
                    className="rounded-xl bg-background border border-border px-3 py-2 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-foreground truncate">{tx.title}</p>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {isDeposit ? "Setoran" : "Penarikan ke Income"} &middot;{" "}
                          {formatDateShort(tx.date)}
                          {tx.note ? ` · ${tx.note}` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span
                          className={cn(
                            "font-mono font-bold tabular-nums",
                            isDeposit
                              ? "text-teal-700 dark:text-teal-300"
                              : "text-amber-800 dark:text-amber-300"
                          )}
                        >
                          {isDeposit ? "+" : "-"}
                          {formatIDR(tx.amount)}
                        </span>
                        {isDeposit && activeTargets.length > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              if (isMoving) {
                                setMovingTxId(null);
                              } else {
                                setMovingTxId(tx.id);
                                setMoveTargetGoalId(activeTargets[0].id);
                              }
                            }}
                            title="Pindahkan setoran ini ke goal lain"
                            aria-label={`Pindahkan ${tx.title} ke goal lain`}
                            className="w-7 h-7 rounded-lg border border-border bg-card hover:bg-muted text-muted-foreground hover:text-primary flex items-center justify-center transition-colors"
                          >
                            <ArrowRightLeft className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {isMoving && (
                      <div className="flex items-center gap-1.5 pt-1.5 border-t border-border">
                        <select
                          value={moveTargetGoalId}
                          onChange={(e) => setMoveTargetGoalId(e.target.value)}
                          className="flex-1 min-h-[36px] bg-card border border-input rounded-lg px-2 py-1 text-base sm:text-xs text-foreground"
                        >
                          {activeTargets.map((tg) => (
                            <option key={tg.id} value={tg.id}>
                              Pindah ke: {tg.name}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          disabled={movingSaving}
                          onClick={() => handleReallocate(tx.id)}
                          className="min-h-[36px] px-2.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold inline-flex items-center gap-1 disabled:opacity-50"
                        >
                          {movingSaving ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            "Pindah"
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div className="pt-2 border-t border-border flex items-center justify-between gap-2 flex-wrap text-xs">
            <Link
              href="/history"
              className="font-medium text-primary hover:underline inline-flex items-center gap-0.5"
            >
              Riwayat Lengkap <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>

            {!isGeneral && (
              <div className="flex items-center gap-2">
                {isActive && !reached && (
                  <button
                    type="button"
                    onClick={onAchieve}
                    className="px-2.5 py-1 rounded-lg border border-border hover:bg-muted text-xs font-medium text-teal-700 dark:text-teal-300"
                  >
                    Tandai Tercapai
                  </button>
                )}
                {isActive && (
                  <button
                    type="button"
                    onClick={onArchive}
                    className="px-2.5 py-1 rounded-lg border border-border hover:bg-muted text-xs font-medium text-muted-foreground hover:text-foreground"
                  >
                    Arsipkan
                  </button>
                )}
                <button
                  type="button"
                  onClick={onDelete}
                  className="px-2.5 py-1 rounded-lg text-xs font-medium text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                >
                  Hapus Goal
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </article>
  );
}

function GoalDepositModal({
  goal,
  householdId,
  todayStr,
  savingsCategoryId,
  onClose,
  onSaved,
}: {
  goal: GoalWithDetails;
  householdId: string;
  todayStr: string;
  savingsCategoryId: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const yesterdayStr = addDays(todayStr, -1);
  const remaining = Math.max(0, goal.target_amount - goal.saved);

  const [amountText, setAmountText] = useState("");
  const [spentAt, setSpentAt] = useState(todayStr);
  const [description, setDescription] = useState(`Nabung ${goal.name}`);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function addQuickAmount(delta: number) {
    const next = parseIDRInput(amountText) + delta;
    setAmountText(formatIDRInput(String(next)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!savingsCategoryId) {
      setError("Kategori Nabung/Tabungan tidak ditemukan. Pastikan kategori Nabung aktif di Pengaturan.");
      return;
    }
    const amount = parseIDRInput(amountText);
    if (amount <= 0) {
      setError("Nominal setoran harus lebih dari 0.");
      return;
    }

    setSaving(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { error: insertErr } = await supabase.from("expenses").insert({
        household_id: householdId,
        category_id: savingsCategoryId,
        spent_at: spentAt || todayStr,
        description: description.trim() || `Nabung ${goal.name}`,
        amount,
        note: note.trim() ? note.trim() : null,
        goal_id: goal.id,
        created_by: user?.id ?? null,
      });

      if (insertErr) {
        setError(insertErr.message);
        setSaving(false);
        return;
      }

      onSaved();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan setoran.");
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-card border border-border rounded-2xl w-full max-w-md p-5 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: goal.color || "#B85138" }}
            >
              <GoalIcon iconNameOrEmoji={goal.emoji} className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-base text-foreground truncate">
                Setor ke {goal.name}
              </h3>
              <p className="text-xs text-muted-foreground font-mono">
                Saldo: {formatIDR(goal.saved)}
                {remaining > 0 ? ` · Kurang ${formatCompactIDR(remaining)}` : ""}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup modal"
            className="min-h-[36px] min-w-[36px] rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="p-2.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 rounded-xl text-rose-700 dark:text-rose-300 text-xs font-medium flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-foreground">Nominal Setoran</label>
              {parseIDRInput(amountText) > 0 && (
                <button
                  type="button"
                  onClick={() => setAmountText("")}
                  className="text-[11px] font-medium text-muted-foreground hover:text-foreground"
                >
                  Reset
                </button>
              )}
            </div>
            <div className="flex items-center bg-background border border-input rounded-xl px-3 py-2 focus-within:ring-2 focus-within:ring-ring">
              <span className="text-lg font-bold text-muted-foreground mr-2">Rp</span>
              <input
                type="text"
                inputMode="numeric"
                value={amountText}
                onChange={(e) => setAmountText(formatIDRInput(e.target.value))}
                placeholder="0"
                className="w-full bg-transparent font-mono text-xl font-bold text-foreground focus:outline-none placeholder:text-muted-foreground/60 tabular-nums"
                autoFocus
              />
            </div>

            <div className="flex flex-wrap gap-1.5">
              {[100000, 250000, 500000, 1000000].map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => addQuickAmount(v)}
                  className="min-h-[34px] px-2.5 py-1 rounded-lg text-xs font-mono font-medium bg-secondary border border-border text-secondary-foreground hover:bg-muted"
                >
                  +{formatCompactIDR(v)}
                </button>
              ))}
              {remaining > 0 && (
                <button
                  type="button"
                  onClick={() => setAmountText(formatIDRInput(String(remaining)))}
                  className="min-h-[34px] px-2.5 py-1 rounded-lg text-xs font-medium bg-accent text-accent-foreground border border-brand-200 dark:border-brand-800/50 hover:bg-primary hover:text-primary-foreground transition-colors"
                >
                  Penuhi ({formatCompactIDR(remaining)})
                </button>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground block">Tanggal</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setSpentAt(todayStr)}
                className={cn(
                  "px-3 min-h-[38px] rounded-xl text-xs font-medium border transition-colors",
                  spentAt === todayStr
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-secondary text-secondary-foreground border-border"
                )}
              >
                Hari Ini
              </button>
              <button
                type="button"
                onClick={() => setSpentAt(yesterdayStr)}
                className={cn(
                  "px-3 min-h-[38px] rounded-xl text-xs font-medium border transition-colors",
                  spentAt === yesterdayStr
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-secondary text-secondary-foreground border-border"
                )}
              >
                Kemarin
              </button>
              <input
                type="date"
                value={spentAt}
                onChange={(e) => setSpentAt(e.target.value)}
                className="flex-1 min-h-[38px] border border-input bg-background text-foreground rounded-xl px-2.5 py-1 text-base sm:text-xs font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="text-xs font-semibold text-foreground block mb-1">
                Keterangan
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full min-h-[42px] border border-input bg-background text-foreground rounded-xl px-3 py-2 text-base sm:text-xs"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-foreground block mb-1">
                Catatan (Opsional)
              </label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Misal: Transfer BCA"
                className="w-full min-h-[42px] border border-input bg-background text-foreground rounded-xl px-3 py-2 text-base sm:text-xs"
              />
            </div>
          </div>

          <div className="flex gap-2 justify-end pt-3 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="min-h-[42px] text-xs font-medium text-foreground px-4 py-2 rounded-xl border border-border hover:bg-muted transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={saving}
              className="min-h-[42px] text-xs font-semibold px-5 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm flex items-center gap-1.5 transition-all"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Menyimpan...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" /> Simpan Setoran
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function GoalEditorModal({
  householdId,
  todayStr,
  goal,
  existingCount,
  onClose,
  onSaved,
}: {
  householdId: string;
  todayStr: string;
  goal: GoalWithDetails | null;
  existingCount: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isGeneral = goal ? isGeneralGoalName(goal.name) && goal.target_amount <= 0 : false;

  const [name, setName] = useState(goal?.name ?? "");
  const [amountText, setAmountText] = useState(
    goal && goal.target_amount > 0 ? formatIDRInput(String(goal.target_amount)) : ""
  );
  const [targetDate, setTargetDate] = useState(goal?.target_date ?? "");
  const [emoji, setEmoji] = useState(goal?.emoji ?? "target");
  const [color, setColor] = useState(goal?.color || "#B85138");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const previewTarget = parseIDRInput(amountText);
  const previewPace = computeTargetPace(
    previewTarget,
    goal?.saved ?? 0,
    targetDate || null,
    todayStr
  );

  async function save() {
    const target = parseIDRInput(amountText);
    if (!name.trim()) return setError("Isi nama goal dulu.");
    if (!isGeneral && target <= 0) return setError("Target nominal harus lebih dari 0.");

    setSaving(true);
    setError(null);
    const supabase = createClient();
    const payload = {
      household_id: householdId,
      name: name.trim(),
      target_amount: isGeneral ? Math.max(0, target) : target,
      target_date: targetDate || null,
      emoji,
      color,
    };

    const { error: err } = goal
      ? await supabase
          .from("goals")
          .update(payload)
          .eq("id", goal.id)
          .eq("household_id", householdId)
      : await supabase.from("goals").insert({ ...payload, sort_order: existingCount });

    setSaving(false);
    if (err) return setError(err.message);
    onSaved();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm px-4 pb-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-card border border-border rounded-2xl p-5 shadow-xl space-y-4 max-h-[90dvh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-2.5 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: color }}
            >
              <GoalIcon iconNameOrEmoji={emoji} className="w-4 h-4 text-white" />
            </div>
            <h2 className="font-semibold text-foreground text-base">
              {goal ? "Edit Goal" : "Buat Target Baru"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="min-h-[34px] min-w-[34px] rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {!goal && (
          <div className="space-y-1.5">
            <span className="text-[11px] font-semibold text-muted-foreground block">
              Template Cepat
            </span>
            <div className="flex flex-wrap gap-1.5">
              {GOAL_TEMPLATES.map((tpl) => (
                <button
                  key={tpl.name}
                  type="button"
                  onClick={() => {
                    setName(tpl.name);
                    setEmoji(tpl.emoji);
                    setColor(tpl.color);
                  }}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-secondary text-secondary-foreground border border-border hover:bg-muted transition-colors"
                >
                  {tpl.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-2">
          <label className="text-xs font-semibold text-foreground block">Ikon &amp; Warna</label>
          <div className="flex flex-wrap gap-1.5">
            {ICON_CHOICES.map((ic) => (
              <button
                key={ic}
                type="button"
                onClick={() => setEmoji(ic)}
                className={cn(
                  "w-9 h-9 rounded-xl flex items-center justify-center border transition-all",
                  emoji === ic
                    ? "border-primary bg-primary text-primary-foreground shadow-sm"
                    : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <GoalIcon iconNameOrEmoji={ic} className="w-4 h-4" />
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            {COLOR_SWATCHES.map((sw) => (
              <button
                key={sw.hex}
                type="button"
                aria-label={`Pilih warna ${sw.label}`}
                onClick={() => setColor(sw.hex)}
                className={cn(
                  "w-7 h-7 rounded-full border-2 transition-transform flex items-center justify-center",
                  color === sw.hex
                    ? "border-foreground scale-110"
                    : "border-transparent hover:scale-105"
                )}
                style={{ backgroundColor: sw.hex }}
              >
                {color === sw.hex && <Check className="w-3.5 h-3.5 text-white" />}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-foreground block mb-1.5">Nama Goal</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Contoh: Umroh sekeluarga"
            className="w-full min-h-[44px] bg-background border border-input rounded-xl py-2.5 px-3.5 text-base sm:text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            autoFocus
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-foreground block mb-1.5">
            {isGeneral ? "Target Nominal (Opsional, 0 = Fleksibel)" : "Target Nominal (Rp)"}
          </label>
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">
              Rp
            </span>
            <input
              type="text"
              inputMode="numeric"
              value={amountText}
              onChange={(e) => setAmountText(formatIDRInput(e.target.value))}
              placeholder="0"
              className="w-full min-h-[44px] bg-background border border-input rounded-xl py-2.5 pl-10 pr-3.5 text-base sm:text-sm font-mono font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-foreground block mb-1.5">
            Target Tanggal (Opsional)
          </label>
          <input
            type="date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
            className="w-full min-h-[44px] bg-background border border-input rounded-xl py-2.5 px-3.5 text-base sm:text-sm font-mono text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        {previewPace && (
          <div className="p-2.5 rounded-xl bg-accent/65 border border-brand-200 dark:border-brand-800/40 text-xs text-accent-foreground font-medium">
            Estimasi: {previewPace.label}
          </div>
        )}

        {error && (
          <p className="text-xs font-medium text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 p-2.5 rounded-xl border border-rose-200 dark:border-rose-800/60">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="w-full min-h-[46px] py-3 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold text-sm rounded-xl shadow-sm active:scale-[0.98] transition-all"
        >
          {saving ? (
            <Loader2 className="w-5 h-5 animate-spin mx-auto" />
          ) : goal ? (
            "Simpan Perubahan"
          ) : (
            "Buat Goal"
          )}
        </button>
      </div>
    </div>
  );
}

function GoalWithdrawModal({
  goal,
  householdId,
  payDay,
  customPeriods,
  onClose,
  onSaved,
}: {
  goal: GoalWithDetails;
  householdId: string;
  payDay: number;
  customPeriods: { label_month: string; start_date: string; end_date: string }[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const currentPeriod = currentPeriodLabelWithCustom(payDay, customPeriods);
  const nextPeriod = shiftPeriod(currentPeriod, 1);
  const periodOptions = [
    { key: labelMonthKey(currentPeriod), title: periodTitle(currentPeriod) },
    { key: labelMonthKey(nextPeriod), title: periodTitle(nextPeriod) },
  ];

  const [targetPeriodKey, setTargetPeriodKey] = useState(periodOptions[0].key);
  const [amountText, setAmountText] = useState("");
  const [source, setSource] = useState(`Tarik Tabungan: ${goal.name}`);
  const [confirmOverdraw, setConfirmOverdraw] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedPeriodTitle =
    periodOptions.find((p) => p.key === targetPeriodKey)?.title ?? periodOptions[0].title;
  const parsedAmount = parseIDRInput(amountText);
  const isOverBalance = parsedAmount > goal.saved;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (parsedAmount <= 0) {
      setError("Nominal penarikan harus lebih dari 0.");
      return;
    }
    if (isOverBalance && !confirmOverdraw) {
      setConfirmOverdraw(true);
      return;
    }

    setSaving(true);
    const supabase = createClient();
    const { error: insertErr } = await supabase.from("incomes").insert({
      household_id: householdId,
      month: targetPeriodKey,
      source: source.trim() || `Tarik Tabungan: ${goal.name}`,
      amount: parsedAmount,
      goal_id: goal.id,
    });
    setSaving(false);

    if (insertErr) {
      setError(insertErr.message);
      return;
    }

    onSaved();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-card border border-border rounded-2xl w-full max-w-md p-5 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 flex items-center justify-center">
              <ArrowDownLeft className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-base text-foreground">Tarik ke Pemasukan</h3>
              <p className="text-xs text-muted-foreground">
                Cairkan saldo {goal.name}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup modal"
            className="min-h-[36px] min-w-[36px] rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-3 bg-muted/50 border border-border rounded-xl flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">Saldo tersedia:</span>
          <span className="font-mono text-sm font-bold text-teal-700 dark:text-teal-300 tabular-nums">
            {formatIDR(goal.saved)}
          </span>
        </div>

        {error && (
          <div className="p-2.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 rounded-xl text-rose-700 dark:text-rose-300 text-xs font-medium flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-foreground block">
              Nominal yang Ditarik
            </label>
            <div className="flex items-center bg-background border border-input rounded-xl px-3 py-2 focus-within:ring-2 focus-within:ring-ring">
              <span className="text-lg font-bold text-muted-foreground mr-2">Rp</span>
              <input
                type="text"
                inputMode="numeric"
                value={amountText}
                onChange={(e) => {
                  setAmountText(formatIDRInput(e.target.value));
                  setConfirmOverdraw(false);
                }}
                placeholder="0"
                className="w-full bg-transparent font-mono text-xl font-bold text-foreground focus:outline-none placeholder:text-muted-foreground/60 tabular-nums"
                autoFocus
              />
            </div>

            <div className="flex flex-wrap gap-1.5">
              {[100000, 250000, 500000, 1000000].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => {
                    setAmountText(formatIDRInput(String(val)));
                    setConfirmOverdraw(false);
                  }}
                  className="min-h-[34px] px-2.5 py-1 rounded-lg text-xs font-mono font-medium bg-secondary border border-border text-secondary-foreground hover:bg-muted"
                >
                  {formatCompactIDR(val)}
                </button>
              ))}
              {goal.saved > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setAmountText(formatIDRInput(String(goal.saved)));
                    setConfirmOverdraw(false);
                  }}
                  className="min-h-[34px] px-2.5 py-1 rounded-lg text-xs font-medium bg-accent text-accent-foreground border border-brand-200 dark:border-brand-800/50 hover:bg-primary hover:text-primary-foreground transition-colors"
                >
                  Tarik Semua ({formatCompactIDR(goal.saved)})
                </button>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground block">
              Masuk ke Pemasukan Periode
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {periodOptions.map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setTargetPeriodKey(opt.key)}
                  className={cn(
                    "min-h-[38px] px-2.5 py-1.5 rounded-xl text-xs font-medium border transition-colors truncate",
                    targetPeriodKey === opt.key
                      ? "bg-accent text-accent-foreground border-primary/50"
                      : "bg-background text-muted-foreground border-border"
                  )}
                >
                  {opt.title}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-foreground block mb-1">
              Keterangan Sumber Income
            </label>
            <input
              type="text"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              placeholder={`Tarik Tabungan: ${goal.name}`}
              className="w-full min-h-[42px] border border-input bg-background text-foreground rounded-xl px-3 py-2 text-base sm:text-xs"
            />
          </div>

          {isOverBalance ? (
            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl text-xs text-amber-900 dark:text-amber-200">
              Nominal penarikan melebihi saldo saat ini ({formatIDR(goal.saved)}). Klik tombol di bawah untuk konfirmasi tetap mencairkan.
            </div>
          ) : (
            <div className="p-3 bg-muted/50 border border-border rounded-xl text-xs text-muted-foreground">
              Dana ditambahkan ke pemasukan <strong className="text-foreground">{selectedPeriodTitle}</strong> dan saldo goal akan berkurang otomatis.
            </div>
          )}

          <div className="flex gap-2 justify-end pt-2 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[42px] text-xs font-medium text-foreground px-4 py-2 rounded-xl border border-border hover:bg-muted transition-colors"
              disabled={saving}
            >
              Batal
            </button>
            <button
              type="submit"
              className="min-h-[42px] text-xs font-semibold px-5 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm flex items-center gap-1.5 transition-all"
              disabled={saving}
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Memproses...
                </>
              ) : (
                <>
                  <ArrowDownLeft className="w-4 h-4" />
                  {confirmOverdraw ? "Konfirmasi Tarik" : "Tarik Sekarang"}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

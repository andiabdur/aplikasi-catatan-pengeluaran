"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatIDR, formatIDRInput, parseIDRInput } from "@/lib/format";
import { currentPeriodLabelWithCustom, labelMonthKey, periodTitle } from "@/lib/period";
import type { GoalWithProgress, GoalStatus } from "@/lib/types";
import {
  Plus, Target, Check, Trash2, Pencil, Loader2, X, Trophy, Archive,
  Plane, Home, Car, GraduationCap, Heart, Smartphone, Palmtree, Coins, Gift, Compass, Stethoscope, HelpCircle,
  ArrowDownLeft, AlertCircle, Sparkles
} from "lucide-react";
import { cn } from "@/lib/utils";

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

const EMOJI_TO_ICON: Record<string, string> = {
  "🎯": "target",
  "🕋": "compass",
  "✈️": "plane",
  "🏠": "home",
  "🚗": "car",
  "🎓": "graduation-cap",
  "💍": "heart",
  "📱": "smartphone",
  "🏖️": "palm-tree",
  "💰": "coins",
  "🎁": "gift",
  "🩺": "stethoscope"
};

const ICON_CHOICES = ["target", "compass", "plane", "home", "car", "graduation-cap", "heart", "smartphone", "palm-tree", "coins", "gift", "stethoscope"];

function GoalIcon({ iconNameOrEmoji, className = "w-5 h-5", style }: { iconNameOrEmoji: string; className?: string; style?: React.CSSProperties }) {
  const name = EMOJI_TO_ICON[iconNameOrEmoji] || iconNameOrEmoji || "target";
  const IconComponent = ICON_MAP[name as keyof typeof ICON_MAP] || HelpCircle;
  return <IconComponent className={className} style={style} />;
}

type EditState =
  | { mode: "closed" }
  | { mode: "new" }
  | { mode: "edit"; goal: GoalWithProgress };

export function GoalsClient({
  householdId,
  initialGoals,
  payDay = 25,
  customPeriods = [],
}: {
  householdId: string;
  initialGoals: GoalWithProgress[];
  payDay?: number;
  customPeriods?: { label_month: string; start_date: string; end_date: string }[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [edit, setEdit] = useState<EditState>({ mode: "closed" });
  const [withdrawGoal, setWithdrawGoal] = useState<GoalWithProgress | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const goals = initialGoals;
  const active = goals.filter((g) => g.status === "active");
  const done = goals.filter((g) => g.status !== "active");

  async function setStatus(id: string, status: GoalStatus) {
    setBusyId(id);
    const supabase = createClient();
    await supabase.from("goals").update({ status }).eq("id", id);
    setBusyId(null);
    startTransition(() => router.refresh());
  }

  async function remove(id: string) {
    if (!confirm("Hapus goal ini? Setoran yang sudah tercatat tetap ada, cuma lepas tag-nya.")) return;
    setBusyId(id);
    const supabase = createClient();
    await supabase.from("goals").delete().eq("id", id);
    setBusyId(null);
    startTransition(() => router.refresh());
  }

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => setEdit({ mode: "new" })}
        className="w-full py-3.5 bg-brand-500 text-slate-950 hover:bg-brand-400 font-headline font-black text-sm uppercase tracking-wider rounded-none border-4 border-slate-950 dark:border-slate-100 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] dark:shadow-[6px_6px_0px_0px_rgba(255,255,255,1)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none flex items-center justify-center gap-2 transition-all"
      >
        <Plus className="w-5 h-5" /> Tambah Target Finansial Baru
      </button>

      {active.length === 0 && done.length === 0 && (
        <div className="bg-white dark:bg-surface-dark border-4 border-slate-950 dark:border-slate-100 rounded-none text-center py-12 px-4 space-y-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <div className="w-14 h-14 rounded-none bg-brand-500 text-slate-950 border-2 border-slate-950 flex items-center justify-center mx-auto shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            <Target className="w-7 h-7" />
          </div>
          <p className="text-xs font-mono uppercase text-slate-600 dark:text-slate-300 max-w-xs mx-auto leading-relaxed">
            Belum ada goal. Buat target pertama keluarga Anda — Umroh, dana darurat, liburan, atau DP rumah.
          </p>
        </div>
      )}

      {active.map((g) => (
        <GoalCard
          key={g.id}
          goal={g}
          busy={busyId === g.id}
          onEdit={() => setEdit({ mode: "edit", goal: g })}
          onWithdraw={() => setWithdrawGoal(g)}
          onAchieve={() => setStatus(g.id, "achieved")}
          onArchive={() => setStatus(g.id, "archived")}
          onDelete={() => remove(g.id)}
        />
      ))}

      {done.length > 0 && (
        <div className="pt-3">
          <p className="text-xs font-headline font-bold text-slate-950 dark:text-slate-100 px-1 mb-2.5 uppercase tracking-wider">
            Selesai / Diarsipkan
          </p>
          <div className="space-y-3">
            {done.map((g) => (
              <GoalCard
                key={g.id}
                goal={g}
                busy={busyId === g.id}
                onEdit={() => setEdit({ mode: "edit", goal: g })}
                onReactivate={() => setStatus(g.id, "active")}
                onDelete={() => remove(g.id)}
              />
            ))}
          </div>
        </div>
      )}

      {edit.mode !== "closed" && (
        <GoalEditor
          householdId={householdId}
          goal={edit.mode === "edit" ? edit.goal : null}
          existingCount={goals.length}
          onClose={() => setEdit({ mode: "closed" })}
          onSaved={() => {
            setEdit({ mode: "closed" });
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
    </div>
  );
}

function GoalCard({
  goal,
  busy,
  onEdit,
  onWithdraw,
  onAchieve,
  onArchive,
  onReactivate,
  onDelete,
}: {
  goal: GoalWithProgress;
  busy: boolean;
  onEdit: () => void;
  onWithdraw?: () => void;
  onAchieve?: () => void;
  onArchive?: () => void;
  onReactivate?: () => void;
  onDelete: () => void;
}) {
  const pct = goal.target_amount > 0
    ? Math.min(100, Math.round((goal.saved / goal.target_amount) * 100))
    : 0;
  const remaining = Math.max(0, goal.target_amount - goal.saved);
  const reached = goal.target_amount > 0 && goal.saved >= goal.target_amount;
  const isActive = goal.status === "active";

  return (
    <div className={cn("bg-white dark:bg-surface-dark border-4 border-slate-950 dark:border-slate-100 rounded-none p-4 space-y-3.5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)]", !isActive && "opacity-75")}>
      <div className="flex items-start gap-3">
        <div
          className="w-11 h-11 rounded-none flex items-center justify-center shrink-0 border-2 border-slate-950 dark:border-slate-100 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,1)]"
          style={{ backgroundColor: goal.color ?? "#16a34a" }}
        >
          <GoalIcon iconNameOrEmoji={goal.emoji} className="w-5 h-5 text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h3 className="font-headline font-bold text-sm text-slate-950 dark:text-slate-100 uppercase tracking-wider truncate">{goal.name}</h3>
            {goal.status === "achieved" && (
              <Trophy className="w-4 h-4 text-amber-500 shrink-0" />
            )}
            {goal.status === "archived" && (
              <Archive className="w-4 h-4 text-slate-400 shrink-0" />
            )}
          </div>
          <p className="text-xs font-mono font-bold text-slate-600 dark:text-slate-400 mt-0.5">
            {formatIDR(goal.saved)} / {formatIDR(goal.target_amount)}
            {goal.target_date && ` · ${formatTargetDate(goal.target_date)}`}
          </p>
        </div>
        <span
          className={cn(
            "text-base font-headline font-black shrink-0",
            reached ? "text-emerald-600 dark:text-emerald-400" : "text-slate-950 dark:text-slate-100",
          )}
        >
          {pct}%
        </span>
      </div>

      <div className="h-3 rounded-none bg-slate-100 dark:bg-slate-950 overflow-hidden border-2 border-slate-950 dark:border-slate-100">
        <div
          className="h-full rounded-none transition-all"
          style={{
            width: `${pct}%`,
            background: reached ? "#22c55e" : goal.color,
          }}
        />
      </div>

      <div className="flex items-center justify-between pt-0.5">
        <p className="text-xs font-mono font-bold uppercase text-slate-600 dark:text-slate-400">
          {reached ? (
            <span className="text-emerald-600 dark:text-emerald-400 font-headline font-black">Target tercapai!</span>
          ) : (
            <>Kurang <span className="font-bold text-slate-950 dark:text-slate-100">{formatIDR(remaining)}</span></>
          )}
        </p>
        <div className="flex items-center gap-1.5">
          {busy ? (
            <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
          ) : (
            <>
              {isActive && onAchieve && reached && (
                <IconBtn title="Tandai tercapai" onClick={onAchieve} className="text-emerald-600 dark:text-emerald-400">
                  <Check className="w-4 h-4" />
                </IconBtn>
              )}
              {isActive && onArchive && (
                <IconBtn title="Arsipkan" onClick={onArchive} className="text-slate-400">
                  <Archive className="w-4 h-4" />
                </IconBtn>
              )}
              {!isActive && onReactivate && (
                <IconBtn title="Aktifkan lagi" onClick={onReactivate} className="text-brand-600 dark:text-brand-400">
                  <Target className="w-4 h-4" />
                </IconBtn>
              )}
              <IconBtn title="Edit" onClick={onEdit} className="text-slate-600 hover:text-slate-950">
                <Pencil className="w-4 h-4" />
              </IconBtn>
              <IconBtn title="Hapus" onClick={onDelete} className="text-slate-600 hover:text-rose-600">
                <Trash2 className="w-4 h-4" />
              </IconBtn>
            </>
          )}
        </div>
      </div>

      {isActive && goal.saved > 0 && onWithdraw && (
        <button
          type="button"
          onClick={onWithdraw}
          className="w-full py-2 px-3 bg-amber-400 hover:bg-amber-300 text-slate-950 font-headline font-bold text-xs uppercase tracking-wider rounded-none border-2 border-slate-950 dark:border-slate-100 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none flex items-center justify-center gap-1.5 transition-all mt-1"
        >
          <ArrowDownLeft className="w-4 h-4" /> Tarik ke Pemasukan
        </button>
      )}
    </div>
  );
}

function IconBtn({
  children, onClick, title, className,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cn("p-1.5 rounded-none border border-slate-950 dark:border-slate-100 bg-white dark:bg-slate-900 shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] hover:bg-slate-950 hover:text-white dark:hover:bg-slate-100 dark:hover:text-slate-950 transition", className)}
    >
      {children}
    </button>
  );
}

function GoalEditor({
  householdId,
  goal,
  existingCount,
  onClose,
  onSaved,
}: {
  householdId: string;
  goal: GoalWithProgress | null;
  existingCount: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(goal?.name ?? "");
  const [amountText, setAmountText] = useState(
    goal ? formatIDRInput(String(goal.target_amount)) : "",
  );
  const [targetDate, setTargetDate] = useState(goal?.target_date ?? "");
  const [emoji, setEmoji] = useState(goal?.emoji ?? "target");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    const target = parseIDRInput(amountText);
    if (!name.trim()) return setError("Isi nama goal dulu.");
    if (target <= 0) return setError("Target nominal harus lebih dari 0.");
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const payload = {
      household_id: householdId,
      name: name.trim(),
      target_amount: target,
      target_date: targetDate || null,
      emoji,
    };
    const { error: err } = goal
      ? await supabase.from("goals").update(payload).eq("id", goal.id)
      : await supabase.from("goals").insert({ ...payload, sort_order: existingCount });
    setSaving(false);
    if (err) return setError(err.message);
    onSaved();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm bg-white dark:bg-surface-dark border-4 border-slate-950 dark:border-slate-100 rounded-none p-5 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:shadow-[8px_8px_0px_0px_rgba(255,255,255,1)] space-y-4 max-h-[90dvh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-2 border-b-2 border-slate-950 dark:border-slate-100">
          <h2 className="font-headline font-bold text-slate-950 dark:text-slate-100 uppercase text-base tracking-wider">
            {goal ? "Edit Goal" : "Goal Baru"}
          </h2>
          <button type="button" onClick={onClose} className="p-1 rounded-none border border-slate-950 text-slate-950 dark:text-slate-100 hover:bg-slate-950 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div>
          <label className="text-xs font-headline font-bold text-slate-950 dark:text-slate-100 uppercase tracking-wider block mb-1.5">Pilih Ikon</label>
          <div className="flex flex-wrap gap-2">
            {ICON_CHOICES.map((ic) => (
              <button
                key={ic}
                type="button"
                onClick={() => setEmoji(ic)}
                className={cn(
                  "w-10 h-10 rounded-none flex items-center justify-center border-2 transition-all",
                  emoji === ic
                    ? "border-slate-950 bg-brand-500 text-slate-950 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] font-bold"
                    : "border-slate-950 bg-slate-50 dark:bg-slate-950 text-slate-500 hover:bg-slate-100"
                )}
              >
                <GoalIcon iconNameOrEmoji={ic} className="w-5 h-5" />
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs font-headline font-bold text-slate-950 dark:text-slate-100 uppercase tracking-wider block mb-1.5">Nama Goal</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="contoh: Umroh sekeluarga"
            className="w-full bg-slate-50 dark:bg-slate-950 border-2 border-slate-950 dark:border-slate-100 rounded-none py-2.5 px-3.5 text-xs font-headline font-bold uppercase text-slate-950 dark:text-slate-100 focus:outline-none shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
            autoFocus
          />
        </div>

        <div>
          <label className="text-xs font-headline font-bold text-slate-950 dark:text-slate-100 uppercase tracking-wider block mb-1.5">Target Nominal (Rp)</label>
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-headline font-black text-slate-950 dark:text-slate-100">
              Rp
            </span>
            <input
              type="text"
              inputMode="numeric"
              value={amountText}
              onChange={(e) => setAmountText(formatIDRInput(e.target.value))}
              placeholder="0"
              className="w-full bg-slate-50 dark:bg-slate-950 border-2 border-slate-950 dark:border-slate-100 rounded-none py-2.5 pl-10 pr-3.5 text-xs font-mono font-bold text-slate-950 dark:text-slate-100 focus:outline-none shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-headline font-bold text-slate-950 dark:text-slate-100 uppercase tracking-wider block mb-1.5">Target Tanggal (Opsional)</label>
          <input
            type="date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-950 border-2 border-slate-950 dark:border-slate-100 rounded-none py-2.5 px-3.5 text-xs font-mono font-bold text-slate-950 dark:text-slate-100 focus:outline-none shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
          />
        </div>

        {error && <p className="text-xs font-mono font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 p-2.5 rounded-none border-2 border-rose-600 uppercase">{error}</p>}

        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="w-full py-3.5 bg-brand-500 text-slate-950 hover:bg-brand-400 font-headline font-black uppercase tracking-wider text-xs rounded-none border-2 border-slate-950 dark:border-slate-100 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all"
        >
          {saving ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : goal ? "Simpan Perubahan" : "Buat Goal"}
        </button>
      </div>
    </div>
  );
}

function formatTargetDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function GoalWithdrawModal({
  goal,
  householdId,
  payDay,
  customPeriods,
  onClose,
  onSaved,
}: {
  goal: GoalWithProgress;
  householdId: string;
  payDay: number;
  customPeriods: { label_month: string; start_date: string; end_date: string }[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const currentPeriod = currentPeriodLabelWithCustom(payDay, customPeriods);
  const currentKey = labelMonthKey(currentPeriod);
  const currentTitle = periodTitle(currentPeriod);

  const [amountText, setAmountText] = useState("");
  const [source, setSource] = useState(`Tarik Tabungan: ${goal.name}`);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSetQuick = (v: number) => {
    setAmountText(formatIDRInput(String(v)));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const amount = parseIDRInput(amountText);
    if (amount <= 0) {
      setError("Nominal penarikan harus lebih dari 0");
      return;
    }
    if (amount > goal.saved) {
      if (!confirm(`Nominal penarikan (${formatIDR(amount)}) melebihi saldo tabungan saat ini (${formatIDR(goal.saved)}). Lanjutkan?`)) {
        return;
      }
    }

    setSaving(true);
    const supabase = createClient();
    const { error: insertErr } = await supabase.from("incomes").insert({
      household_id: householdId,
      month: currentKey,
      source: source.trim() || `Tarik Tabungan: ${goal.name}`,
      amount,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white dark:bg-surface-dark border-4 border-slate-950 dark:border-slate-100 w-full max-w-md p-5 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:shadow-[8px_8px_0px_0px_rgba(255,255,255,1)] space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b-2 border-slate-950 dark:border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-none bg-amber-400 text-slate-950 border-2 border-slate-950 flex items-center justify-center font-bold">
              <ArrowDownLeft className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-headline font-black text-base uppercase tracking-wider text-slate-950 dark:text-slate-100">
                Tarik ke Pemasukan
              </h3>
              <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                Cairkan saldo tabungan ke periode {currentTitle}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-600 hover:text-slate-950 dark:text-slate-400 dark:hover:text-slate-100 border border-transparent hover:border-slate-950"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Goal summary info card */}
        <div className="p-3 bg-amber-50 dark:bg-slate-900 border-2 border-slate-950 dark:border-slate-100 rounded-none space-y-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-none flex items-center justify-center shrink-0 border border-slate-950 dark:border-slate-100"
              style={{ backgroundColor: goal.color ?? "#16a34a" }}
            >
              <GoalIcon iconNameOrEmoji={goal.emoji} className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="font-headline font-bold text-xs uppercase tracking-wider text-slate-950 dark:text-slate-100 truncate">
                {goal.name}
              </h4>
              <p className="font-mono text-[11px] text-slate-600 dark:text-slate-400">
                Target: {formatIDR(goal.target_amount)}
              </p>
            </div>
          </div>
          <div className="pt-2 border-t border-slate-950/10 dark:border-slate-100/10 flex items-center justify-between">
            <span className="text-xs font-headline font-bold uppercase text-slate-700 dark:text-slate-300">
              Saldo Tabungan Tersedia:
            </span>
            <span className="font-mono text-sm font-black text-emerald-700 dark:text-emerald-400">
              {formatIDR(goal.saved)}
            </span>
          </div>
        </div>

        {error && (
          <div className="p-2.5 bg-rose-100 dark:bg-rose-950/60 border-2 border-rose-600 text-rose-900 dark:text-rose-200 text-xs font-mono font-bold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-headline font-bold uppercase tracking-wider text-slate-950 dark:text-slate-100 block">
              Nominal yang Ditarik / Dicoceng
            </label>
            <div className="flex items-center bg-slate-50 dark:bg-slate-950 border-2 border-slate-950 dark:border-slate-100 rounded-none px-3 py-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              <span className="font-headline text-lg font-black text-slate-950 dark:text-slate-100 mr-2">
                Rp
              </span>
              <input
                type="text"
                inputMode="numeric"
                value={amountText}
                onChange={(e) => setAmountText(formatIDRInput(e.target.value))}
                placeholder="0"
                className="w-full bg-transparent font-headline text-xl font-black text-slate-950 dark:text-slate-100 focus:outline-none placeholder-slate-400"
                autoFocus
              />
            </div>

            {/* Quick amount chips */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {[100000, 250000, 500000, 1000000].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => handleSetQuick(val)}
                  className="px-2 py-1 text-[11px] font-mono font-bold bg-white dark:bg-slate-900 border border-slate-950 dark:border-slate-100 hover:bg-slate-100 shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]"
                >
                  +{formatIDR(val).replace(",00", "").replace("Rp ", "")}
                </button>
              ))}
              {goal.saved > 0 && (
                <button
                  type="button"
                  onClick={() => handleSetQuick(goal.saved)}
                  className="px-2 py-1 text-[11px] font-mono font-bold bg-amber-300 text-slate-950 border border-slate-950 hover:bg-amber-200 shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]"
                >
                  Tarik Semua Saldo ({formatIDR(goal.saved)})
                </button>
              )}
            </div>
          </div>

          <div>
            <label className="text-xs font-headline font-bold uppercase tracking-wider text-slate-950 dark:text-slate-100 block mb-1">
              Keterangan Sumber Income
            </label>
            <input
              type="text"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              placeholder={`Tarik Tabungan: ${goal.name}`}
              className="w-full border-2 border-slate-950 dark:border-slate-100 bg-slate-50 dark:bg-slate-950 text-slate-950 dark:text-slate-100 rounded-none px-3 py-2 text-xs font-mono font-bold focus:outline-none shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
            />
          </div>

          <div className="p-2.5 bg-slate-100 dark:bg-slate-900 border border-slate-950 dark:border-slate-100 text-[11px] font-mono text-slate-600 dark:text-slate-400">
            Dana akan langsung ditambahkan ke Pemasukan periode <strong>{currentTitle}</strong> dan saldo target ini akan berkurang.
          </div>

          <div className="flex gap-2 justify-end pt-3 border-t-2 border-slate-950 dark:border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="text-xs font-headline font-bold uppercase text-slate-950 dark:text-slate-100 px-4 py-2 rounded-none border-2 border-slate-950 hover:bg-slate-100 transition"
              disabled={saving}
            >
              Batal
            </button>
            <button
              type="submit"
              className="text-xs font-headline font-black uppercase px-5 py-2 rounded-none bg-amber-400 hover:bg-amber-300 text-slate-950 border-2 border-slate-950 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none flex items-center gap-1.5 transition-all"
              disabled={saving}
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Memproses...
                </>
              ) : (
                <>
                  <ArrowDownLeft className="w-4 h-4" /> Tarik Sekarang
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

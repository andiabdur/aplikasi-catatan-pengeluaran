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
  ArrowDownLeft, AlertCircle,
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
    const target = goals.find((g) => g.id === id);
    if (target && /general|umum/i.test(target.name)) {
      alert("Tabungan General adalah wadah utama untuk tabungan tanpa alokasi khusus dan tidak dapat dihapus.");
      return;
    }
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
        className="w-full min-h-[48px] py-3 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold text-sm rounded-xl shadow-sm active:scale-[0.98] flex items-center justify-center gap-2 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <Plus className="w-5 h-5" /> Tambah Target Finansial Baru
      </button>

      {active.length === 0 && done.length === 0 && (
        <div className="bg-card border border-border rounded-2xl text-center py-12 px-4 space-y-3 shadow-sm">
          <div className="w-12 h-12 rounded-2xl bg-accent text-primary border border-brand-200 dark:border-brand-800/40 flex items-center justify-center mx-auto">
            <Target className="w-6 h-6" />
          </div>
          <p className="text-xs text-muted-foreground max-w-xs mx-auto leading-relaxed">
            Belum ada goal. Buat target pertama keluarga Anda: Umroh, dana darurat, liburan, atau DP rumah.
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
          <p className="text-xs font-semibold text-muted-foreground px-1 mb-2.5">
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
  const isGeneral = /general|umum/i.test(goal.name) && goal.target_amount <= 0;
  const pct = goal.target_amount > 0
    ? Math.min(100, Math.round((goal.saved / goal.target_amount) * 100))
    : 0;
  const remaining = Math.max(0, goal.target_amount - goal.saved);
  const reached = goal.target_amount > 0 && goal.saved >= goal.target_amount;
  const isActive = goal.status === "active";

  return (
    <div className={cn("bg-card border border-border rounded-2xl p-4 space-y-3.5 shadow-sm", !isActive && "opacity-75")}>
      <div className="flex items-start gap-3">
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
          style={{ backgroundColor: goal.color ?? "#B85138" }}
        >
          <GoalIcon iconNameOrEmoji={goal.emoji} className="w-5 h-5 text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h3 className="font-semibold text-sm text-foreground truncate">{goal.name}</h3>
            {goal.status === "achieved" && (
              <Trophy className="w-4 h-4 text-amber-500 shrink-0" />
            )}
            {goal.status === "archived" && (
              <Archive className="w-4 h-4 text-muted-foreground shrink-0" />
            )}
          </div>
          <p className="text-xs font-mono text-muted-foreground mt-0.5 tabular-nums">
            {isGeneral || goal.target_amount <= 0 ? (
              <span>{formatIDR(goal.saved)} · Tabungan Bebas / Fleksibel</span>
            ) : (
              <>
                {formatIDR(goal.saved)} / {formatIDR(goal.target_amount)}
                {goal.target_date && ` · ${formatTargetDate(goal.target_date)}`}
              </>
            )}
          </p>
        </div>
        {isGeneral || goal.target_amount <= 0 ? (
          <span className="text-xs font-medium bg-accent text-accent-foreground border border-brand-200 dark:border-brand-800/50 px-2.5 py-0.5 rounded-full shrink-0">
            Umum
          </span>
        ) : (
          <span
            className={cn(
              "text-base font-mono font-bold shrink-0 tabular-nums",
              reached ? "text-teal-700 dark:text-teal-300" : "text-foreground",
            )}
          >
            {pct}%
          </span>
        )}
      </div>

      <div className="h-2.5 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: isGeneral || goal.target_amount <= 0 ? "100%" : `${pct}%`,
            background: reached ? "#0F766E" : goal.color,
          }}
        />
      </div>

      <div className="flex items-center justify-between pt-0.5">
        <p className="text-xs text-muted-foreground">
          {isGeneral || goal.target_amount <= 0 ? (
            <span className="text-teal-700 dark:text-teal-300 font-medium">Dana siap digunakan</span>
          ) : reached ? (
            <span className="text-teal-700 dark:text-teal-300 font-semibold">Target tercapai!</span>
          ) : (
            <>Kurang <span className="font-mono font-semibold text-foreground">{formatIDR(remaining)}</span></>
          )}
        </p>
        <div className="flex items-center gap-1.5">
          {busy ? (
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          ) : (
            <>
              {isActive && onAchieve && reached && !isGeneral && (
                <IconBtn title="Tandai tercapai" onClick={onAchieve} className="text-teal-700 dark:text-teal-300">
                  <Check className="w-4 h-4" />
                </IconBtn>
              )}
              {isActive && onArchive && !isGeneral && (
                <IconBtn title="Arsipkan" onClick={onArchive} className="text-muted-foreground">
                  <Archive className="w-4 h-4" />
                </IconBtn>
              )}
              {!isActive && onReactivate && (
                <IconBtn title="Aktifkan lagi" onClick={onReactivate} className="text-primary">
                  <Target className="w-4 h-4" />
                </IconBtn>
              )}
              <IconBtn title="Edit" onClick={onEdit} className="text-muted-foreground hover:text-foreground">
                <Pencil className="w-4 h-4" />
              </IconBtn>
              {!isGeneral && (
                <IconBtn title="Hapus" onClick={onDelete} className="text-muted-foreground hover:text-rose-700 dark:hover:text-rose-300">
                  <Trash2 className="w-4 h-4" />
                </IconBtn>
              )}
            </>
          )}
        </div>
      </div>

      {isActive && goal.saved > 0 && onWithdraw && (
        <button
          type="button"
          onClick={onWithdraw}
          className="w-full min-h-[40px] py-2 px-3 bg-secondary hover:bg-accent text-foreground hover:text-accent-foreground font-semibold text-xs rounded-xl border border-border active:scale-[0.98] flex items-center justify-center gap-1.5 transition-all mt-1"
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
      aria-label={title}
      className={cn("min-h-[34px] min-w-[34px] rounded-lg border border-border bg-background hover:bg-muted flex items-center justify-center transition-colors", className)}
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
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm px-4 pb-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm bg-card border border-border rounded-2xl p-5 shadow-xl space-y-4 max-h-[90dvh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-2.5 border-b border-border">
          <h2 className="font-semibold text-foreground text-base">
            {goal ? "Edit Goal" : "Goal Baru"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="min-h-[34px] min-w-[34px] rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div>
          <label className="text-xs font-semibold text-foreground block mb-1.5">Pilih Ikon</label>
          <div className="flex flex-wrap gap-2">
            {ICON_CHOICES.map((ic) => (
              <button
                key={ic}
                type="button"
                onClick={() => setEmoji(ic)}
                className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center border transition-all",
                  emoji === ic
                    ? "border-primary bg-primary text-primary-foreground shadow-sm"
                    : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <GoalIcon iconNameOrEmoji={ic} className="w-5 h-5" />
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
          <label className="text-xs font-semibold text-foreground block mb-1.5">Target Nominal (Rp)</label>
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
          <label className="text-xs font-semibold text-foreground block mb-1.5">Target Tanggal (Opsional)</label>
          <input
            type="date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
            className="w-full min-h-[44px] bg-background border border-input rounded-xl py-2.5 px-3.5 text-base sm:text-sm font-mono text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl w-full max-w-md p-5 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 flex items-center justify-center">
              <ArrowDownLeft className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-base text-foreground">
                Tarik ke Pemasukan
              </h3>
              <p className="text-xs text-muted-foreground">
                Cairkan saldo tabungan ke periode {currentTitle}
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

        <div className="p-3.5 bg-muted/50 border border-border rounded-xl space-y-2">
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
              style={{ backgroundColor: goal.color ?? "#B85138" }}
            >
              <GoalIcon iconNameOrEmoji={goal.emoji} className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="font-semibold text-xs text-foreground truncate">
                {goal.name}
              </h4>
              <p className="font-mono text-xs text-muted-foreground">
                Target: {formatIDR(goal.target_amount)}
              </p>
            </div>
          </div>
          <div className="pt-2 border-t border-border flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              Saldo tabungan tersedia:
            </span>
            <span className="font-mono text-sm font-semibold text-teal-700 dark:text-teal-300">
              {formatIDR(goal.saved)}
            </span>
          </div>
        </div>

        {error && (
          <div className="p-2.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 rounded-xl text-rose-700 dark:text-rose-300 text-xs font-medium flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-foreground block">
              Nominal yang Ditarik
            </label>
            <div className="flex items-center bg-background border border-input rounded-xl px-3 py-2 focus-within:ring-2 focus-within:ring-ring">
              <span className="text-lg font-bold text-muted-foreground mr-2">
                Rp
              </span>
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

            <div className="flex flex-wrap gap-1.5 pt-1">
              {[100000, 250000, 500000, 1000000].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => handleSetQuick(val)}
                  className="min-h-[34px] px-2.5 py-1 rounded-lg text-xs font-mono font-medium bg-secondary border border-border text-secondary-foreground hover:bg-muted"
                >
                  +{formatIDR(val).replace(",00", "").replace("Rp ", "")}
                </button>
              ))}
              {goal.saved > 0 && (
                <button
                  type="button"
                  onClick={() => handleSetQuick(goal.saved)}
                  className="min-h-[34px] px-2.5 py-1 rounded-lg text-xs font-medium bg-accent text-accent-foreground border border-brand-200 dark:border-brand-800/50 hover:bg-primary hover:text-primary-foreground transition-colors"
                >
                  Tarik semua ({formatIDR(goal.saved)})
                </button>
              )}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-foreground block mb-1.5">
              Keterangan Sumber Income
            </label>
            <input
              type="text"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              placeholder={`Tarik Tabungan: ${goal.name}`}
              className="w-full min-h-[44px] border border-input bg-background text-foreground rounded-xl px-3 py-2 text-base sm:text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          <div className="p-3 bg-muted/50 border border-border rounded-xl text-xs text-muted-foreground">
            Dana akan langsung ditambahkan ke Pemasukan periode <strong className="text-foreground">{currentTitle}</strong> dan saldo target ini akan berkurang.
          </div>

          <div className="flex gap-2 justify-end pt-3 border-t border-border">
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

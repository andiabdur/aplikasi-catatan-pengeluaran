"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatIDR, formatIDRInput, parseIDRInput } from "@/lib/format";
import type { GoalWithProgress, GoalStatus } from "@/lib/types";
import {
  Plus, Target, Check, Trash2, Pencil, Loader2, X, Trophy, Archive,
} from "lucide-react";
import { cn } from "@/lib/utils";

const EMOJI_CHOICES = ["🎯", "🕋", "✈️", "🏠", "🚗", "🎓", "💍", "📱", "🏖️", "💰", "🎁", "🩺"];

type EditState =
  | { mode: "closed" }
  | { mode: "new" }
  | { mode: "edit"; goal: GoalWithProgress };

export function GoalsClient({
  householdId,
  initialGoals,
}: {
  householdId: string;
  initialGoals: GoalWithProgress[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [edit, setEdit] = useState<EditState>({ mode: "closed" });
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
        className="btn-primary w-full"
      >
        <Plus className="w-5 h-5" /> Tambah Goal Baru
      </button>

      {active.length === 0 && done.length === 0 && (
        <div className="card text-center py-10">
          <Target className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Belum ada goal. Bikin target pertama keluarga lu —<br />Umroh, jalan-jalan, DP rumah, dll.
          </p>
        </div>
      )}

      {active.map((g) => (
        <GoalCard
          key={g.id}
          goal={g}
          busy={busyId === g.id}
          onEdit={() => setEdit({ mode: "edit", goal: g })}
          onAchieve={() => setStatus(g.id, "achieved")}
          onArchive={() => setStatus(g.id, "archived")}
          onDelete={() => remove(g.id)}
        />
      ))}

      {done.length > 0 && (
        <div className="pt-2">
          <p className="text-xs font-medium text-slate-400 px-1 mb-2 uppercase tracking-wide">
            Selesai / Arsip
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
    </div>
  );
}

function GoalCard({
  goal,
  busy,
  onEdit,
  onAchieve,
  onArchive,
  onReactivate,
  onDelete,
}: {
  goal: GoalWithProgress;
  busy: boolean;
  onEdit: () => void;
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
    <div className={cn("card space-y-3", !isActive && "opacity-75")}>
      <div className="flex items-start gap-3">
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0"
          style={{ background: `${goal.color}20` }}
        >
          {goal.emoji}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h3 className="font-semibold text-slate-900 dark:text-slate-100 truncate">{goal.name}</h3>
            {goal.status === "achieved" && (
              <Trophy className="w-4 h-4 text-amber-500 shrink-0" />
            )}
            {goal.status === "archived" && (
              <Archive className="w-4 h-4 text-slate-400 shrink-0" />
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {formatIDR(goal.saved)} dari {formatIDR(goal.target_amount)}
            {goal.target_date && ` · target ${formatTargetDate(goal.target_date)}`}
          </p>
        </div>
        <span
          className={cn(
            "text-sm font-bold shrink-0",
            reached ? "text-green-600 dark:text-green-400" : "text-slate-700 dark:text-slate-200",
          )}
        >
          {pct}%
        </span>
      </div>

      <div className="h-2.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${pct}%`,
            background: reached ? "#16a34a" : goal.color,
          }}
        />
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {reached ? (
            <span className="text-green-600 dark:text-green-400 font-medium">Target tercapai! 🎉</span>
          ) : (
            <>Kurang <span className="font-medium text-slate-700 dark:text-slate-200">{formatIDR(remaining)}</span></>
          )}
        </p>
        <div className="flex items-center gap-1">
          {busy ? (
            <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
          ) : (
            <>
              {isActive && onAchieve && reached && (
                <IconBtn title="Tandai tercapai" onClick={onAchieve} className="text-green-600 dark:text-green-400">
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
              <IconBtn title="Edit" onClick={onEdit} className="text-slate-500 dark:text-slate-400">
                <Pencil className="w-4 h-4" />
              </IconBtn>
              <IconBtn title="Hapus" onClick={onDelete} className="text-red-500">
                <Trash2 className="w-4 h-4" />
              </IconBtn>
            </>
          )}
        </div>
      </div>
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
      className={cn("p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition", className)}
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
  const [emoji, setEmoji] = useState(goal?.emoji ?? "🎯");
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
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-xl space-y-4 max-h-[90dvh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-slate-900 dark:text-slate-100">
            {goal ? "Edit Goal" : "Goal Baru"}
          </h2>
          <button type="button" onClick={onClose} className="text-slate-400 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div>
          <label className="label">Pilih ikon</label>
          <div className="flex flex-wrap gap-1.5">
            {EMOJI_CHOICES.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => setEmoji(e)}
                className={cn(
                  "w-9 h-9 rounded-lg text-lg flex items-center justify-center border transition",
                  emoji === e
                    ? "border-brand-500 bg-brand-50 dark:bg-brand-500/10"
                    : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600",
                )}
              >
                {e}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="label">Nama goal</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="contoh: Umroh sekeluarga"
            className="input"
            autoFocus
          />
        </div>

        <div>
          <label className="label">Target nominal (Rp)</label>
          <input
            type="text"
            inputMode="numeric"
            value={amountText}
            onChange={(e) => setAmountText(formatIDRInput(e.target.value))}
            placeholder="0"
            className="input font-semibold"
          />
        </div>

        <div>
          <label className="label">Target tanggal (opsional)</label>
          <input
            type="date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
            className="input"
          />
        </div>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="btn-primary w-full"
        >
          {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : goal ? "Simpan Perubahan" : "Buat Goal"}
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

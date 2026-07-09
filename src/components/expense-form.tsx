"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { formatIDR, formatIDRInput, parseIDRInput, todayISO } from "@/lib/format";
import type { Category, Goal, Event } from "@/lib/types";
import { Check, Loader2, Calculator as CalcIcon, Mic, Square, Sparkles, Target } from "lucide-react";
import { cn } from "@/lib/utils";
import { useVoiceFeedback } from "@/hooks/useVoiceFeedback";
import { useVoiceRecorder } from "@/hooks/useVoiceRecorder";
import { Calculator } from "@/components/calculator";

// A category counts as "savings" if its name mentions nabung/tabung.
function isSavingsCategory(name: string | undefined): boolean {
  if (!name) return false;
  return /nabung|tabung/i.test(name);
}

export function ExpenseForm({
  categories,
  topCategories,
  goals = [],
  activeEvents = [],
}: {
  categories: Category[];
  topCategories: Category[];
  goals?: Goal[];
  activeEvents?: Event[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [spentAt, setSpentAt] = useState(todayISO());
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState<string>(topCategories[0]?.id ?? categories[0]?.id ?? "");
  const [goalId, setGoalId] = useState<string>("");
  const [costText, setCostText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);
  const [calcOpen, setCalcOpen] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const descRef = useRef<HTMLInputElement>(null);

  // Hook 1: Text to Speech voice feedbacks
  const { unlockSpeech, speakFeedback } = useVoiceFeedback();

  // Hook 2: Voice recorder and API processor
  const {
    voiceState,
    voiceError,
    transcript,
    elapsed,
    savedExpenses,
    startRecording,
    stopRecording,
    undoSaved,
    undoAll,
    saveExpense,
  } = useVoiceRecorder({
    spentAt,
    setDescription,
    setCostText,
    setCategoryId,
    speakFeedback,
    unlockSpeech,
  });

  useEffect(() => {
    descRef.current?.focus();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const amount = parseIDRInput(costText);
    if (!description.trim()) return setError("Isi nama kebutuhan dulu");
    if (!categoryId) return setError("Pilih kategori");
    if (amount <= 0) return setError("Cost harus lebih dari 0");

    const selectedCat = categories.find((c) => c.id === categoryId);
    const goalForSave = isSavingsCategory(selectedCat?.name) ? goalId : null;

    const { error: err } = await saveExpense({
      eventId: selectedEventId,
      description,
      amount,
      categoryId,
      spentAt,
      goalId: goalForSave,
    });
    if (err) return setError(err);

    setJustSaved(true);
    setDescription("");
    setCostText("");
    setGoalId("");
    descRef.current?.focus();
    setTimeout(() => setJustSaved(false), 1500);
    startTransition(() => router.refresh());
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Voice note */}
      <div className="card bg-brand-50 dark:bg-brand-500/10 border-brand-200 dark:border-brand-500/30 space-y-2">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={voiceState === "recording" ? stopRecording : startRecording}
            disabled={voiceState === "processing"}
            className={cn(
              "w-12 h-12 rounded-full flex items-center justify-center shrink-0 transition shadow-sm",
              voiceState === "recording"
                ? "bg-red-500 text-white animate-pulse"
                : voiceState === "processing"
                  ? "bg-slate-300 text-white"
                  : "bg-brand-600 text-white hover:bg-brand-700 active:scale-95",
            )}
            aria-label={voiceState === "recording" ? "Stop rekam" : "Rekam suara"}
          >
            {voiceState === "recording" ? (
              <Square className="w-5 h-5" fill="currentColor" />
            ) : voiceState === "processing" ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Mic className="w-6 h-6" />
            )}
          </button>
          <div className="min-w-0 flex-1">
            {voiceState === "recording" ? (
              <>
                <p className="text-sm font-semibold text-red-600 dark:text-red-400">
                  Merekam... {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Tap tombol stop kalau sudah selesai ngomong.</p>
              </>
            ) : voiceState === "processing" ? (
              <>
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Mendengarkan & menulis...</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Lagi diproses AI sebentar.</p>
              </>
            ) : (
              <>
                <p className="text-sm font-semibold text-brand-800 dark:text-brand-300 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" /> Catat pakai suara
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Sebut beberapa item sekaligus — beda kategori otomatis jadi post terpisah.
                </p>
              </>
            )}
          </div>
        </div>
        {transcript && voiceState === "idle" && savedExpenses.length === 0 && (
          <p className="text-xs text-slate-500 dark:text-slate-400 bg-white/70 dark:bg-slate-900/40 rounded-lg px-3 py-1.5">
            Terdengar: <span className="text-slate-700 dark:text-slate-200">&quot;{transcript}&quot;</span>
          </p>
        )}
        {savedExpenses.length > 0 && voiceState === "idle" && (
          <div className="space-y-1.5">
            {savedExpenses.length > 1 && (
              <div className="flex items-center justify-between px-1">
                <p className="text-xs font-semibold text-green-700 dark:text-green-400 flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" /> {savedExpenses.length} pengeluaran tersimpan
                </p>
                <button
                  type="button"
                  onClick={undoAll}
                  className="text-xs font-medium text-red-600 dark:text-red-400 hover:text-red-700"
                >
                  Batalkan semua
                </button>
              </div>
            )}
            {savedExpenses.map((s, i) => (
              <div
                key={s.id ?? i}
                className="bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/30 rounded-lg px-3 py-2 space-y-1"
              >
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-green-600 dark:text-green-400 shrink-0" />
                  <p className="text-xs text-slate-700 dark:text-slate-200 min-w-0 flex-1 truncate">
                    <span className="font-semibold">{s.description}</span> ·{" "}
                    <span className="font-semibold">{formatIDR(s.amount)}</span>
                    {s.categoryName && ` · ${s.categoryName}`}
                    {s.goalName && ` 🎯 ${s.goalName}`}
                  </p>
                  <button
                    type="button"
                    onClick={() => undoSaved(s.id)}
                    className="text-xs font-medium text-red-600 dark:text-red-400 hover:text-red-700 shrink-0"
                  >
                    Batalkan
                  </button>
                </div>
                {s.items.length > 1 && (
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 pl-6 leading-snug">
                    {s.items
                      .map((it) => `${it.name} ${formatIDR(it.price).replace("Rp ", "")}`)
                      .join(" + ")}{" "}
                    = {formatIDR(s.amount).replace("Rp ", "")}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
        {voiceError && <p className="text-xs text-red-600 dark:text-red-400 px-1">{voiceError}</p>}
      </div>

      {/* Tanggal */}
      <div className="card space-y-3">
        <div>
          <label className="label">Tanggal</label>
          <input
            type="date"
            value={spentAt}
            onChange={(e) => setSpentAt(e.target.value)}
            className="input"
          />
        </div>

        <div>
          <label className="label">Kebutuhan</label>
          <input
            ref={descRef}
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="contoh: Susu ultra, Bensin, dll"
            className="input"
            autoComplete="off"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="label mb-0">Cost (Rp)</label>
            <button
              type="button"
              onClick={() => { setCalcOpen((o) => !o); }}
              className={cn(
                "flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg transition",
                calcOpen
                  ? "bg-brand-600 text-white"
                  : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600",
              )}
            >
              <CalcIcon className="w-3.5 h-3.5" />
              Kalkulator
            </button>
          </div>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-medium">
              Rp
            </span>
            <input
              type="text"
              inputMode="numeric"
              value={costText}
              onChange={(e) => setCostText(formatIDRInput(e.target.value))}
              placeholder="0"
              className="input pl-12 text-lg font-semibold"
              autoComplete="off"
            />
          </div>

          {/* Calculator panel */}
          {calcOpen && (
            <Calculator
              onResult={(result) => setCostText(formatIDRInput(String(result)))}
              onClose={() => setCalcOpen(false)}
            />
          )}

          {!calcOpen && (
            <div className="flex gap-2 mt-2">
              {[5000, 10000, 25000, 50000, 100000].map((v) => (
                <button
                  type="button"
                  key={v}
                  onClick={() =>
                    setCostText(formatIDRInput(String(parseIDRInput(costText) + v)))
                  }
                  className="text-xs px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"
                >
                  +{(v / 1000).toFixed(0)}rb
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Kategori */}
      <div className="card space-y-3">
        <label className="label">Kategori</label>
        {topCategories.length > 0 && (
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">Sering dipakai</p>
            <div className="flex flex-wrap gap-2">
              {topCategories.map((c) => (
                <CategoryChip
                  key={c.id}
                  category={c}
                  selected={categoryId === c.id}
                  onSelect={() => setCategoryId(c.id)}
                />
              ))}
            </div>
          </div>
        )}
        <div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">Semua kategori</p>
          <div className="grid grid-cols-2 gap-2">
            {categories.map((c) => (
              <CategoryChip
                key={c.id}
                category={c}
                selected={categoryId === c.id}
                onSelect={() => setCategoryId(c.id)}
                full
              />
            ))}
          </div>
        </div>
      </div>

      {/* Goal picker — only when a savings (Nabung) category is selected */}
      {/* Event Link Picker */}
      {activeEvents.length > 0 && (
        <div className="card space-y-2 border-slate-200 dark:border-slate-800">
          <label className="label">Tautkan ke Event (Opsional)</label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setSelectedEventId(null)}
              className={cn(
                "px-3 py-2 rounded-xl text-sm border transition",
                selectedEventId === null
                  ? "bg-brand-50 dark:bg-brand-500/10 border-brand-500 text-brand-700 dark:text-brand-400 font-medium"
                  : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200"
              )}
            >
              Tanpa Event
            </button>
            {activeEvents.map((evt) => (
              <button
                key={evt.id}
                type="button"
                onClick={() => setSelectedEventId(evt.id)}
                className={cn(
                  "px-3 py-2 rounded-xl text-sm border transition",
                  selectedEventId === evt.id
                    ? "bg-brand-50 dark:bg-brand-500/10 border-brand-500 text-brand-700 dark:text-brand-400 font-medium"
                    : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200"
                )}
              >
                {evt.name}
              </button>
            ))}
          </div>
        </div>
      )}
      {isSavingsCategory(categories.find((c) => c.id === categoryId)?.name) && goals.length > 0 && (
        <div className="card space-y-2 border-brand-200 dark:border-brand-500/30 bg-brand-50/50 dark:bg-brand-500/10">
          <label className="label flex items-center gap-1.5">
            <Target className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" /> Nabung buat goal? (opsional)
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setGoalId("")}
              className={cn(
                "px-3 py-2 rounded-xl text-sm border transition",
                goalId === ""
                  ? "bg-slate-700 border-slate-700 text-white font-medium"
                  : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600",
              )}
            >
              Tanpa goal
            </button>
            {goals.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => setGoalId(g.id)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm border transition",
                  goalId === g.id
                    ? "bg-brand-50 dark:bg-brand-500/10 border-brand-500 text-brand-700 dark:text-brand-400 font-medium"
                    : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-600",
                )}
              >
                <span>{g.emoji}</span>
                <span className="truncate max-w-[8rem]">{g.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-600 dark:text-red-400 px-1">{error}</p>}

      <button type="submit" disabled={pending} className="btn-primary w-full text-base py-3.5">
        {pending ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : justSaved ? (
          <>
            <Check className="w-5 h-5" /> Tersimpan!
          </>
        ) : (
          "Simpan Pengeluaran"
        )}
      </button>

      <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
        Setelah simpan, form kosong otomatis biar Anda bisa input cepat berturut-turut.
      </p>
    </form>
  );
}

function CategoryChip({
  category,
  selected,
  onSelect,
  full,
}: {
  category: Category;
  selected: boolean;
  onSelect: () => void;
  full?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-xl text-sm border transition",
        full ? "w-full justify-start" : "",
        selected
          ? "bg-brand-50 dark:bg-brand-500/10 border-brand-500 text-brand-700 dark:text-brand-400 font-medium"
          : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-600",
      )}
    >
      <span
        className="w-2.5 h-2.5 rounded-full shrink-0"
        style={{ background: category.color ?? "#94a3b8" }}
      />
      <span className="truncate">{category.name}</span>
    </button>
  );
}

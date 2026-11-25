"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { formatIDR, formatIDRInput, parseIDRInput, todayISO } from "@/lib/format";
import type { Category, Goal, Event } from "@/lib/types";
import { Check, Loader2, Calculator as CalcIcon, Mic, Square, Target, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useVoiceFeedback } from "@/hooks/useVoiceFeedback";
import { useVoiceRecorder } from "@/hooks/useVoiceRecorder";
import { Calculator } from "@/components/calculator";
import { getCategoryIcon } from "@/components/category-icon";
import { Label } from "@/components/ui/label";

// A category counts as "savings" if its name mentions nabung/tabung.
function isSavingsCategory(name: string | undefined): boolean {
  if (!name) return false;
  return /nabung|tabung/i.test(name);
}

function yesterdayISO(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
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
  const [voiceDismissed, setVoiceDismissed] = useState(false);
  const descRef = useRef<HTMLInputElement>(null);
  const costRef = useRef<HTMLInputElement>(null);

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

  useEffect(() => {
    if (voiceState !== "idle" || savedExpenses.length > 0 || voiceError || transcript) {
      setVoiceDismissed(false);
    }
  }, [voiceState, savedExpenses.length, voiceError, transcript]);

  const showVoiceOverlay =
    voiceState !== "idle" ||
    (!voiceDismissed && (savedExpenses.length > 0 || Boolean(voiceError) || Boolean(transcript)));

  useEffect(() => {
    if (!showVoiceOverlay || voiceState !== "idle") return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setVoiceDismissed(true);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showVoiceOverlay, voiceState]);

  const topIds = new Set(topCategories.map((c) => c.id));
  const otherCategories = categories.filter((c) => !topIds.has(c.id));
  const selectedCategory = categories.find((c) => c.id === categoryId);
  const todayStr = todayISO();
  const yesterdayStr = yesterdayISO();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const amount = parseIDRInput(costText);
    if (!description.trim()) {
      setError("Isi nama kebutuhan dulu");
      descRef.current?.focus();
      return;
    }
    if (!categoryId) {
      setError("Pilih kategori");
      return;
    }
    if (amount <= 0) {
      setError("Nominal harus lebih dari 0");
      costRef.current?.focus();
      return;
    }

    const generalGoal = goals.find((g) => /general|umum/i.test(g.name));
    const goalForSave = isSavingsCategory(selectedCategory?.name)
      ? (goalId || generalGoal?.id || null)
      : null;

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
    setCalcOpen(false);
    descRef.current?.focus();
    setTimeout(() => setJustSaved(false), 1500);
    startTransition(() => router.refresh());
  }

  function handleVoiceToggle() {
    if (voiceState === "recording") {
      stopRecording();
    } else if (voiceState === "idle") {
      setVoiceDismissed(false);
      startRecording();
    }
  }

  const elapsedFmt = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, "0")}`;

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pb-24" noValidate>
      {/* Blok Input Utama: Nama Kebutuhan dulu -> Nominal Pengeluaran */}
      <div className="bg-white dark:bg-surface-dark border-4 border-slate-950 dark:border-slate-100 p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)] space-y-4">
        {/* Field 1: Nama Kebutuhan (Auto-focused) */}
        <div className="space-y-1.5">
          <Label htmlFor="description" className="text-xs font-headline font-bold text-slate-950 dark:text-slate-100 uppercase tracking-wider">
            Nama Kebutuhan
          </Label>
          <div className="relative flex items-center bg-slate-50 dark:bg-slate-950 border-2 border-slate-950 dark:border-slate-100 rounded-none shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,1)] focus-within:ring-2 focus-within:ring-brand-500">
            <input
              id="description"
              name="description"
              ref={descRef}
              type="text"
              enterKeyHint="next"
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                if (error) setError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  costRef.current?.focus();
                }
              }}
              placeholder="Contoh: Makan siang, Token PLN, Bensin"
              autoComplete="off"
              aria-invalid={error === "Isi nama kebutuhan dulu"}
              className="w-full min-h-[48px] bg-transparent px-3.5 py-2.5 pr-11 text-base font-headline font-bold text-slate-950 dark:text-slate-100 focus:outline-none placeholder:text-slate-400"
            />
            {description.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setDescription("");
                  descRef.current?.focus();
                }}
                aria-label="Hapus nama kebutuhan"
                className="absolute right-1.5 w-9 h-9 flex items-center justify-center text-slate-500 hover:text-slate-950 dark:text-slate-400 dark:hover:text-slate-100 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-500"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Field 2: Nominal Pengeluaran */}
        <div className="space-y-2.5 border-t-2 border-slate-200 dark:border-slate-800 pt-3.5">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="cost" className="text-xs font-headline font-bold text-slate-950 dark:text-slate-100 uppercase tracking-wider">
              Nominal Pengeluaran
            </Label>
            <button
              type="button"
              onClick={() => setCalcOpen((o) => !o)}
              aria-expanded={calcOpen}
              className={cn(
                "flex items-center gap-1.5 text-xs px-3 py-1.5 min-h-[36px] rounded-none border-2 font-mono font-bold uppercase tracking-wider transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500",
                calcOpen
                  ? "bg-slate-950 text-white dark:bg-slate-100 dark:text-slate-950 border-slate-950 dark:border-slate-100 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,1)]"
                  : "bg-brand-400 text-slate-950 border-slate-950 dark:border-slate-100 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none"
              )}
            >
              <CalcIcon className="w-3.5 h-3.5" />
              Kalkulator
            </button>
          </div>

          <div className="relative flex items-center min-h-[56px] bg-slate-50 dark:bg-slate-950 border-2 border-slate-950 dark:border-slate-100 rounded-none px-3.5 py-2.5 focus-within:ring-2 focus-within:ring-brand-500 transition-all shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,1)]">
            <span className="font-headline text-xl sm:text-2xl font-black text-slate-950 dark:text-slate-100 mr-2.5 select-none">
              Rp
            </span>
            <input
              id="cost"
              name="cost"
              ref={costRef}
              type="text"
              inputMode="numeric"
              enterKeyHint="done"
              value={costText}
              onChange={(e) => {
                setCostText(formatIDRInput(e.target.value));
                if (error) setError(null);
              }}
              placeholder="0"
              aria-invalid={error === "Nominal harus lebih dari 0"}
              className="w-full bg-transparent pr-8 font-headline text-2xl sm:text-3xl font-black text-slate-950 dark:text-slate-100 focus:outline-none placeholder-slate-400"
              autoComplete="off"
            />
            {costText.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setCostText("");
                  costRef.current?.focus();
                }}
                aria-label="Reset nominal"
                className="absolute right-1.5 w-9 h-9 flex items-center justify-center text-slate-500 hover:text-slate-950 dark:text-slate-400 dark:hover:text-slate-100 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-500"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {calcOpen && (
            <div className="pt-1">
              <Calculator
                onResult={(result) => {
                  setCostText(formatIDRInput(String(result)));
                  if (error) setError(null);
                }}
                onClose={() => setCalcOpen(false)}
              />
            </div>
          )}

          {!calcOpen && (
            <div className="flex gap-2 pt-0.5 overflow-x-auto no-scrollbar pb-0.5">
              {[5000, 10000, 25000, 50000, 100000].map((v) => (
                <button
                  type="button"
                  key={v}
                  onClick={() => {
                    setCostText(formatIDRInput(String(parseIDRInput(costText) + v)));
                    if (error) setError(null);
                  }}
                  className="text-xs font-mono font-bold px-3 min-h-[40px] rounded-none bg-white dark:bg-surface-dark border-2 border-slate-950 dark:border-slate-100 text-slate-950 dark:text-slate-100 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,1)] hover:bg-slate-950 hover:text-white dark:hover:bg-slate-100 dark:hover:text-slate-950 active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all shrink-0 uppercase focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
                >
                  +{(v / 1000).toFixed(0)}rb
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Kategori (Tanpa Duplikasi) */}
      <div className="bg-white dark:bg-surface-dark border-4 border-slate-950 dark:border-slate-100 rounded-none p-4 space-y-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)]">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <Label className="text-xs font-headline font-bold text-slate-950 dark:text-slate-100 uppercase tracking-wider">
            Kategori
          </Label>
          {selectedCategory && (
            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-brand-400 text-slate-950 border-2 border-slate-950 dark:border-slate-100 text-[11px] font-headline font-black uppercase shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] dark:shadow-[1px_1px_0px_0px_rgba(255,255,255,1)]">
              <Check className="w-3 h-3 stroke-[3]" />
              <span>Terpilih: {selectedCategory.name}</span>
            </div>
          )}
        </div>

        {topCategories.length > 0 ? (
          <>
            <div className="space-y-1.5">
              <p className="text-[11px] font-mono font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Sering Dipakai
              </p>
              <div className="grid grid-cols-2 gap-2">
                {topCategories.map((c) => (
                  <CategoryChip
                    key={c.id}
                    category={c}
                    selected={categoryId === c.id}
                    onSelect={() => {
                      setCategoryId(c.id);
                      if (error) setError(null);
                    }}
                    full
                  />
                ))}
              </div>
            </div>

            {otherCategories.length > 0 && (
              <div className="pt-1 space-y-1.5">
                <p className="text-[11px] font-mono font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Kategori Lainnya
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {otherCategories.map((c) => (
                    <CategoryChip
                      key={c.id}
                      category={c}
                      selected={categoryId === c.id}
                      onSelect={() => {
                        setCategoryId(c.id);
                        if (error) setError(null);
                      }}
                      full
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="space-y-1.5">
            <p className="text-[11px] font-mono font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Semua Kategori
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {categories.map((c) => (
                <CategoryChip
                  key={c.id}
                  category={c}
                  selected={categoryId === c.id}
                  onSelect={() => {
                    setCategoryId(c.id);
                    if (error) setError(null);
                  }}
                  full
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Detail Tambahan: Tanggal (dengan shortcut Hari Ini / Kemarin), Event, Goal */}
      <div className="bg-white dark:bg-surface-dark border-4 border-slate-950 dark:border-slate-100 rounded-none p-4 space-y-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)]">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="date" className="text-xs font-headline font-bold text-slate-950 dark:text-slate-100 uppercase tracking-wider">
                Tanggal
              </Label>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setSpentAt(todayStr)}
                  className={cn(
                    "px-2.5 min-h-[32px] text-[10px] font-mono font-bold uppercase border-2 border-slate-950 dark:border-slate-100 transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-500",
                    spentAt === todayStr
                      ? "bg-slate-950 text-white dark:bg-slate-100 dark:text-slate-950"
                      : "bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                  )}
                >
                  Hari Ini
                </button>
                <button
                  type="button"
                  onClick={() => setSpentAt(yesterdayStr)}
                  className={cn(
                    "px-2.5 min-h-[32px] text-[10px] font-mono font-bold uppercase border-2 border-slate-950 dark:border-slate-100 transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-500",
                    spentAt === yesterdayStr
                      ? "bg-slate-950 text-white dark:bg-slate-100 dark:text-slate-950"
                      : "bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                  )}
                >
                  Kemarin
                </button>
              </div>
            </div>
            <input
              id="date"
              name="spentAt"
              type="date"
              value={spentAt}
              onChange={(e) => setSpentAt(e.target.value)}
              className="w-full min-h-[44px] px-3 py-2 text-base sm:text-sm rounded-none border-2 border-slate-950 dark:border-slate-100 bg-slate-50 dark:bg-slate-950 text-slate-950 dark:text-slate-100 font-mono font-bold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,1)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
            />
          </div>

          {activeEvents.length > 0 && (
            <div className="space-y-1.5">
              <Label htmlFor="event" className="text-xs font-headline font-bold text-slate-950 dark:text-slate-100 uppercase tracking-wider block pt-1">
                Event (Opsional)
              </Label>
              <select
                id="event"
                name="eventId"
                value={selectedEventId ?? ""}
                onChange={(e) => setSelectedEventId(e.target.value || null)}
                className="w-full min-h-[44px] px-3 py-2 text-base sm:text-sm rounded-none border-2 border-slate-950 dark:border-slate-100 bg-slate-50 dark:bg-slate-950 text-slate-950 dark:text-slate-100 font-headline font-bold uppercase shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,1)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
              >
                <option value="">Tanpa Event</option>
                {activeEvents.map((evt) => (
                  <option key={evt.id} value={evt.id}>
                    {evt.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Goal Linker if Nabung Category */}
        {isSavingsCategory(selectedCategory?.name) && goals.length > 0 && (
          <div className="p-3 bg-brand-500/10 border-2 border-slate-950 dark:border-slate-100 rounded-none space-y-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,1)]">
            <Label htmlFor="goal-select" className="text-xs font-headline font-bold text-slate-950 dark:text-slate-100 uppercase tracking-wider flex items-center gap-1.5">
              <Target className="w-4 h-4 text-brand-600 dark:text-brand-400" /> Alokasikan ke Goal Tabungan
            </Label>
            <select
              id="goal-select"
              name="goalId"
              value={goalId}
              onChange={(e) => setGoalId(e.target.value)}
              className="w-full min-h-[44px] px-3 py-2 text-base sm:text-sm rounded-none border-2 border-slate-950 dark:border-slate-100 bg-white dark:bg-slate-900 text-slate-950 dark:text-slate-100 font-headline font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
            >
              <option value="">Tabungan General (Default / Tanpa Target Khusus)</option>
              {goals.filter((g) => !/general|umum/i.test(g.name)).map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Validation Error Banner */}
      {error && (
        <div
          role="alert"
          aria-live="polite"
          className="p-3 bg-rose-100 dark:bg-rose-950/70 border-2 border-rose-600 text-rose-900 dark:text-rose-200 text-xs font-mono font-bold uppercase shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
        >
          {error}
        </div>
      )}

      {/* Dynamic Voice Status Panel (Muncul hanya saat aktif / ada hasil) */}
      {showVoiceOverlay && (
        <div className="fixed bottom-[calc(9.75rem+env(safe-area-inset-bottom))] inset-x-0 z-30 px-4 pointer-events-none">
          <div className="mx-auto max-w-md pointer-events-auto bg-white dark:bg-surface-dark border-4 border-slate-950 dark:border-slate-100 p-3.5 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] dark:shadow-[6px_6px_0px_0px_rgba(255,255,255,1)] space-y-2.5">
            {voiceState === "recording" && (
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="inline-block w-2.5 h-2.5 bg-rose-500 animate-pulse shrink-0" />
                    <span className="font-mono text-xs font-bold uppercase text-rose-600 dark:text-rose-400">
                      Merekam {elapsedFmt}
                    </span>
                  </div>
                  <p className="text-[11px] font-headline font-bold text-slate-700 dark:text-slate-300 uppercase leading-snug">
                    Sebut belanjaan sekaligus, AI pisahkan otomatis
                  </p>
                </div>
                <button
                  type="button"
                  onClick={stopRecording}
                  className="px-3.5 min-h-[44px] bg-rose-500 text-white border-2 border-slate-950 dark:border-slate-100 font-headline font-black text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none shrink-0"
                >
                  <Square className="w-3.5 h-3.5" fill="currentColor" />
                  Stop
                </button>
              </div>
            )}

            {voiceState === "processing" && (
              <div className="flex items-center gap-2.5 py-1">
                <Loader2 className="w-5 h-5 animate-spin text-brand-600 dark:text-brand-400 shrink-0" />
                <p className="font-mono text-xs font-bold uppercase text-slate-950 dark:text-slate-100">
                  Menganalisis suara dengan AI...
                </p>
              </div>
            )}

            {voiceState === "idle" && (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2 pb-1.5 border-b-2 border-slate-950 dark:border-slate-100">
                  <p className="text-xs font-headline font-black uppercase tracking-wider text-slate-950 dark:text-slate-100 flex items-center gap-1.5">
                    {savedExpenses.length > 0 ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        {savedExpenses.length} Pengeluaran Tersimpan
                      </>
                    ) : (
                      "Catatan Suara"
                    )}
                  </p>
                  <div className="flex items-center gap-2">
                    {savedExpenses.length > 1 && (
                      <button
                        type="button"
                        onClick={undoAll}
                        className="text-[11px] font-mono font-bold uppercase text-rose-600 dark:text-rose-400 hover:underline px-1.5 py-1"
                      >
                        Batalkan semua
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setVoiceDismissed(true)}
                      aria-label="Tutup panel suara"
                      className="min-h-[36px] min-w-[36px] flex items-center justify-center border-2 border-slate-950 dark:border-slate-100 text-slate-950 dark:text-slate-100 hover:bg-slate-950 hover:text-white dark:hover:bg-slate-100 dark:hover:text-slate-950"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {transcript && savedExpenses.length === 0 && (
                  <p className="text-xs font-mono font-bold text-slate-950 dark:text-slate-100 bg-slate-100 dark:bg-slate-900 p-2 border-2 border-slate-950 dark:border-slate-100">
                    Terdengar: &quot;{transcript}&quot;
                  </p>
                )}

                {savedExpenses.length > 0 && (
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {savedExpenses.map((s, i) => (
                      <div
                        key={s.id ?? i}
                        className="bg-emerald-50 dark:bg-emerald-950/60 border-2 border-slate-950 dark:border-slate-100 p-2.5 flex items-center gap-2"
                      >
                        <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <p className="text-xs text-slate-900 dark:text-slate-100 min-w-0 flex-1 break-words font-headline uppercase font-bold">
                          <span>{s.description}</span> ·{" "}
                          <span className="font-mono">{formatIDR(s.amount)}</span>
                          {s.categoryName && ` · ${s.categoryName}`}
                        </p>
                        <button
                          type="button"
                          onClick={() => undoSaved(s.id)}
                          className="text-xs font-mono font-bold text-rose-600 dark:text-rose-400 hover:underline shrink-0 uppercase px-1 py-1"
                        >
                          Batalkan
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {voiceError && (
                  <p className="text-xs font-mono font-bold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/50 border-2 border-rose-600 p-2">
                    {voiceError}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sticky Bottom Thumb-Zone Action Bar: Simpan + Mic sejajar */}
      <div className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] inset-x-0 z-30 bg-slate-50/95 dark:bg-background-dark/95 border-t-4 border-slate-950 dark:border-slate-100">
        <div className="mx-auto max-w-md px-4 py-2.5 flex items-stretch gap-2.5">
          <button
            type="submit"
            disabled={pending}
            className="flex-1 min-h-[52px] px-4 bg-brand-500 text-slate-950 hover:bg-brand-400 font-headline font-black uppercase tracking-wider text-sm sm:text-base rounded-none border-4 border-slate-950 dark:border-slate-100 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all flex items-center justify-center gap-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:opacity-60"
          >
            {pending ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : justSaved ? (
              <span className="flex items-center gap-2">
                <Check className="w-5 h-5" /> Tersimpan!
              </span>
            ) : (
              "Simpan Pengeluaran"
            )}
          </button>

          <button
            type="button"
            onClick={handleVoiceToggle}
            disabled={voiceState === "processing"}
            aria-label={voiceState === "recording" ? "Stop rekam suara" : "Input pengeluaran via suara"}
            className={cn(
              "min-h-[52px] px-3.5 shrink-0 rounded-none border-4 border-slate-950 dark:border-slate-100 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all flex items-center justify-center gap-1.5 font-headline font-black text-xs uppercase focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:opacity-60",
              voiceState === "recording"
                ? "bg-rose-500 text-white"
                : voiceState === "processing"
                  ? "bg-amber-400 text-slate-950"
                  : "bg-slate-950 text-white dark:bg-slate-100 dark:text-slate-950 hover:bg-slate-800 dark:hover:bg-slate-200"
            )}
          >
            {voiceState === "recording" ? (
              <>
                <Square className="w-4 h-4" fill="currentColor" />
                <span className="font-mono">{elapsedFmt}</span>
              </>
            ) : voiceState === "processing" ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <Mic className="w-5 h-5" />
                <span>Suara</span>
              </>
            )}
          </button>
        </div>
      </div>
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
  const Icon = getCategoryIcon(category.name);
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex items-center gap-2.5 px-2.5 py-2 sm:px-3 sm:py-2.5 rounded-none text-xs font-headline font-bold uppercase tracking-wider border-2 border-slate-950 dark:border-slate-100 transition-all active:translate-x-[1px] active:translate-y-[1px] active:shadow-none min-h-[48px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500",
        full ? "w-full justify-start h-full" : "",
        selected
          ? "bg-slate-950 text-white dark:bg-slate-100 dark:text-slate-950 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)] ring-2 ring-brand-500 dark:ring-brand-400"
          : "bg-white dark:bg-surface-dark text-slate-950 dark:text-slate-100 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,1)] hover:bg-slate-100 dark:hover:bg-slate-800"
      )}
    >
      <div
        className="w-7 h-7 rounded-none flex items-center justify-center shrink-0 border border-slate-950 dark:border-slate-100"
        style={{ backgroundColor: category.color ?? "#16a34a" }}
      >
        <Icon className="w-3.5 h-3.5 text-white" />
      </div>
      <span className="min-w-0 flex-1 whitespace-normal break-words text-left leading-snug">
        {category.name}
      </span>
      {selected && (
        <Check className="w-4 h-4 shrink-0 text-brand-400 dark:text-brand-600 stroke-[3] ml-auto" />
      )}
    </button>
  );
}

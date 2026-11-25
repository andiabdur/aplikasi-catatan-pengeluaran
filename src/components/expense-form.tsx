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
  initialEventId = null,
}: {
  categories: Category[];
  topCategories: Category[];
  goals?: Goal[];
  activeEvents?: Event[];
  initialEventId?: string | null;
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
  const [selectedEventId, setSelectedEventId] = useState<string | null>(() =>
    initialEventId && activeEvents.some((ev) => ev.id === initialEventId)
      ? initialEventId
      : null
  );
  const [voiceDismissed, setVoiceDismissed] = useState(false);
  const descRef = useRef<HTMLInputElement>(null);
  const costRef = useRef<HTMLInputElement>(null);

  const { unlockSpeech, speakFeedback } = useVoiceFeedback();

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
  const selectedEventObj = selectedEventId
    ? activeEvents.find((ev) => ev.id === selectedEventId) ?? null
    : null;

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pb-24" noValidate>
      {selectedEventObj && (
        <div className="flex items-center justify-between gap-2 bg-accent/75 border border-brand-200 dark:border-brand-800/50 rounded-2xl px-3.5 py-2.5 text-xs">
          <div className="min-w-0">
            <span className="text-muted-foreground">Event aktif: </span>
            <span className="font-semibold text-accent-foreground truncate">
              {selectedEventObj.name}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setSelectedEventId(null)}
            className="text-xs font-medium text-muted-foreground hover:text-foreground shrink-0 px-2 py-0.5 rounded-lg hover:bg-background/60"
          >
            Lepas
          </button>
        </div>
      )}
      {/* Blok Input Utama: Nama Kebutuhan dulu -> Nominal Pengeluaran */}
      <div className="bg-card border border-border rounded-2xl p-4 shadow-sm space-y-4">
        {/* Field 1: Nama Kebutuhan (Auto-focused) */}
        <div className="space-y-1.5">
          <Label htmlFor="description" className="text-xs font-semibold text-foreground">
            Nama Kebutuhan
          </Label>
          <div className="relative flex items-center bg-background border border-input rounded-xl focus-within:ring-2 focus-within:ring-ring focus-within:border-primary transition-all">
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
              className="w-full min-h-[48px] bg-transparent px-3.5 py-2.5 pr-11 text-base font-medium text-foreground focus:outline-none placeholder:text-muted-foreground"
            />
            {description.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setDescription("");
                  descRef.current?.focus();
                }}
                aria-label="Hapus nama kebutuhan"
                className="absolute right-1.5 w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Field 2: Nominal Pengeluaran */}
        <div className="space-y-2.5 border-t border-border pt-3.5">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="cost" className="text-xs font-semibold text-foreground">
              Nominal Pengeluaran
            </Label>
            <button
              type="button"
              onClick={() => setCalcOpen((o) => !o)}
              aria-expanded={calcOpen}
              className={cn(
                "flex items-center gap-1.5 text-xs px-3 py-1.5 min-h-[36px] rounded-xl border font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                calcOpen
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "bg-secondary text-secondary-foreground border-border hover:bg-muted"
              )}
            >
              <CalcIcon className="w-3.5 h-3.5" />
              Kalkulator
            </button>
          </div>

          <div className="relative flex items-center min-h-[56px] bg-background border border-input rounded-xl px-3.5 py-2.5 focus-within:ring-2 focus-within:ring-ring focus-within:border-primary transition-all">
            <span className="text-xl sm:text-2xl font-bold text-muted-foreground mr-2.5 select-none">
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
              className="w-full bg-transparent pr-8 font-mono text-2xl sm:text-3xl font-bold text-foreground focus:outline-none placeholder:text-muted-foreground/60 tabular-nums"
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
                className="absolute right-1.5 w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
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
                  className="text-xs font-mono font-medium px-3 min-h-[40px] rounded-xl bg-secondary border border-border text-secondary-foreground hover:bg-accent hover:text-accent-foreground hover:border-primary/40 active:scale-95 transition-all shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  +{(v / 1000).toFixed(0)}rb
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Kategori (Tanpa Duplikasi) */}
      <div className="bg-card border border-border rounded-2xl p-4 space-y-3 shadow-sm">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <Label className="text-xs font-semibold text-foreground">
            Kategori
          </Label>
          {selectedCategory && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-accent text-accent-foreground border border-brand-200 dark:border-brand-800/50 text-xs font-medium">
              <Check className="w-3.5 h-3.5 text-primary" />
              <span>Terpilih: {selectedCategory.name}</span>
            </div>
          )}
        </div>

        {topCategories.length > 0 ? (
          <>
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">
                Sering dipakai
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
                <p className="text-xs font-medium text-muted-foreground">
                  Kategori lainnya
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
            <p className="text-xs font-medium text-muted-foreground">
              Semua kategori
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
      <div className="bg-card border border-border rounded-2xl p-4 space-y-4 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="date" className="text-xs font-semibold text-foreground">
                Tanggal
              </Label>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setSpentAt(todayStr)}
                  className={cn(
                    "px-2.5 min-h-[32px] rounded-lg text-xs font-medium border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    spentAt === todayStr
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-secondary text-secondary-foreground border-border hover:bg-muted"
                  )}
                >
                  Hari ini
                </button>
                <button
                  type="button"
                  onClick={() => setSpentAt(yesterdayStr)}
                  className={cn(
                    "px-2.5 min-h-[32px] rounded-lg text-xs font-medium border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    spentAt === yesterdayStr
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-secondary text-secondary-foreground border-border hover:bg-muted"
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
              className="w-full min-h-[44px] px-3 py-2 text-base sm:text-sm rounded-xl border border-input bg-background text-foreground font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          {activeEvents.length > 0 && (
            <div className="space-y-1.5">
              <Label htmlFor="event" className="text-xs font-semibold text-foreground block pt-1">
                Event (Opsional)
              </Label>
              <select
                id="event"
                name="eventId"
                value={selectedEventId ?? ""}
                onChange={(e) => setSelectedEventId(e.target.value || null)}
                className="w-full min-h-[44px] px-3 py-2 text-base sm:text-sm rounded-xl border border-input bg-background text-foreground font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
          <div className="p-3.5 bg-accent/60 border border-brand-200 dark:border-brand-800/50 rounded-xl space-y-2">
            <Label htmlFor="goal-select" className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Target className="w-4 h-4 text-primary" /> Alokasikan ke Goal Tabungan
            </Label>
            <select
              id="goal-select"
              name="goalId"
              value={goalId}
              onChange={(e) => setGoalId(e.target.value)}
              className="w-full min-h-[44px] px-3 py-2 text-base sm:text-sm rounded-xl border border-input bg-background text-foreground font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
          className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800/60 rounded-xl text-rose-700 dark:text-rose-300 text-xs font-medium"
        >
          {error}
        </div>
      )}

      {/* Dynamic Voice Status Panel */}
      {showVoiceOverlay && (
        <div className="fixed bottom-[calc(9.75rem+env(safe-area-inset-bottom))] inset-x-0 z-30 px-4 pointer-events-none">
          <div className="mx-auto max-w-md pointer-events-auto bg-card border border-border rounded-2xl p-3.5 shadow-lg space-y-2.5">
            {voiceState === "recording" && (
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="inline-block w-2.5 h-2.5 rounded-full bg-rose-600 animate-pulse shrink-0" />
                    <span className="font-mono text-xs font-semibold text-rose-700 dark:text-rose-300">
                      Merekam {elapsedFmt}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-snug">
                    Sebut belanjaan sekaligus, AI pisahkan otomatis
                  </p>
                </div>
                <button
                  type="button"
                  onClick={stopRecording}
                  className="px-3.5 min-h-[44px] rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs flex items-center gap-1.5 shadow-sm active:scale-95 shrink-0"
                >
                  <Square className="w-3.5 h-3.5" fill="currentColor" />
                  Stop
                </button>
              </div>
            )}

            {voiceState === "processing" && (
              <div className="flex items-center gap-2.5 py-1">
                <Loader2 className="w-5 h-5 animate-spin text-primary shrink-0" />
                <p className="text-xs font-medium text-foreground">
                  Menganalisis suara dengan AI...
                </p>
              </div>
            )}

            {voiceState === "idle" && (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-border">
                  <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    {savedExpenses.length > 0 ? (
                      <>
                        <Check className="w-4 h-4 text-teal-700 dark:text-teal-300" />
                        {savedExpenses.length} pengeluaran tersimpan
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
                        className="text-xs font-medium text-rose-700 dark:text-rose-300 hover:underline px-1.5 py-1"
                      >
                        Batalkan semua
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setVoiceDismissed(true)}
                      aria-label="Tutup panel suara"
                      className="min-h-[36px] min-w-[36px] rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {transcript && savedExpenses.length === 0 && (
                  <p className="text-xs font-mono text-muted-foreground bg-muted/60 rounded-xl p-2.5">
                    Terdengar: &quot;{transcript}&quot;
                  </p>
                )}

                {savedExpenses.length > 0 && (
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {savedExpenses.map((s, i) => (
                      <div
                        key={s.id ?? i}
                        className="bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800/60 rounded-xl p-2.5 flex items-center gap-2"
                      >
                        <Check className="w-4 h-4 text-teal-700 dark:text-teal-300 shrink-0" />
                        <p className="text-xs text-foreground min-w-0 flex-1 break-words font-medium">
                          <span>{s.description}</span> ·{" "}
                          <span className="font-mono font-semibold">{formatIDR(s.amount)}</span>
                          {s.categoryName && ` · ${s.categoryName}`}
                        </p>
                        <button
                          type="button"
                          onClick={() => undoSaved(s.id)}
                          className="text-xs font-semibold text-rose-700 dark:text-rose-300 hover:underline shrink-0 px-1 py-1"
                        >
                          Batalkan
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {voiceError && (
                  <p className="text-xs font-medium text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 rounded-xl p-2.5">
                    {voiceError}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sticky Bottom Thumb-Zone Action Bar */}
      <div className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] inset-x-0 z-30 bg-background/95 backdrop-blur-md border-t border-border">
        <div className="mx-auto max-w-md px-4 py-2.5 flex items-stretch gap-2.5">
          <button
            type="submit"
            disabled={pending}
            className="flex-1 min-h-[52px] px-4 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold text-sm sm:text-base rounded-xl shadow-sm active:scale-[0.98] transition-all flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-60"
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
              "min-h-[52px] px-3.5 shrink-0 rounded-xl border active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 font-semibold text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-60",
              voiceState === "recording"
                ? "bg-rose-600 border-rose-600 text-white shadow-sm"
                : voiceState === "processing"
                  ? "bg-amber-100 border-amber-300 text-amber-900 dark:bg-amber-950/60 dark:border-amber-800 dark:text-amber-200"
                  : "bg-secondary border-border text-secondary-foreground hover:bg-muted"
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
        "flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-medium border transition-all active:scale-[0.98] min-h-[48px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        full ? "w-full justify-start h-full" : "",
        selected
          ? "bg-accent text-accent-foreground border-primary ring-1 ring-primary font-semibold"
          : "bg-card text-foreground border-border hover:bg-muted/70"
      )}
    >
      <div
        className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
        style={{ backgroundColor: category.color ?? "#B85138" }}
      >
        <Icon className="w-3.5 h-3.5 text-white" />
      </div>
      <span className="min-w-0 flex-1 whitespace-normal break-words text-left leading-snug">
        {category.name}
      </span>
      {selected && (
        <Check className="w-4 h-4 shrink-0 text-primary ml-auto" />
      )}
    </button>
  );
}

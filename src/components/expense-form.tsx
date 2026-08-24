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
import { getCategoryIcon } from "@/components/category-icon";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

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
      {/* Nominal Input (Bauhaus V2 Style) */}
      <div className="bg-white dark:bg-surface-dark border-4 border-slate-950 dark:border-slate-100 p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)] space-y-2.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="cost" className="text-xs font-headline font-bold text-slate-950 dark:text-slate-100 uppercase tracking-wider">
            Nominal Pengeluaran
          </Label>
          <button
            type="button"
            onClick={() => setCalcOpen((o) => !o)}
            className={cn(
              "flex items-center gap-1.5 text-xs px-3 py-1 rounded-none border-2 font-mono font-bold uppercase tracking-wider transition-all",
              calcOpen
                ? "bg-slate-950 text-white dark:bg-slate-100 dark:text-slate-950 border-slate-950 dark:border-slate-100 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,1)]"
                : "bg-brand-400 text-slate-950 border-slate-950 dark:border-slate-100 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none"
            )}
          >
            <CalcIcon className="w-3.5 h-3.5" />
            Kalkulator
          </button>
        </div>

        <div className="flex items-center bg-slate-50 dark:bg-slate-950 border-2 border-slate-950 dark:border-slate-100 rounded-none px-4 py-3 focus-within:border-brand-500 transition-all shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,1)]">
          <span className="font-headline text-2xl font-black text-slate-950 dark:text-slate-100 mr-3">
            Rp
          </span>
          <input
            id="cost"
            type="text"
            inputMode="numeric"
            value={costText}
            onChange={(e) => setCostText(formatIDRInput(e.target.value))}
            placeholder="0"
            className="w-full bg-transparent font-headline text-3xl font-black text-slate-950 dark:text-slate-100 focus:outline-none placeholder-slate-400"
            autoComplete="off"
          />
        </div>

        {/* Calculator panel */}
        {calcOpen && (
          <div className="pt-2">
            <Calculator
              onResult={(result) => setCostText(formatIDRInput(String(result)))}
              onClose={() => setCalcOpen(false)}
            />
          </div>
        )}

        {!calcOpen && (
          <div className="flex gap-2 pt-1 overflow-x-auto no-scrollbar">
            {[5000, 10000, 25000, 50000, 100000].map((v) => (
              <button
                type="button"
                key={v}
                onClick={() =>
                  setCostText(formatIDRInput(String(parseIDRInput(costText) + v)))
                }
                className="text-xs font-mono font-bold px-3 py-1.5 rounded-none bg-white dark:bg-surface-dark border-2 border-slate-950 dark:border-slate-100 text-slate-950 dark:text-slate-100 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,1)] hover:bg-slate-950 hover:text-white dark:hover:bg-slate-100 dark:hover:text-slate-950 active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all shrink-0 uppercase"
              >
                +{(v / 1000).toFixed(0)}rb
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Voice Note Card (Bauhaus V2 Centered Style) */}
      <div className="bg-white dark:bg-surface-dark border-4 border-slate-950 dark:border-slate-100 rounded-none p-5 flex flex-col items-center justify-center text-center gap-3 relative overflow-hidden shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] dark:shadow-[6px_6px_0px_0px_rgba(255,255,255,1)] group">
        <button
          type="button"
          onClick={voiceState === "recording" ? stopRecording : startRecording}
          disabled={voiceState === "processing"}
          className={cn(
            "w-16 h-16 rounded-none flex items-center justify-center border-4 border-slate-950 dark:border-slate-100 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all z-10",
            voiceState === "recording"
              ? "bg-rose-500 text-white animate-pulse"
              : voiceState === "processing"
                ? "bg-slate-300 text-slate-700"
                : "bg-brand-500 text-slate-950 hover:bg-brand-400"
          )}
          aria-label={voiceState === "recording" ? "Stop rekam" : "Rekam suara"}
        >
          {voiceState === "recording" ? (
            <Square className="w-6 h-6" fill="currentColor" />
          ) : voiceState === "processing" ? (
            <Loader2 className="w-6 h-6 animate-spin" />
          ) : (
            <Mic className="w-8 h-8" />
          )}
        </button>
        <div className="z-10 space-y-1">
          {voiceState === "recording" ? (
            <p className="font-mono text-xs font-bold text-white bg-rose-500 px-3 py-1 rounded-none border-2 border-slate-950 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] inline-block uppercase tracking-wider">
              Merekam {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")} · Tap untuk selesai
            </p>
          ) : voiceState === "processing" ? (
            <p className="font-mono text-xs font-bold text-slate-950 dark:text-slate-100 bg-brand-400 px-3 py-1 rounded-none border-2 border-slate-950 dark:border-slate-100 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] inline-block uppercase tracking-wider">
              Menganalisis suara dengan AI...
            </p>
          ) : (
            <>
              <p className="font-mono text-xs font-bold text-slate-950 dark:text-slate-100 bg-white dark:bg-slate-950 px-3 py-1 rounded-none border-2 border-slate-950 dark:border-slate-100 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] inline-block uppercase tracking-wider">
                00:00 · Voice Input
              </p>
              <p className="text-xs font-headline font-bold text-slate-700 dark:text-slate-300 max-w-[280px] mx-auto mt-1 leading-relaxed uppercase tracking-wide">
                Sebut belanjaan sekaligus, AI akan memisahkan otomatis
              </p>
            </>
          )}
        </div>

        {transcript && voiceState === "idle" && savedExpenses.length === 0 && (
          <p className="text-xs font-mono font-bold text-slate-950 dark:text-slate-100 bg-white dark:bg-slate-950 rounded-none p-2.5 w-full border-2 border-slate-950 dark:border-slate-100 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
            Terdengar: &quot;{transcript}&quot;
          </p>
        )}

        {savedExpenses.length > 0 && voiceState === "idle" && (
          <div className="space-y-2 w-full pt-1">
            {savedExpenses.length > 1 && (
              <div className="flex items-center justify-between px-1">
                <p className="text-xs font-headline font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 uppercase tracking-wider">
                  <Check className="w-3.5 h-3.5" /> {savedExpenses.length} pengeluaran tersimpan
                </p>
                <button
                  type="button"
                  onClick={undoAll}
                  className="text-xs font-mono font-bold uppercase text-rose-600 dark:text-rose-400 hover:underline"
                >
                  Batalkan semua
                </button>
              </div>
            )}
            {savedExpenses.map((s, i) => (
              <div
                key={s.id ?? i}
                className="bg-emerald-50 dark:bg-emerald-950/60 border-2 border-slate-950 dark:border-slate-100 rounded-none p-3 text-left space-y-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,1)]"
              >
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <p className="text-xs text-slate-900 dark:text-slate-100 min-w-0 flex-1 break-words font-headline uppercase font-bold">
                    <span>{s.description}</span> ·{" "}
                    <span className="font-mono">{formatIDR(s.amount)}</span>
                    {s.categoryName && ` · ${s.categoryName}`}
                  </p>
                  <button
                    type="button"
                    onClick={() => undoSaved(s.id)}
                    className="text-xs font-mono font-bold text-rose-600 dark:text-rose-400 hover:underline shrink-0 uppercase"
                  >
                    Batalkan
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        {voiceError && <p className="text-xs font-mono font-bold text-rose-600 dark:text-rose-400">{voiceError}</p>}
      </div>

      {/* Form Details */}
      <div className="bg-white dark:bg-surface-dark border-4 border-slate-950 dark:border-slate-100 rounded-none p-4 space-y-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)]">
        {/* Description Input */}
        <div className="space-y-1.5">
          <Label htmlFor="description" className="text-xs font-headline font-bold text-slate-950 dark:text-slate-100 uppercase tracking-wider">
            Nama Kebutuhan
          </Label>
          <input
            id="description"
            ref={descRef}
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Contoh: Makan siang Nasi Padang, Token PLN, dll"
            autoComplete="off"
            className="w-full bg-slate-50 dark:bg-slate-950 border-2 border-slate-950 dark:border-slate-100 rounded-none p-3 text-sm font-headline font-bold text-slate-950 dark:text-slate-100 focus:outline-none focus:bg-brand-50 dark:focus:bg-slate-900 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,1)] placeholder:text-slate-400"
          />
        </div>

        {/* Categories (Frequent Chips + Full Grid) */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <Label className="text-xs font-headline font-bold text-slate-950 dark:text-slate-100 uppercase tracking-wider">
              Kategori
            </Label>
            {categories.find((c) => c.id === categoryId) && (
              <div className="flex items-center gap-1.5 px-2 py-0.5 bg-brand-400 text-slate-950 border-2 border-slate-950 dark:border-slate-100 text-[11px] font-headline font-black uppercase shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] dark:shadow-[1px_1px_0px_0px_rgba(255,255,255,1)]">
                <Check className="w-3 h-3 stroke-[3]" />
                <span>Terpilih: {categories.find((c) => c.id === categoryId)?.name}</span>
              </div>
            )}
          </div>

          {topCategories.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[11px] font-mono font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Sering Dipakai
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {topCategories.map((c) => (
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
          )}

          <div className="pt-1 space-y-1.5">
            <p className="text-[11px] font-mono font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Semua Kategori
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
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

        {/* Date & Event/Goal Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <div className="space-y-1.5">
            <Label htmlFor="date" className="text-xs font-headline font-bold text-slate-950 dark:text-slate-100 uppercase tracking-wider">
              Tanggal
            </Label>
            <input
              id="date"
              type="date"
              value={spentAt}
              onChange={(e) => setSpentAt(e.target.value)}
              className="w-full h-11 px-3 py-2 text-sm rounded-none border-2 border-slate-950 dark:border-slate-100 bg-slate-50 dark:bg-slate-950 text-slate-950 dark:text-slate-100 font-mono font-bold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,1)] focus:outline-none"
            />
          </div>

          {activeEvents.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs font-headline font-bold text-slate-950 dark:text-slate-100 uppercase tracking-wider">
                Event (Opsional)
              </Label>
              <select
                value={selectedEventId ?? ""}
                onChange={(e) => setSelectedEventId(e.target.value || null)}
                className="w-full h-11 px-3 py-2 text-sm rounded-none border-2 border-slate-950 dark:border-slate-100 bg-slate-50 dark:bg-slate-950 text-slate-950 dark:text-slate-100 font-headline font-bold uppercase shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,1)] focus:outline-none"
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
        {isSavingsCategory(categories.find((c) => c.id === categoryId)?.name) && goals.length > 0 && (
          <div className="p-3 bg-brand-500/10 border-2 border-slate-950 dark:border-slate-100 rounded-none space-y-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,1)]">
            <Label className="text-xs font-headline font-bold text-slate-950 dark:text-slate-100 uppercase tracking-wider flex items-center gap-1.5">
              <Target className="w-4 h-4 text-brand-500" /> Alokasikan ke Goal Tabungan
            </Label>
            <select
              value={goalId}
              onChange={(e) => setGoalId(e.target.value)}
              className="w-full h-10 px-3 py-2 text-sm rounded-none border-2 border-slate-950 dark:border-slate-100 bg-white dark:bg-slate-900 text-slate-950 dark:text-slate-100 font-headline font-bold focus:outline-none"
            >
              <option value="">Tanpa Goal Khusus</option>
              {goals.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {error && <p className="text-xs font-mono font-bold text-rose-600 dark:text-rose-400 px-1 uppercase">{error}</p>}

      {/* Submit Button */}
      <button
        type="submit"
        disabled={pending}
        className="w-full text-base py-4 bg-brand-500 text-slate-950 hover:bg-brand-400 font-headline font-black uppercase tracking-wider rounded-none border-4 border-slate-950 dark:border-slate-100 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] dark:shadow-[6px_6px_0px_0px_rgba(255,255,255,1)] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none transition-all flex items-center justify-center gap-2"
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
        "flex items-center gap-2.5 px-2.5 py-2 sm:px-3 sm:py-2.5 rounded-none text-xs font-headline font-bold uppercase tracking-wider border-2 border-slate-950 dark:border-slate-100 transition-all active:translate-x-[1px] active:translate-y-[1px] active:shadow-none min-h-[48px]",
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

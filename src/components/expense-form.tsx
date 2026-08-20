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
      {/* Nominal Input (Neo-Brutalist Stitch Style) */}
      <div className="neo-card p-4 space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="cost" className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Nominal Pengeluaran
          </Label>
          <button
            type="button"
            onClick={() => setCalcOpen((o) => !o)}
            className={cn(
              "flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border font-semibold transition-all",
              calcOpen
                ? "bg-brand-600 text-white border-brand-600 shadow-sm"
                : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700",
            )}
          >
            <CalcIcon className="w-3.5 h-3.5" />
            Kalkulator
          </button>
        </div>

        <div className="flex items-center bg-slate-50 dark:bg-slate-950 border-2 border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 focus-within:border-brand-500 transition-all shadow-inner">
          <span className="font-mono text-xl font-bold text-brand-600 dark:text-brand-400 mr-2.5">
            Rp
          </span>
          <input
            id="cost"
            type="text"
            inputMode="numeric"
            value={costText}
            onChange={(e) => setCostText(formatIDRInput(e.target.value))}
            placeholder="0"
            className="w-full bg-transparent font-mono text-2xl font-bold text-slate-900 dark:text-slate-100 focus:outline-none placeholder-slate-400"
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
                className="text-xs font-mono font-semibold px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-95 transition-all shrink-0"
              >
                +{(v / 1000).toFixed(0)}rb
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Voice Note Card (Stitch Centered Style) */}
      <div className="neo-card p-5 flex flex-col items-center justify-center text-center gap-3 relative overflow-hidden group">
        <div className="absolute inset-0 bg-brand-500/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
        <button
          type="button"
          onClick={voiceState === "recording" ? stopRecording : startRecording}
          disabled={voiceState === "processing"}
          className={cn(
            "w-16 h-16 rounded-full flex items-center justify-center border-2 border-slate-900 shadow-[3px_3px_0px_0px_rgba(0,0,0,0.2)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all z-10",
            voiceState === "recording"
              ? "bg-rose-500 text-white animate-pulse"
              : voiceState === "processing"
                ? "bg-slate-300 text-slate-600"
                : "bg-brand-500 text-slate-950 hover:bg-brand-400",
          )}
          aria-label={voiceState === "recording" ? "Stop rekam" : "Rekam suara"}
        >
          {voiceState === "recording" ? (
            <Square className="w-6 h-6" fill="currentColor" />
          ) : voiceState === "processing" ? (
            <Loader2 className="w-6 h-6 animate-spin" />
          ) : (
            <Mic className="w-7 h-7" />
          )}
        </button>
        <div className="z-10 space-y-1">
          {voiceState === "recording" ? (
            <p className="font-mono text-xs font-bold text-rose-500 bg-rose-500/10 px-3 py-1 rounded-full border border-rose-500/30 inline-block">
              Merekam {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")} · Tap untuk selesai
            </p>
          ) : voiceState === "processing" ? (
            <p className="font-mono text-xs font-bold text-brand-600 dark:text-brand-400 bg-brand-500/10 px-3 py-1 rounded-full border border-brand-500/30 inline-block">
              Menganalisis suara dengan AI...
            </p>
          ) : (
            <>
              <p className="font-mono text-xs font-bold text-brand-600 dark:text-brand-400 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full border border-slate-200 dark:border-slate-700 inline-block">
                Catat Instan via Suara
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-[280px] mx-auto mt-1 leading-relaxed">
                Sebut belanjaan sekaligus, AI akan memisahkan kategori otomatis
              </p>
            </>
          )}
        </div>

        {transcript && voiceState === "idle" && savedExpenses.length === 0 && (
          <p className="text-xs text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-xl p-2.5 w-full border border-slate-200 dark:border-slate-700">
            Terdengar: <span className="font-semibold text-slate-900 dark:text-slate-100">&quot;{transcript}&quot;</span>
          </p>
        )}

        {savedExpenses.length > 0 && voiceState === "idle" && (
          <div className="space-y-2 w-full pt-1">
            {savedExpenses.length > 1 && (
              <div className="flex items-center justify-between px-1">
                <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" /> {savedExpenses.length} pengeluaran tersimpan
                </p>
                <button
                  type="button"
                  onClick={undoAll}
                  className="text-xs font-semibold text-rose-600 dark:text-rose-400 hover:underline"
                >
                  Batalkan semua
                </button>
              </div>
            )}
            {savedExpenses.map((s, i) => (
              <div
                key={s.id ?? i}
                className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 rounded-xl p-3 text-left space-y-1 shadow-sm"
              >
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <p className="text-xs text-slate-800 dark:text-slate-200 min-w-0 flex-1 truncate">
                    <span className="font-bold">{s.description}</span> ·{" "}
                    <span className="font-mono font-bold">{formatIDR(s.amount)}</span>
                    {s.categoryName && ` · ${s.categoryName}`}
                  </p>
                  <button
                    type="button"
                    onClick={() => undoSaved(s.id)}
                    className="text-xs font-bold text-rose-600 dark:text-rose-400 hover:underline shrink-0"
                  >
                    Batalkan
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        {voiceError && <p className="text-xs text-rose-600 dark:text-rose-400">{voiceError}</p>}
      </div>

      {/* Form Details */}
      <div className="neo-card p-4 space-y-4">
        {/* Description Input */}
        <div className="space-y-1.5">
          <Label htmlFor="description" className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Nama Kebutuhan
          </Label>
          <Input
            id="description"
            ref={descRef}
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Contoh: Makan siang Nasi Padang, Token PLN, dll"
            autoComplete="off"
            className="text-sm rounded-xl border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 focus-visible:ring-brand-500"
          />
        </div>

        {/* Categories (Frequent Chips + Full Grid) */}
        <div className="space-y-2">
          <Label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Kategori
          </Label>
          {topCategories.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold text-slate-400 mb-1.5">Sering Dipakai</p>
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

          <div className="pt-2">
            <p className="text-[11px] font-semibold text-slate-400 mb-1.5">Semua Kategori</p>
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
            <Label htmlFor="date" className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Tanggal
            </Label>
            <Input
              id="date"
              type="date"
              value={spentAt}
              onChange={(e) => setSpentAt(e.target.value)}
              className="w-full text-sm rounded-xl border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-mono"
            />
          </div>

          {activeEvents.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Event (Opsional)
              </Label>
              <select
                value={selectedEventId ?? ""}
                onChange={(e) => setSelectedEventId(e.target.value || null)}
                className="w-full h-10 px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
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
          <div className="p-3 bg-brand-500/10 border border-brand-500/30 rounded-xl space-y-2">
            <Label className="text-xs font-bold text-brand-700 dark:text-brand-300 uppercase tracking-wider flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5" /> Alokasikan ke Goal Tabungan
            </Label>
            <select
              value={goalId}
              onChange={(e) => setGoalId(e.target.value)}
              className="w-full h-10 px-3 py-2 text-sm rounded-xl border border-brand-500/30 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
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

      {error && <p className="text-sm font-semibold text-rose-600 dark:text-rose-400 px-1">{error}</p>}

      {/* Submit Button */}
      <Button
        type="submit"
        disabled={pending}
        className="w-full text-base py-6 bg-brand-600 text-white hover:bg-brand-700 dark:bg-brand-500 dark:text-slate-950 font-bold rounded-xl shadow-[3px_3px_0px_0px_rgba(0,0,0,0.2)] dark:shadow-[3px_3px_0px_0px_rgba(0,0,0,0.6)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all"
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
      </Button>
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
        "flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold border transition-all active:scale-95",
        full ? "w-full justify-start" : "",
        selected
          ? "bg-brand-500/15 dark:bg-brand-500/20 border-brand-500 text-brand-700 dark:text-brand-300 shadow-sm"
          : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700",
      )}
    >
      <div
        className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
        style={{ backgroundColor: `${category.color ?? "#16a34a"}20` }}
      >
        <Icon
          className="w-3.5 h-3.5"
          style={{ color: category.color ?? "#16a34a" }}
        />
      </div>
      <span className="truncate">{category.name}</span>
    </button>
  );
}

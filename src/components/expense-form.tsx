"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatIDR, formatIDRInput, parseIDRInput, todayISO } from "@/lib/format";
import type { Category, Goal } from "@/lib/types";
import { Check, Loader2, Calculator, Mic, Square, Sparkles, Target } from "lucide-react";
import { cn } from "@/lib/utils";

// A category counts as "savings" if its name mentions nabung/tabung.
function isSavingsCategory(name: string | undefined): boolean {
  if (!name) return false;
  return /nabung|tabung/i.test(name);
}

export function ExpenseForm({
  categories,
  topCategories,
  goals = [],
}: {
  categories: Category[];
  topCategories: Category[];
  goals?: Goal[];
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
  const [calcExpr, setCalcExpr] = useState("");
  const descRef = useRef<HTMLInputElement>(null);

  // Voice note state
  const [voiceState, setVoiceState] = useState<"idle" | "recording" | "processing">("idle");
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  type SavedExpense = {
    id?: string;
    description: string;
    amount: number;
    categoryName: string;
    goalName?: string | null;
    items: { name: string; price: number }[];
  };
  const [savedExpenses, setSavedExpenses] = useState<SavedExpense[]>([]);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    descRef.current?.focus();
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  function pickAudioMime(): string {
    const candidates = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/mp4",
      "audio/ogg;codecs=opus",
    ];
    if (typeof MediaRecorder === "undefined") return "";
    for (const c of candidates) {
      if (MediaRecorder.isTypeSupported(c)) return c;
    }
    return "";
  }

  async function startRecording() {
    setVoiceError(null);
    setTranscript(null);
    setSavedExpenses([]);
    if (!navigator.mediaDevices?.getUserMedia) {
      setVoiceError("Browser tidak mendukung rekaman suara.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = pickAudioMime();
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        if (timerRef.current) clearInterval(timerRef.current);
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || mime || "audio/webm" });
        await processAudio(blob);
      };
      rec.start();
      recorderRef.current = rec;
      setElapsed(0);
      setVoiceState("recording");
      timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
    } catch {
      setVoiceError("Mikrofon tidak bisa diakses. Cek izin mikrofon di browser.");
      setVoiceState("idle");
    }
  }

  function stopRecording() {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      setVoiceState("processing");
      recorderRef.current.stop();
    }
  }

  async function processAudio(blob: Blob) {
    try {
      const fd = new FormData();
      const ext = blob.type.includes("mp4") ? "m4a" : blob.type.includes("ogg") ? "ogg" : "webm";
      fd.append("audio", blob, `voice.${ext}`);
      const res = await fetch("/api/voice-expense", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setVoiceError(data.error || "Gagal memproses suara.");
        setVoiceState("idle");
        return;
      }

      setTranscript(data.transcript || null);

      type Group = {
        description: string;
        amount: number;
        category_id: string | null;
        category_name: string | null;
        goal_id: string | null;
        goal_name: string | null;
        items: { name: string; price: number }[];
      };
      const groups: Group[] = Array.isArray(data.groups) ? data.groups : [];

      // Groups siap di-post: punya kategori valid + nominal > 0
      const postable = groups.filter((g) => g.category_id && g.amount > 0);
      // Groups yang kategorinya gak kebaca (perlu dilengkapi manual)
      const incomplete = groups.filter((g) => !g.category_id && (g.description || g.amount > 0));

      if (postable.length > 0) {
        const saved: SavedExpense[] = [];
        for (const g of postable) {
          const { error: err, id } = await saveExpense({
            description: g.description,
            amount: g.amount,
            categoryId: g.category_id!,
            spentAt,
            goalId: g.goal_id,
          });
          if (!err) {
            saved.push({
              id,
              description: g.description,
              amount: g.amount,
              categoryName: g.category_name ?? "",
              goalName: g.goal_name,
              items: g.items ?? [],
            });
          }
        }
        setSavedExpenses(saved);
        setVoiceState("idle");
        startTransition(() => router.refresh());
        if (saved.length < postable.length) {
          setVoiceError("Sebagian gagal tersimpan, coba ulangi yang kurang.");
        } else if (incomplete.length > 0) {
          // Satu group kategorinya gak kebaca -> bantu isi ke form
          const g = incomplete[0];
          if (g.description) setDescription(g.description);
          if (g.amount > 0) setCostText(formatIDRInput(String(g.amount)));
          setVoiceError(`"${incomplete[0].description}" belum dapat kategori — lengkapi & simpan manual.`);
        }
        return;
      }

      // Tidak ada yang bisa di-post otomatis -> isi form dari group pertama
      const g0 = groups[0];
      if (g0?.description) setDescription(g0.description);
      if (g0 && g0.amount > 0) setCostText(formatIDRInput(String(g0.amount)));
      if (g0?.category_id) setCategoryId(g0.category_id);
      setVoiceError(
        g0 ? "Nominal/kategori belum kebaca jelas. Lengkapi & simpan manual." : "Suara kurang jelas, coba ulangi.",
      );
      setVoiceState("idle");
    } catch {
      setVoiceError("Gagal mengirim suara. Cek koneksi.");
      setVoiceState("idle");
    }
  }

  function calcPress(key: string) {
    if (key === "AC") { setCalcExpr(""); return; }
    if (key === "⌫") { setCalcExpr((e) => e.slice(0, -1)); return; }
    if (key === "=") {
      const clean = calcExpr.replace(/×/g, "*").replace(/÷/g, "/");
      if (!/^[\d\s+\-*/().]+$/.test(clean)) return;
      try {
        // eslint-disable-next-line no-new-func
        const result = Function('"use strict"; return (' + clean + ")")() as number;
        if (isFinite(result) && result >= 0) {
          setCostText(formatIDRInput(String(Math.round(result))));
          setCalcOpen(false);
          setCalcExpr("");
        }
      } catch { /* ignore bad expr */ }
      return;
    }
    setCalcExpr((e) => e + key);
  }

  async function saveExpense(payload: {
    description: string;
    amount: number;
    categoryId: string;
    spentAt: string;
    goalId?: string | null;
  }): Promise<{ error?: string; id?: string }> {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Belum login." };
    const { data: member } = await supabase
      .from("household_members")
      .select("household_id")
      .eq("user_id", user.id)
      .single();
    if (!member) return { error: "Household tidak ditemukan." };
    const { data, error } = await supabase
      .from("expenses")
      .insert({
        household_id: member.household_id,
        category_id: payload.categoryId,
        spent_at: payload.spentAt,
        description: payload.description.trim(),
        amount: payload.amount,
        goal_id: payload.goalId || null,
        created_by: user.id,
      })
      .select("id")
      .single();
    if (error) return { error: error.message };
    return { id: data?.id };
  }

  async function undoSaved(id?: string) {
    if (!id) return;
    const supabase = createClient();
    await supabase.from("expenses").delete().eq("id", id);
    setSavedExpenses((prev) => prev.filter((e) => e.id !== id));
    startTransition(() => router.refresh());
  }

  async function undoAll() {
    const ids = savedExpenses.map((e) => e.id).filter(Boolean) as string[];
    if (ids.length === 0) return;
    const supabase = createClient();
    await supabase.from("expenses").delete().in("id", ids);
    setSavedExpenses([]);
    startTransition(() => router.refresh());
  }

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
      description, amount, categoryId, spentAt, goalId: goalForSave,
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
      <div className="card bg-brand-50 border-brand-200 space-y-2">
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
                <p className="text-sm font-semibold text-red-600">
                  Merekam... {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")}
                </p>
                <p className="text-xs text-slate-500">Tap tombol stop kalau sudah selesai ngomong.</p>
              </>
            ) : voiceState === "processing" ? (
              <>
                <p className="text-sm font-semibold text-slate-700">Mendengarkan & menulis...</p>
                <p className="text-xs text-slate-500">Lagi diproses AI sebentar.</p>
              </>
            ) : (
              <>
                <p className="text-sm font-semibold text-brand-800 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" /> Catat pakai suara
                </p>
                <p className="text-xs text-slate-500">
                  Sebut beberapa item sekaligus — beda kategori otomatis jadi post terpisah.
                </p>
              </>
            )}
          </div>
        </div>
        {transcript && voiceState === "idle" && savedExpenses.length === 0 && (
          <p className="text-xs text-slate-500 bg-white/70 rounded-lg px-3 py-1.5">
            Terdengar: <span className="text-slate-700">&quot;{transcript}&quot;</span>
          </p>
        )}
        {savedExpenses.length > 0 && voiceState === "idle" && (
          <div className="space-y-1.5">
            {savedExpenses.length > 1 && (
              <div className="flex items-center justify-between px-1">
                <p className="text-xs font-semibold text-green-700 flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" /> {savedExpenses.length} pengeluaran tersimpan
                </p>
                <button
                  type="button"
                  onClick={undoAll}
                  className="text-xs font-medium text-red-600 hover:text-red-700"
                >
                  Batalkan semua
                </button>
              </div>
            )}
            {savedExpenses.map((s, i) => (
              <div
                key={s.id ?? i}
                className="bg-green-50 border border-green-200 rounded-lg px-3 py-2 space-y-1"
              >
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-green-600 shrink-0" />
                  <p className="text-xs text-slate-700 min-w-0 flex-1 truncate">
                    <span className="font-semibold">{s.description}</span> ·{" "}
                    <span className="font-semibold">{formatIDR(s.amount)}</span>
                    {s.categoryName && ` · ${s.categoryName}`}
                    {s.goalName && ` 🎯 ${s.goalName}`}
                  </p>
                  <button
                    type="button"
                    onClick={() => undoSaved(s.id)}
                    className="text-xs font-medium text-red-600 hover:text-red-700 shrink-0"
                  >
                    Batalkan
                  </button>
                </div>
                {s.items.length > 1 && (
                  <p className="text-[11px] text-slate-500 pl-6 leading-snug">
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
        {voiceError && <p className="text-xs text-red-600 px-1">{voiceError}</p>}
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
              onClick={() => { setCalcOpen((o) => !o); setCalcExpr(""); }}
              className={cn(
                "flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg transition",
                calcOpen
                  ? "bg-brand-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200",
              )}
            >
              <Calculator className="w-3.5 h-3.5" />
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
            <div className="mt-2 border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-3 py-2 bg-slate-50 border-b border-slate-100 text-right min-h-9 flex items-center justify-end">
                <span className="text-sm font-mono text-slate-600 truncate">
                  {calcExpr || "0"}
                </span>
              </div>
              <div className="grid grid-cols-4 gap-px bg-slate-100">
                {(["AC", "⌫", "÷", "×", "7", "8", "9", "-", "4", "5", "6", "+", "1", "2", "3", "=", "0", "00", "000", "."] as const).map(
                  (k) => (
                    <button
                      type="button"
                      key={k}
                      onClick={() => calcPress(k)}
                      className={cn(
                        "py-3.5 text-sm font-semibold bg-white hover:bg-slate-50 active:bg-slate-100 transition",
                        (k === "AC" || k === "⌫") && "text-red-500",
                        (k === "÷" || k === "×" || k === "-" || k === "+") &&
                          "text-brand-600",
                        k === "=" && "bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-800",
                      )}
                    >
                      {k}
                    </button>
                  ),
                )}
              </div>
            </div>
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
                  className="text-xs px-2.5 py-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200"
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
            <p className="text-xs text-slate-500 mb-2">Sering dipakai</p>
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
          <p className="text-xs text-slate-500 mb-2">Semua kategori</p>
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
      {isSavingsCategory(categories.find((c) => c.id === categoryId)?.name) && goals.length > 0 && (
        <div className="card space-y-2 border-brand-200 bg-brand-50/50">
          <label className="label flex items-center gap-1.5">
            <Target className="w-3.5 h-3.5 text-brand-600" /> Nabung buat goal? (opsional)
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setGoalId("")}
              className={cn(
                "px-3 py-2 rounded-xl text-sm border transition",
                goalId === ""
                  ? "bg-slate-700 border-slate-700 text-white font-medium"
                  : "bg-white border-slate-200 text-slate-600 hover:border-slate-300",
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
                    ? "bg-brand-50 border-brand-500 text-brand-700 font-medium"
                    : "bg-white border-slate-200 text-slate-700 hover:border-slate-300",
                )}
              >
                <span>{g.emoji}</span>
                <span className="truncate max-w-[8rem]">{g.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-600 px-1">{error}</p>}

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

      <p className="text-xs text-slate-500 text-center">
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
          ? "bg-brand-50 border-brand-500 text-brand-700 font-medium"
          : "bg-white border-slate-200 text-slate-700 hover:border-slate-300",
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

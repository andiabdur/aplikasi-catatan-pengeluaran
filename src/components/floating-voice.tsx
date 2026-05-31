"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Mic, MicOff, Loader2, Check, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type VoiceState = "idle" | "recording" | "processing";
type SavedExpense = {
  id?: string;
  description: string;
  amount: number;
  categoryName: string;
  items: { name: string; price: number }[];
};

function formatIDR(n: number) {
  return "Rp " + n.toLocaleString("id-ID");
}

function pickMime() {
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

export function FloatingVoice() {
  const pathname = usePathname();
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [savedExpenses, setSavedExpenses] = useState<SavedExpense[]>([]);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Voice is already on /add — don't double up
  if (pathname === "/add") return null;

  async function startRecording() {
    setError(null);
    setTranscript(null);
    setSavedExpenses([]);
    setShowResult(false);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Browser tidak mendukung rekaman.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = pickMime();
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        if (timerRef.current) clearInterval(timerRef.current);
        const blob = new Blob(chunksRef.current, {
          type: rec.mimeType || mime || "audio/webm",
        });
        await processAudio(blob);
      };
      rec.start();
      recorderRef.current = rec;
      setElapsed(0);
      setVoiceState("recording");
      timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
    } catch {
      setError("Mikrofon tidak bisa diakses. Cek izin browser.");
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
      const ext = blob.type.includes("mp4")
        ? "m4a"
        : blob.type.includes("ogg")
          ? "ogg"
          : "webm";
      fd.append("audio", blob, `voice.${ext}`);
      const res = await fetch("/api/voice-expense", { method: "POST", body: fd });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Gagal memproses suara.");
        setVoiceState("idle");
        setShowResult(true);
        return;
      }

      setTranscript(data.transcript || null);

      type Group = {
        description: string;
        amount: number;
        category_id: string | null;
        category_name: string | null;
        goal_id: string | null;
        items: { name: string; price: number }[];
      };
      const groups: Group[] = Array.isArray(data.groups) ? data.groups : [];
      const postable = groups.filter((g) => g.category_id && g.amount > 0);

      if (postable.length === 0) {
        setError(
          groups.length > 0
            ? "Nominal/kategori belum kebaca jelas. Coba lagi atau catat manual."
            : "Suara kurang jelas, coba ulangi.",
        );
        setVoiceState("idle");
        setShowResult(true);
        return;
      }

      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setError("Belum login.");
        setVoiceState("idle");
        setShowResult(true);
        return;
      }
      const { data: member } = await supabase
        .from("household_members")
        .select("household_id")
        .eq("user_id", user.id)
        .single();
      if (!member) {
        setError("Household tidak ditemukan.");
        setVoiceState("idle");
        setShowResult(true);
        return;
      }

      const today = new Date().toISOString().slice(0, 10);
      const saved: SavedExpense[] = [];
      for (const g of postable) {
        const { data: inserted } = await supabase
          .from("expenses")
          .insert({
            household_id: member.household_id,
            category_id: g.category_id,
            spent_at: today,
            description: g.description,
            amount: g.amount,
            goal_id: g.goal_id || null,
            created_by: user.id,
          })
          .select("id")
          .single();
        saved.push({
          id: inserted?.id,
          description: g.description,
          amount: g.amount,
          categoryName: g.category_name ?? "",
          items: g.items ?? [],
        });
      }

      setSavedExpenses(saved);
      setVoiceState("idle");
      setShowResult(true);
      startTransition(() => router.refresh());
    } catch {
      setError("Gagal mengirim suara. Cek koneksi.");
      setVoiceState("idle");
      setShowResult(true);
    }
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
    if (!ids.length) return;
    const supabase = createClient();
    await supabase.from("expenses").delete().in("id", ids);
    setSavedExpenses([]);
    startTransition(() => router.refresh());
  }

  function dismissResult() {
    setShowResult(false);
    setSavedExpenses([]);
    setError(null);
    setTranscript(null);
  }

  const elapsed_fmt = `${String(Math.floor(elapsed / 60)).padStart(2, "0")}:${String(elapsed % 60).padStart(2, "0")}`;

  return (
    <>
      {/* Result toast — appears above buttons */}
      {showResult && (
        <div className="fixed bottom-[14rem] inset-x-4 z-50 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="flex items-center justify-between px-3 pt-3 pb-2">
            <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              {savedExpenses.length > 0
                ? `${savedExpenses.length} pengeluaran tersimpan`
                : "Tidak terdeteksi"}
            </p>
            <div className="flex items-center gap-2">
              {savedExpenses.length > 1 && (
                <button
                  onClick={undoAll}
                  className="text-xs font-medium text-red-500 hover:text-red-600"
                >
                  Batalkan semua
                </button>
              )}
              <button
                onClick={dismissResult}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {transcript && savedExpenses.length === 0 && (
            <p className="px-3 pb-2 text-xs text-slate-500 dark:text-slate-400 italic">
              &ldquo;{transcript}&rdquo;
            </p>
          )}

          {savedExpenses.map((s, i) => (
            <div
              key={s.id ?? i}
              className="mx-3 mb-2 flex items-start gap-2 bg-green-50 dark:bg-green-900/20 rounded-xl px-2.5 py-2"
            >
              <Check className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                  {s.description}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {formatIDR(s.amount)}
                  {s.categoryName ? ` · ${s.categoryName}` : ""}
                </p>
                {s.items.length > 1 && (
                  <p className="text-[11px] text-slate-400 leading-snug mt-0.5">
                    {s.items.map((it) => `${it.name} ${formatIDR(it.price)}`).join(" + ")}
                  </p>
                )}
              </div>
              <button
                onClick={() => undoSaved(s.id)}
                className="text-xs font-medium text-red-500 hover:text-red-600 shrink-0"
              >
                Batalkan
              </button>
            </div>
          ))}

          {error && (
            <p className="px-3 pb-3 text-xs text-red-600 dark:text-red-400">{error}</p>
          )}
        </div>
      )}

      {/* Recording timer badge */}
      {voiceState === "recording" && (
        <div className="fixed bottom-[9.2rem] right-3 z-50 bg-red-500 text-white text-xs font-mono rounded-full px-2 py-0.5 shadow">
          {elapsed_fmt}
        </div>
      )}

      {/* Mic floating button */}
      <button
        onClick={
          voiceState === "recording"
            ? stopRecording
            : voiceState === "idle"
              ? startRecording
              : undefined
        }
        disabled={voiceState === "processing"}
        aria-label={
          voiceState === "recording" ? "Stop rekam" : "Rekam pengeluaran dengan suara"
        }
        className={`fixed bottom-[5.5rem] right-4 z-40 w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-transform active:scale-95 disabled:opacity-70 ${
          voiceState === "recording"
            ? "bg-red-500 shadow-red-500/40 animate-pulse"
            : voiceState === "processing"
              ? "bg-slate-500 shadow-slate-500/30 dark:bg-slate-600"
              : "bg-slate-800 shadow-slate-800/30 dark:bg-slate-600 dark:shadow-slate-900/50"
        }`}
      >
        {voiceState === "processing" ? (
          <Loader2 className="w-6 h-6 text-white animate-spin" />
        ) : voiceState === "recording" ? (
          <MicOff className="w-6 h-6 text-white" />
        ) : (
          <Mic className="w-6 h-6 text-white" />
        )}
      </button>
    </>
  );
}

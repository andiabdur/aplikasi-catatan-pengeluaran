"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Mic, Square, Loader2, MessageCircle, Check, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatIDR } from "@/lib/format";
import { cn } from "@/lib/utils";

type VoiceState = "idle" | "recording" | "processing";
type SavedExpense = {
  id?: string;
  description: string;
  amount: number;
  categoryName: string;
  items: { name: string; price: number }[];
};

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

export function HeaderQuickActions({ householdId }: { householdId?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [voiceExpenses, setVoiceExpenses] = useState<SavedExpense[]>([]);
  const [voiceTranscript, setVoiceTranscript] = useState<string | null>(null);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [showVoiceResult, setShowVoiceResult] = useState(false);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!showVoiceResult || voiceState !== "idle") return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        dismissVoiceResult();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showVoiceResult, voiceState]);

  const isAdd = pathname === "/add";
  const isAsisten = pathname === "/asisten";

  function dismissVoiceResult() {
    setShowVoiceResult(false);
    setVoiceExpenses([]);
    setVoiceError(null);
    setVoiceTranscript(null);
  }

  async function startRecording() {
    setVoiceError(null);
    setVoiceTranscript(null);
    setVoiceExpenses([]);
    setShowVoiceResult(false);
    if (!navigator.mediaDevices?.getUserMedia) {
      setVoiceError("Browser tidak mendukung rekaman suara.");
      setShowVoiceResult(true);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      const mime = pickMime();
      const rec = new MediaRecorder(
        stream,
        mime ? { mimeType: mime, audioBitsPerSecond: 128000 } : undefined,
      );
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
        await processVoice(blob);
      };
      rec.start();
      recorderRef.current = rec;
      setElapsed(0);
      setVoiceState("recording");
      timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
    } catch {
      setVoiceError("Mikrofon tidak bisa diakses. Cek izin browser.");
      setVoiceState("idle");
      setShowVoiceResult(true);
    }
  }

  function stopRecording() {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      setVoiceState("processing");
      recorderRef.current.stop();
    }
  }

  async function processVoice(blob: Blob) {
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
        setVoiceError(data.error || "Gagal memproses suara.");
        setVoiceState("idle");
        setShowVoiceResult(true);
        return;
      }
      setVoiceTranscript(data.transcript || null);
      type Group = {
        description: string;
        amount: number;
        category_id: string | null;
        category_name: string | null;
        goal_id: string | null;
        goal_name: string | null;
        event_id: string | null;
        event_name: string | null;
        items: { name: string; price: number }[];
      };
      const groups: Group[] = Array.isArray(data.groups) ? data.groups : [];
      const postable = groups.filter((g) => g.category_id && g.amount > 0);
      if (postable.length === 0) {
        setVoiceError(
          groups.length > 0
            ? "Nominal/kategori belum kebaca jelas. Coba lagi atau catat manual."
            : "Suara kurang jelas, coba ulangi.",
        );
        setVoiceState("idle");
        setShowVoiceResult(true);
        return;
      }
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setVoiceError("Belum login.");
        setVoiceState("idle");
        setShowVoiceResult(true);
        return;
      }
      const { data: member } = await supabase
        .from("household_members")
        .select("household_id")
        .eq("user_id", user.id)
        .single();
      if (!member) {
        setVoiceError("Household tidak ditemukan.");
        setVoiceState("idle");
        setShowVoiceResult(true);
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
            event_id: g.event_id || null,
            created_by: user.id,
          })
          .select("id")
          .single();
        saved.push({
          id: inserted?.id,
          description: g.description,
          amount: g.amount,
          categoryName:
            (g.category_name ?? "") + (g.event_name ? ` · Event: ${g.event_name}` : ""),
          items: g.items ?? [],
        });
      }
      setVoiceExpenses(saved);
      setVoiceState("idle");
      setShowVoiceResult(true);
      startTransition(() => router.refresh());
    } catch {
      setVoiceError("Gagal mengirim suara. Cek koneksi.");
      setVoiceState("idle");
      setShowVoiceResult(true);
    }
  }

  async function undoVoice(id?: string) {
    if (!id) return;
    const supabase = createClient();
    await supabase.from("expenses").delete().eq("id", id);
    setVoiceExpenses((prev) => prev.filter((e) => e.id !== id));
    startTransition(() => router.refresh());
  }

  const elapsedFmt = `${String(Math.floor(elapsed / 60)).padStart(2, "0")}:${String(
    elapsed % 60,
  ).padStart(2, "0")}`;

  const showTopStrip = voiceState !== "idle" || showVoiceResult;

  return (
    <>
      {/* Inline Header Buttons (Zero floating obstructions) */}
      {!isAdd && (
        <button
          type="button"
          onClick={
            voiceState === "recording"
              ? stopRecording
              : voiceState === "idle"
                ? startRecording
                : undefined
          }
          disabled={voiceState === "processing"}
          aria-label={
            voiceState === "recording"
              ? "Stop rekam suara"
              : "Rekam pengeluaran dengan suara"
          }
          title={voiceState === "recording" ? "Stop rekam" : "Catat via suara"}
          className={cn(
            "w-10 h-10 rounded-none flex items-center justify-center border-2 border-slate-950 dark:border-slate-100 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,1)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:opacity-70",
            voiceState === "recording"
              ? "bg-rose-500 text-white"
              : voiceState === "processing"
                ? "bg-amber-400 text-slate-950"
                : "bg-white dark:bg-surface-dark text-slate-950 dark:text-slate-100 hover:bg-slate-950 hover:text-white dark:hover:bg-slate-100 dark:hover:text-slate-950",
          )}
        >
          {voiceState === "processing" ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : voiceState === "recording" ? (
            <Square className="w-4 h-4" fill="currentColor" />
          ) : (
            <Mic className="w-4 h-4" />
          )}
        </button>
      )}

      {!isAsisten && householdId && (
        <Link
          href="/asisten?tab=chat"
          aria-label="Buka Chat Asisten AI"
          title="Chat AI"
          className="w-10 h-10 rounded-none bg-brand-500 text-slate-950 hover:bg-brand-400 border-2 border-slate-950 dark:border-slate-100 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,1)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none flex items-center justify-center shrink-0 transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        >
          <MessageCircle className="w-4 h-4" />
        </Link>
      )}

      {/* Dynamic Top Voice Status Strip (Muncul hanya saat aktif / ada hasil) */}
      {showTopStrip && (
        <div className="fixed top-[68px] inset-x-0 z-40 px-4 pt-2 pointer-events-none">
          <div className="mx-auto max-w-md pointer-events-auto bg-white dark:bg-surface-dark border-4 border-slate-950 dark:border-slate-100 p-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)] space-y-2">
            {voiceState === "recording" && (
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="inline-block w-2.5 h-2.5 bg-rose-500 animate-pulse shrink-0" />
                    <span className="font-mono text-xs font-bold uppercase text-rose-600 dark:text-rose-400">
                      Merekam {elapsedFmt}
                    </span>
                  </div>
                  <p className="text-[11px] font-headline font-bold text-slate-700 dark:text-slate-300 uppercase mt-0.5">
                    Merekam pengeluaran...
                  </p>
                </div>
                <button
                  type="button"
                  onClick={stopRecording}
                  className="min-h-[40px] px-3 bg-rose-500 text-white border-2 border-slate-950 dark:border-slate-100 font-headline font-black text-xs uppercase flex items-center gap-1.5 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none shrink-0"
                >
                  <Square className="w-3.5 h-3.5" fill="currentColor" />
                  Stop
                </button>
              </div>
            )}

            {voiceState === "processing" && (
              <div className="flex items-center gap-2.5 py-1">
                <Loader2 className="w-4 h-4 animate-spin text-brand-600 dark:text-brand-400 shrink-0" />
                <p className="text-xs font-mono font-bold uppercase text-slate-950 dark:text-slate-100">
                  Menganalisis suara dengan AI...
                </p>
              </div>
            )}

            {voiceState === "idle" && showVoiceResult && (
              <div className="space-y-2">
                <div className="flex items-center justify-between pb-1.5 border-b-2 border-slate-950 dark:border-slate-100">
                  <p className="text-xs font-headline font-bold uppercase tracking-wider text-slate-950 dark:text-slate-100">
                    {voiceExpenses.length > 0
                      ? `${voiceExpenses.length} Pengeluaran Tersimpan`
                      : "Tidak Terdeteksi"}
                  </p>
                  <button
                    type="button"
                    onClick={dismissVoiceResult}
                    aria-label="Tutup hasil suara"
                    className="min-h-[34px] min-w-[34px] flex items-center justify-center border border-slate-950 dark:border-slate-100 text-slate-950 dark:text-slate-100 hover:bg-slate-950 hover:text-white dark:hover:bg-slate-100 dark:hover:text-slate-950"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {voiceTranscript && voiceExpenses.length === 0 && (
                  <p className="text-xs text-slate-600 dark:text-slate-300 font-mono">
                    &ldquo;{voiceTranscript}&rdquo;
                  </p>
                )}

                {voiceExpenses.map((s, i) => (
                  <div
                    key={s.id ?? i}
                    className="flex items-start gap-2.5 bg-emerald-100 dark:bg-emerald-950/60 border-2 border-slate-950 dark:border-slate-100 p-2.5 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                  >
                    <Check className="w-4 h-4 text-emerald-800 dark:text-emerald-300 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-headline font-bold uppercase text-slate-950 dark:text-slate-100 whitespace-normal break-words leading-snug">
                        {s.description}
                      </p>
                      <p className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                        {formatIDR(s.amount)}
                        {s.categoryName ? ` · ${s.categoryName}` : ""}
                      </p>
                      {s.items.length > 1 && (
                        <p className="text-[10px] font-mono text-slate-500 leading-snug mt-0.5">
                          {s.items.map((it) => `${it.name} ${formatIDR(it.price)}`).join(" + ")}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => undoVoice(s.id)}
                      className="text-xs font-mono font-bold text-rose-600 dark:text-rose-400 hover:underline shrink-0 uppercase px-1 py-0.5"
                    >
                      Batalkan
                    </button>
                  </div>
                ))}

                {voiceError && (
                  <p className="text-xs font-mono font-bold text-rose-700 dark:text-rose-300 bg-rose-100 dark:bg-rose-950/50 p-2 border-2 border-rose-600 uppercase">
                    {voiceError}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

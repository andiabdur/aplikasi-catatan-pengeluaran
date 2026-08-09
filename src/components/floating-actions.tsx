"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Plus,
  X,
  MessageCircle,
  Camera,
  Mic,
  MicOff,
  Loader2,
  Check,
  Sparkles,
  ScanLine,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { FinancialChat } from "./financial-chat";

// ─── Types ────────────────────────────────────────────────────────────────────
type VoiceState = "idle" | "recording" | "processing";
type ProcessState = "idle" | "processing";
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

// ─── Main Component ───────────────────────────────────────────────────────────
export function FloatingActions({ householdId }: { householdId?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [, startTransition] = useTransition();

  // FAB state
  const [fabOpen, setFabOpen] = useState(false);

  // Chat drawer state
  const [chatOpen, setChatOpen] = useState(false);

  // ── Voice state ──────────────────────────────────────────────────────────
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [voiceExpenses, setVoiceExpenses] = useState<SavedExpense[]>([]);
  const [voiceTranscript, setVoiceTranscript] = useState<string | null>(null);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [showVoiceResult, setShowVoiceResult] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Receipt state ────────────────────────────────────────────────────────
  const fileRef = useRef<HTMLInputElement>(null);
  const [receiptState, setReceiptState] = useState<ProcessState>("idle");
  const [preview, setPreview] = useState<string | null>(null);
  const [receiptExpenses, setReceiptExpenses] = useState<SavedExpense[]>([]);
  const [merchant, setMerchant] = useState("");
  const [receiptError, setReceiptError] = useState<string | null>(null);
  const [showReceiptResult, setShowReceiptResult] = useState(false);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Don't render on /add (already has dedicated UI) or /asisten (has its own chat)
  const isAdd = pathname === "/add";
  const isAsisten = pathname === "/asisten";

  // ── Voice functions ──────────────────────────────────────────────────────
  async function startRecording() {
    setVoiceError(null);
    setVoiceTranscript(null);
    setVoiceExpenses([]);
    setShowVoiceResult(false);
    setFabOpen(false);
    if (!navigator.mediaDevices?.getUserMedia) {
      setVoiceError("Browser tidak mendukung rekaman.");
      setShowVoiceResult(true);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      const mime = pickMime();
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime, audioBitsPerSecond: 128000 } : undefined);
      chunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        if (timerRef.current) clearInterval(timerRef.current);
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || mime || "audio/webm" });
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
      const ext = blob.type.includes("mp4") ? "m4a" : blob.type.includes("ogg") ? "ogg" : "webm";
      fd.append("audio", blob, `voice.${ext}`);
      const res = await fetch("/api/voice-expense", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) { setVoiceError(data.error || "Gagal memproses suara."); setVoiceState("idle"); setShowVoiceResult(true); return; }
      setVoiceTranscript(data.transcript || null);
      type Group = { description: string; amount: number; category_id: string | null; category_name: string | null; goal_id: string | null; goal_name: string | null; event_id: string | null; event_name: string | null; items: { name: string; price: number }[] };
      const groups: Group[] = Array.isArray(data.groups) ? data.groups : [];
      const postable = groups.filter((g) => g.category_id && g.amount > 0);
      if (postable.length === 0) { setVoiceError(groups.length > 0 ? "Nominal/kategori belum kebaca jelas. Coba lagi atau catat manual." : "Suara kurang jelas, coba ulangi."); setVoiceState("idle"); setShowVoiceResult(true); return; }
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setVoiceError("Belum login."); setVoiceState("idle"); setShowVoiceResult(true); return; }
      const { data: member } = await supabase.from("household_members").select("household_id").eq("user_id", user.id).single();
      if (!member) { setVoiceError("Household tidak ditemukan."); setVoiceState("idle"); setShowVoiceResult(true); return; }
      const today = new Date().toISOString().slice(0, 10);
      const saved: SavedExpense[] = [];
      for (const g of postable) {
        const { data: inserted } = await supabase.from("expenses").insert({ household_id: member.household_id, category_id: g.category_id, spent_at: today, description: g.description, amount: g.amount, goal_id: g.goal_id || null, event_id: g.event_id || null, created_by: user.id }).select("id").single();
        saved.push({ id: inserted?.id, description: g.description, amount: g.amount, categoryName: (g.category_name ?? "") + (g.event_name ? ` · Event: ${g.event_name}` : ""), items: g.items ?? [] });
      }
      setVoiceExpenses(saved);
      setVoiceState("idle");
      setShowVoiceResult(true);
      startTransition(() => router.refresh());
    } catch { setVoiceError("Gagal mengirim suara. Cek koneksi."); setVoiceState("idle"); setShowVoiceResult(true); }
  }

  async function undoVoice(id?: string) {
    if (!id) return;
    const supabase = createClient();
    await supabase.from("expenses").delete().eq("id", id);
    setVoiceExpenses((prev) => prev.filter((e) => e.id !== id));
    startTransition(() => router.refresh());
  }

  // ── Receipt functions ────────────────────────────────────────────────────
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
    processReceipt(file);
    e.target.value = "";
  }

  async function processReceipt(file: File) {
    setReceiptState("processing");
    setReceiptError(null);
    setReceiptExpenses([]);
    setShowReceiptResult(false);
    setFabOpen(false);
    try {
      const fd = new FormData();
      fd.append("image", file, file.name);
      const res = await fetch("/api/receipt-expense", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) { setReceiptError(data.error || "Gagal membaca struk."); setShowReceiptResult(true); setReceiptState("idle"); return; }
      type Group = { description: string; amount: number; category_id: string | null; category_name: string | null; goal_id: string | null; goal_name: string | null; event_id: string | null; event_name: string | null; items: { name: string; price: number }[]; date?: string };
      const groups: Group[] = Array.isArray(data.groups) ? data.groups : [];
      const spentAt = data.date || new Date().toISOString().slice(0, 10);
      setMerchant(data.merchant || "");
      const postable = groups.filter((g) => g.category_id && g.amount > 0);
      if (postable.length === 0) { setReceiptError(groups.length > 0 ? "Ada item terbaca tapi kategori tidak cocok." : "Struk tidak terbaca. Pastikan foto jelas."); setShowReceiptResult(true); setReceiptState("idle"); return; }
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setReceiptError("Belum login."); setReceiptState("idle"); return; }
      const { data: member } = await supabase.from("household_members").select("household_id").eq("user_id", user.id).single();
      if (!member) { setReceiptError("Household tidak ditemukan."); setReceiptState("idle"); return; }
      const saved: SavedExpense[] = [];
      for (const g of postable) {
        const { data: inserted } = await supabase.from("expenses").insert({ household_id: member.household_id, category_id: g.category_id, spent_at: spentAt, description: g.description, amount: g.amount, goal_id: g.goal_id || null, event_id: g.event_id || null, created_by: user.id }).select("id").single();
        saved.push({ id: inserted?.id, description: g.description, amount: g.amount, categoryName: (g.category_name ?? "") + (g.event_name ? ` · Event: ${g.event_name}` : ""), items: g.items ?? [] });
      }
      setReceiptExpenses(saved);
      setShowReceiptResult(true);
      setReceiptState("idle");
      startTransition(() => router.refresh());
    } catch { setReceiptError("Gagal memproses. Cek koneksi."); setShowReceiptResult(true); setReceiptState("idle"); }
  }

  async function undoReceipt(id?: string) {
    if (!id) return;
    const supabase = createClient();
    await supabase.from("expenses").delete().eq("id", id);
    setReceiptExpenses((prev) => prev.filter((e) => e.id !== id));
    startTransition(() => router.refresh());
  }

  const elapsedFmt = `${String(Math.floor(elapsed / 60)).padStart(2, "0")}:${String(elapsed % 60).padStart(2, "0")}`;
  const isBusy = voiceState !== "idle" || receiptState !== "idle";

  return (
    <>
      {/* ── Hidden file input for receipt ── */}
      <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileChange} />

      {/* ── Voice result toast ── */}
      {showVoiceResult && (
        <div className="fixed bottom-32 inset-x-4 z-50 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="flex items-center justify-between px-3 pt-3 pb-2">
            <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              {voiceExpenses.length > 0 ? `${voiceExpenses.length} pengeluaran tersimpan` : "Tidak terdeteksi"}
            </p>
            <button onClick={() => { setShowVoiceResult(false); setVoiceExpenses([]); setVoiceError(null); setVoiceTranscript(null); }} className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700">
              <X className="w-4 h-4" />
            </button>
          </div>
          {voiceTranscript && voiceExpenses.length === 0 && (
            <p className="px-3 pb-2 text-xs text-slate-500 dark:text-slate-400 italic">&ldquo;{voiceTranscript}&rdquo;</p>
          )}
          {voiceExpenses.map((s, i) => (
            <div key={s.id ?? i} className="mx-3 mb-2 flex items-start gap-2 bg-green-50 dark:bg-green-900/20 rounded-xl px-2.5 py-2">
              <Check className="w-4 h-4 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">{s.description}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{formatIDR(s.amount)}{s.categoryName ? ` · ${s.categoryName}` : ""}</p>
                {s.items.length > 1 && <p className="text-[11px] text-slate-400 leading-snug mt-0.5">{s.items.map((it) => `${it.name} ${formatIDR(it.price)}`).join(" + ")}</p>}
              </div>
              <button onClick={() => undoVoice(s.id)} className="text-xs font-medium text-red-500 hover:text-red-600 shrink-0">Batalkan</button>
            </div>
          ))}
          {voiceError && <p className="px-3 pb-3 text-xs text-red-600 dark:text-red-400">{voiceError}</p>}
        </div>
      )}

      {/* ── Receipt result toast ── */}
      {showReceiptResult && (
        <div className="fixed bottom-32 inset-x-4 z-50 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="flex items-center justify-between px-3 pt-3 pb-2">
            <div className="flex items-center gap-2">
              {preview && <img src={preview} alt="struk" className="w-8 h-8 rounded-lg object-cover border border-slate-200 dark:border-slate-600" />}
              <div>
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                  {receiptExpenses.length > 0 ? `${receiptExpenses.length} pengeluaran tersimpan` : "Tidak terdeteksi"}
                </p>
                {merchant && <p className="text-[11px] text-slate-400">{merchant}</p>}
              </div>
            </div>
            <button onClick={() => { setShowReceiptResult(false); setReceiptExpenses([]); setReceiptError(null); setPreview(null); setMerchant(""); }} className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="px-3 pb-3 space-y-1.5">
            {receiptExpenses.map((s, i) => (
              <div key={s.id ?? i} className="flex items-start gap-2 bg-green-50 dark:bg-green-900/20 rounded-xl px-2.5 py-2">
                <Check className="w-4 h-4 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">{s.description}</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">{formatIDR(s.amount)} · {s.categoryName}</p>
                  {s.items.length > 1 && <p className="text-[11px] text-slate-400 leading-snug mt-0.5">{s.items.map((it) => `${it.name} ${formatIDR(it.price)}`).join(" + ")}</p>}
                </div>
                <button onClick={() => undoReceipt(s.id)} className="p-1 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition shrink-0">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            {receiptError && <p className="text-xs text-red-600 dark:text-red-400 px-1">{receiptError}</p>}
          </div>
        </div>
      )}

      {/* ── Voice recording timer badge ── */}
      {voiceState === "recording" && (
        <div className="fixed bottom-[7.5rem] right-[4.75rem] z-50 bg-red-500 text-white text-xs font-mono rounded-full px-2 py-0.5 shadow pointer-events-none">
          {elapsedFmt}
        </div>
      )}

      {/* ── Receipt scanning badge ── */}
      {receiptState === "processing" && (
        <div className="fixed bottom-[7.5rem] right-[4.75rem] z-50 bg-amber-500 text-white text-xs rounded-full px-2 py-0.5 shadow flex items-center gap-1 pointer-events-none">
          <ScanLine className="w-3 h-3" /> Membaca...
        </div>
      )}

      {/* ── Speed Dial Action Buttons (appear when FAB open) ── */}
      {/* Mic button */}
      {!isAdd && (
        <button
          onClick={voiceState === "recording" ? stopRecording : voiceState === "idle" ? startRecording : undefined}
          disabled={voiceState === "processing"}
          aria-label={voiceState === "recording" ? "Stop rekam" : "Rekam pengeluaran dengan suara"}
          style={{ bottom: "9.5rem", right: "1rem", transitionDelay: fabOpen ? "60ms" : "0ms" }}
          className={`fixed z-40 w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-all duration-200 active:scale-95 disabled:opacity-70 ${
            fabOpen || voiceState !== "idle"
              ? "opacity-100 translate-y-0 pointer-events-auto"
              : "opacity-0 translate-y-4 pointer-events-none"
          } ${
            voiceState === "recording"
              ? "bg-red-500 shadow-red-500/40 animate-pulse"
              : voiceState === "processing"
              ? "bg-slate-500 shadow-slate-500/30 dark:bg-slate-600"
              : "bg-slate-700 shadow-slate-700/30 dark:bg-slate-600"
          }`}
        >
          {voiceState === "processing" ? (
            <Loader2 className="w-5 h-5 text-white animate-spin" />
          ) : voiceState === "recording" ? (
            <MicOff className="w-5 h-5 text-white" />
          ) : (
            <Mic className="w-5 h-5 text-white" />
          )}
        </button>
      )}

      {/* Camera / Receipt button */}
      {!isAdd && (
        <button
          onClick={() => { if (receiptState === "idle") { fileRef.current?.click(); } }}
          disabled={receiptState === "processing"}
          aria-label="Foto struk pengeluaran"
          style={{ bottom: "13.5rem", right: "1rem", transitionDelay: fabOpen ? "30ms" : "0ms" }}
          className={`fixed z-40 w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-all duration-200 active:scale-95 disabled:opacity-70 ${
            fabOpen || receiptState !== "idle"
              ? "opacity-100 translate-y-0 pointer-events-auto"
              : "opacity-0 translate-y-4 pointer-events-none"
          } ${
            receiptState === "processing"
              ? "bg-amber-500 shadow-amber-500/40"
              : "bg-slate-600 shadow-slate-600/30 dark:bg-slate-500"
          }`}
        >
          {receiptState === "processing" ? (
            <Loader2 className="w-5 h-5 text-white animate-spin" />
          ) : (
            <Camera className="w-5 h-5 text-white" />
          )}
        </button>
      )}

      {/* Chat button */}
      {!isAsisten && householdId && !chatOpen && (
        <button
          onClick={() => { setChatOpen(true); setFabOpen(false); }}
          aria-label="Chat dengan asisten keuangan"
          style={{ bottom: "17.5rem", right: "1rem", transitionDelay: fabOpen ? "0ms" : "0ms" }}
          className={`fixed z-40 w-12 h-12 rounded-full bg-brand-600 text-white shadow-lg shadow-brand-600/40 flex items-center justify-center active:scale-95 transition-all duration-200 ${
            fabOpen
              ? "opacity-100 translate-y-0 pointer-events-auto"
              : "opacity-0 translate-y-4 pointer-events-none"
          }`}
        >
          <MessageCircle className="w-5 h-5" />
        </button>
      )}

      {/* ── Labels next to action buttons ── */}
      {fabOpen && !isAdd && (
        <>
          <span
            style={{ bottom: "10.9rem", right: "5rem" }}
            className="fixed z-40 bg-slate-900/80 dark:bg-slate-700 text-white text-[11px] font-medium px-2.5 py-1 rounded-full pointer-events-none shadow-md backdrop-blur-sm"
          >
            {voiceState === "recording" ? "Tap stop" : "Suara"}
          </span>
          <span
            style={{ bottom: "14.9rem", right: "5rem" }}
            className="fixed z-40 bg-slate-900/80 dark:bg-slate-700 text-white text-[11px] font-medium px-2.5 py-1 rounded-full pointer-events-none shadow-md backdrop-blur-sm"
          >
            Foto Struk
          </span>
          {!isAsisten && householdId && (
            <span
              style={{ bottom: "18.9rem", right: "5rem" }}
              className="fixed z-40 bg-slate-900/80 dark:bg-slate-700 text-white text-[11px] font-medium px-2.5 py-1 rounded-full pointer-events-none shadow-md backdrop-blur-sm"
            >
              AI Chat
            </span>
          )}
        </>
      )}

      {/* ── FAB toggle button (main) ── */}
      {!chatOpen && (
        <button
          onClick={() => {
            if (isBusy) return;
            setFabOpen((v) => !v);
          }}
          aria-label={fabOpen ? "Tutup menu" : "Buka menu aksi cepat"}
          className={`fixed bottom-[5.5rem] right-4 z-40 w-14 h-14 rounded-full flex items-center justify-center shadow-xl transition-all duration-300 active:scale-95 ${
            fabOpen
              ? "bg-slate-800 dark:bg-slate-600 shadow-slate-900/40 rotate-45"
              : isBusy
              ? voiceState === "recording"
                ? "bg-red-500 shadow-red-500/40 animate-pulse"
                : "bg-amber-500 shadow-amber-500/40"
              : "bg-brand-600 shadow-brand-600/40"
          }`}
        >
          {voiceState === "recording" ? (
            <MicOff className="w-6 h-6 text-white" />
          ) : voiceState === "processing" || receiptState === "processing" ? (
            <Loader2 className="w-6 h-6 text-white animate-spin" />
          ) : (
            <Plus className={`w-6 h-6 text-white transition-transform duration-300 ${fabOpen ? "rotate-45" : ""}`} />
          )}
        </button>
      )}

      {/* ── Backdrop to close FAB ── */}
      {fabOpen && (
        <div
          className="fixed inset-0 z-30"
          onClick={() => setFabOpen(false)}
        />
      )}

      {/* ── Chat Drawer ── */}
      {!isAsisten && householdId && (
        <>
          {chatOpen && (
            <div
              className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
              onClick={() => setChatOpen(false)}
            />
          )}
          <div
            className={`fixed inset-x-0 bottom-0 z-50 bg-white dark:bg-slate-900 rounded-t-3xl shadow-2xl transition-transform duration-300 ease-out ${
              chatOpen ? "translate-y-0" : "translate-y-full"
            }`}
            style={{ maxHeight: "85dvh" }}
          >
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-slate-200 dark:bg-slate-700" />
            </div>
            <div className="flex items-center justify-between px-4 pt-2 pb-3 border-b border-slate-100 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-brand-100 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 flex items-center justify-center">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <p className="font-semibold text-slate-800 dark:text-slate-100 text-sm">Asisten Keuangan</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500">AI · data keuangan real-time</p>
                </div>
              </div>
              <button
                onClick={() => setChatOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto" style={{ maxHeight: "calc(85dvh - 80px)" }}>
              <FinancialChat householdId={householdId} />
            </div>
          </div>
        </>
      )}
    </>
  );
}

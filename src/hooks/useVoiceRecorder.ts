import { useState, useRef, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatIDR, formatIDRInput, parseIDRInput } from "@/lib/format";

export type SavedExpense = {
  id?: string;
  description: string;
  amount: number;
  categoryName: string;
  goalName?: string | null;
  items: { name: string; price: number }[];
};

export type VoiceRecorderProps = {
  spentAt: string;
  setDescription: (desc: string) => void;
  setCostText: (cost: string) => void;
  setCategoryId: (id: string) => void;
  speakFeedback: (text: string) => void;
  unlockSpeech: () => void;
};

export function useVoiceRecorder({
  spentAt,
  setDescription,
  setCostText,
  setCategoryId,
  speakFeedback,
  unlockSpeech,
}: VoiceRecorderProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [voiceState, setVoiceState] = useState<"idle" | "recording" | "processing">("idle");
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [savedExpenses, setSavedExpenses] = useState<SavedExpense[]>([]);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  async function saveExpense(payload: {
    description: string;
    amount: number;
    categoryId: string;
    spentAt: string;
    goalId?: string | null;
    eventId?: string | null;
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
        event_id: payload.eventId || null,
        created_by: user.id,
      })
      .select("id")
      .single();
    if (error) return { error: error.message };
    return { id: data?.id };
  }

  async function startRecording() {
    unlockSpeech();
    setVoiceError(null);
    setTranscript(null);
    setSavedExpenses([]);
    if (!navigator.mediaDevices?.getUserMedia) {
      setVoiceError("Browser tidak mendukung rekaman suara.");
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
      const mime = pickAudioMime();
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

      const postable = groups.filter((g) => g.category_id && g.amount > 0);
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

        if (saved.length > 0) {
          const total = saved.reduce((s, e) => s + e.amount, 0);
          if (saved.length === 1) {
            const s = saved[0];
            const cost = formatIDR(s.amount).replace("Rp ", "");
            const goal = s.goalName ? ", goal " + s.goalName : "";
            speakFeedback("Oke udah dicatat, " + s.description + " seharga " + cost + " di kategori " + s.categoryName + goal);
          } else {
            speakFeedback("Oke udah dicatat " + saved.length + " pengeluaran, total " + formatIDR(total).replace("Rp ", ""));
          }
        }

        if (saved.length < postable.length) {
          setVoiceError("Sebagian gagal tersimpan, coba ulangi yang kurang.");
        } else if (incomplete.length > 0) {
          const g = incomplete[0];
          if (g.description) setDescription(g.description);
          if (g.amount > 0) setCostText(formatIDRInput(String(g.amount)));
          setVoiceError(`"${incomplete[0].description}" belum dapat kategori — lengkapi & simpan manual.`);
        }
        return;
      }

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

  return {
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
  };
}

"use client";

import { useEffect, useRef, useState } from "react";
import {
  Send,
  Loader2,
  Trash2,
  Check,
  X,
  Volume2,
  VolumeX,
  Plus,
  Brain,
  Clock,
  Pencil,
  Menu,
  ArrowUp,
  MessageCircle,
  Copy,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { MarkdownLite } from "@/components/markdown-lite";
import { useChatContext } from "@/contexts/chat-context";
import { formatIDR } from "@/lib/format";

const SUGGESTIONS = [
  "Berapa total pengeluaran periode ini?",
  "Kategori mana yang paling boros?",
  "Gimana cara nabung lebih cepat?",
  "Kasih saran budget bulan depan.",
];

export function FinancialChat({ householdId }: { householdId: string }) {
  const {
    sessions,
    activeSessionId,
    activeTitle,
    messages,
    loading,
    loadingHistory,
    hasMoreHistory,
    loadingMoreHistory,
    memories,
    error,
    setHouseholdId,
    send,
    createNewSession,
    selectSession,
    deleteCurrentSession,
    loadOlderMessages,
    deleteMemory,
    saveEditedMemory,
    addManualMemory,
    undoExpense,
  } = useChatContext();

  useEffect(() => {
    if (householdId) {
      setHouseholdId(householdId);
    }
  }, [householdId, setHouseholdId]);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showMemoryModal, setShowMemoryModal] = useState(false);
  const [editingMemoryId, setEditingMemoryId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState("");
  const [showAddMemoryForm, setShowAddMemoryForm] = useState(false);
  const [newMemoryContent, setNewMemoryContent] = useState("");
  const [input, setInput] = useState("");
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingIndex, setPlayingIndex] = useState<number | null>(null);
  const [speakingIndex, setSpeakingIndex] = useState<number | null>(null);

  useEffect(() => {
    return () => {
      if (audioRef.current) audioRef.current.pause();
    };
  }, []);

  useEffect(() => {
    if (!sidebarOpen && !showMemoryModal) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setSidebarOpen(false);
        setShowMemoryModal(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [sidebarOpen, showMemoryModal]);

  useEffect(() => {
    if (loadingHistory || loadingMoreHistory) return;
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages.length, loading, loadingHistory, loadingMoreHistory]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    function handleScroll() {
      if (!el) return;
      if (el.scrollTop <= 20 && hasMoreHistory && !loadingMoreHistory && !loadingHistory) {
        loadOlderMessages();
      }
    }
    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, [hasMoreHistory, loadingMoreHistory, loadingHistory, loadOlderMessages]);

  async function speak(text: string, index: number) {
    const isBrowserTTSAvailable = typeof window !== "undefined" && !!window.speechSynthesis;
    if (playingIndex === index) {
      if (audioRef.current) audioRef.current.pause();
      if (isBrowserTTSAvailable) window.speechSynthesis.cancel();
      setPlayingIndex(null);
      return;
    }
    if (audioRef.current) audioRef.current.pause();
    if (isBrowserTTSAvailable) window.speechSynthesis.cancel();
    setPlayingIndex(null);
    setSpeakingIndex(index);

    const plainText = text
      .replace(/```[\s\S]*?```/g, "")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/\*([^*]+)\*/g, "$1")
      .replace(/[\n\r]+/g, " ")
      .trim();

    const triggerBrowserFallback = () => {
      if (!isBrowserTTSAvailable) {
        setSpeakingIndex(null);
        setPlayingIndex(null);
        return;
      }
      try {
        const utterance = new SpeechSynthesisUtterance(plainText);
        utterance.lang = "id-ID";
        utterance.onstart = () => {
          setPlayingIndex(index);
          setSpeakingIndex(null);
        };
        utterance.onend = () => setPlayingIndex(null);
        utterance.onerror = () => {
          setPlayingIndex(null);
          setSpeakingIndex(null);
        };
        window.speechSynthesis.speak(utterance);
      } catch {
        setSpeakingIndex(null);
        setPlayingIndex(null);
      }
    };

    try {
      const res = await fetch("/api/text-to-speech", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: plainText }),
      });
      if (!res.ok) {
        triggerBrowserFallback();
        return;
      }
      const audioBlob = await res.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      audio.onended = () => {
        setPlayingIndex(null);
        URL.revokeObjectURL(audioUrl);
      };
      audio.onplay = () => {
        setPlayingIndex(index);
        setSpeakingIndex(null);
      };
      await audio.play();
    } catch {
      triggerBrowserFallback();
    }
  }

  async function handleCopyMessage(text: string, index: number) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIndex(index);
      setTimeout(() => {
        setCopiedIndex((prev) => (prev === index ? null : prev));
      }, 2000);
    } catch {
      // Clipboard unavailable
    }
  }

  async function handleSend(text: string) {
    const q = text.trim();
    if (!q || loading) return;
    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
    await send(q);
  }

  function handleTextareaChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  }

  function relativeTime(dateStr: string) {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "baru saja";
    if (diffMin < 60) return `${diffMin} menit lalu`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr} jam lalu`;
    const diffDay = Math.floor(diffHr / 24);
    if (diffDay < 7) return `${diffDay} hari lalu`;
    return d.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-white dark:bg-surface-dark border-t-4 sm:border-x-4 border-slate-950 dark:border-slate-100 overflow-hidden">
      {/* Clean Single Chat Toolbar */}
      <div className="shrink-0 flex items-center gap-2 px-3 py-2 bg-white dark:bg-surface-dark border-b-2 border-slate-950 dark:border-slate-100">
        <button
          type="button"
          onClick={() => setSidebarOpen(true)}
          aria-label="Riwayat percakapan"
          title="Riwayat percakapan"
          className="min-h-[40px] min-w-[40px] rounded-none border-2 border-slate-950 dark:border-slate-100 text-slate-950 dark:text-slate-100 hover:bg-slate-950 hover:text-white dark:hover:bg-slate-100 dark:hover:text-slate-950 transition shrink-0 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        >
          <Menu className="w-4 h-4" />
        </button>

        <div className="flex-1 min-w-0">
          <p className="text-xs font-headline font-bold text-slate-950 dark:text-slate-100 uppercase truncate tracking-wider">
            {activeTitle}
          </p>
          <p className="text-[10px] font-mono font-bold text-brand-700 dark:text-brand-400 uppercase tracking-wider">
            Asisten CFO
          </p>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={createNewSession}
            aria-label="Percakapan baru"
            title="Percakapan baru"
            className="min-h-[40px] min-w-[40px] rounded-none border-2 border-slate-950 dark:border-slate-100 bg-brand-400 text-slate-950 hover:bg-brand-300 transition shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          >
            <Plus className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => setShowMemoryModal(true)}
            aria-label="Memori AI"
            title="Memori AI"
            className="min-h-[40px] min-w-[40px] rounded-none border-2 border-slate-950 dark:border-slate-100 text-slate-950 dark:text-slate-100 bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 transition relative shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          >
            <Brain className="w-4 h-4" />
            {memories.length > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-0.5 bg-slate-950 dark:bg-brand-500 text-white dark:text-slate-950 text-[9px] font-mono font-bold border border-slate-950 flex items-center justify-center">
                {memories.length > 9 ? "9+" : memories.length}
              </span>
            )}
          </button>

          {activeSessionId && (
            <button
              type="button"
              onClick={() => {
                if (confirm("Hapus percakapan ini?")) {
                  deleteCurrentSession();
                }
              }}
              aria-label="Hapus sesi ini"
              title="Hapus sesi ini"
              className="min-h-[40px] min-w-[40px] rounded-none border-2 border-slate-950 dark:border-slate-100 text-rose-600 dark:text-rose-400 bg-white dark:bg-surface-dark hover:bg-rose-50 dark:hover:bg-rose-950/40 transition shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Messages Stream */}
      <div
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-y-auto px-3.5 py-4 space-y-4 bg-slate-50 dark:bg-slate-950"
      >
        {loadingHistory ? (
          <div className="flex items-center justify-center py-12 gap-2 text-xs font-mono uppercase text-slate-500 dark:text-slate-400">
            <Loader2 className="w-4 h-4 animate-spin text-brand-500" />
            Memuat percakapan...
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-full text-center px-2 py-6">
            <div className="w-12 h-12 rounded-none bg-brand-500 text-slate-950 border-2 border-slate-950 dark:border-slate-100 flex items-center justify-center mb-3 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
              <MessageCircle className="w-6 h-6" />
            </div>
            <p className="text-sm font-headline font-bold text-slate-950 dark:text-slate-100 mb-1">
              Mulai obrolan keuangan
            </p>
            <p className="text-xs font-sans text-slate-600 dark:text-slate-400 mb-4 max-w-[290px] leading-relaxed">
              Tanya analisis cashflow, simulasi budget, atau langsung catat belanja seperti{" "}
              <span className="font-mono font-bold text-brand-700 dark:text-brand-400">
                &quot;beli kopi 25rb&quot;
              </span>
              .
            </p>
            <div className="w-full space-y-2 max-w-[320px]">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => handleSend(s)}
                  className="w-full min-h-[44px] text-left text-xs font-sans font-semibold text-slate-950 dark:text-slate-100 bg-white dark:bg-surface-dark border-2 border-slate-950 dark:border-slate-100 hover:bg-slate-950 hover:text-white dark:hover:bg-slate-100 dark:hover:text-slate-950 rounded-none px-3.5 py-2.5 transition shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,1)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {hasMoreHistory && !loadingHistory && (
          <div className="flex justify-center py-1">
            <button
              type="button"
              onClick={loadOlderMessages}
              disabled={loadingMoreHistory}
              className="min-h-[38px] text-[11px] font-headline font-bold uppercase text-slate-950 dark:text-slate-100 bg-white dark:bg-surface-dark border-2 border-slate-950 dark:border-slate-100 px-3.5 py-1.5 rounded-none transition flex items-center gap-1.5 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
            >
              {loadingMoreHistory ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin text-brand-500" /> Memuat...
                </>
              ) : (
                <>
                  <ArrowUp className="w-3 h-3" /> Muat pesan terdahulu
                </>
              )}
            </button>
          </div>
        )}

        {messages.map((m, i) => (
          <div
            key={m.id ?? i}
            className={cn("flex flex-col", m.role === "user" ? "items-end" : "items-start")}
          >
            {m.role === "user" ? (
              <div className="max-w-[85%] rounded-none px-3.5 py-2.5 text-sm font-sans leading-relaxed whitespace-pre-wrap break-words bg-slate-950 text-white dark:bg-slate-100 dark:text-slate-950 border-2 border-slate-950 dark:border-slate-100 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_rgba(255,255,255,1)]">
                {m.content}
              </div>
            ) : (
              <div className="max-w-[92%] w-fit rounded-none px-3.5 py-3 bg-white dark:bg-surface-dark text-slate-900 dark:text-slate-100 border-2 border-slate-950 dark:border-slate-100 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_rgba(255,255,255,1)] space-y-2">
                <p className="text-[10px] font-headline font-bold uppercase tracking-wider text-brand-700 dark:text-brand-400">
                  Asisten CFO
                </p>
                <div className="text-sm font-sans leading-relaxed">
                  <MarkdownLite text={m.content} />
                </div>
                <div className="border-t border-slate-200 dark:border-slate-800 pt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => speak(m.content, i)}
                    className="min-h-[32px] px-2 py-1 text-[11px] font-mono font-bold border border-slate-950 dark:border-slate-100 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 hover:bg-slate-950 hover:text-white dark:hover:bg-slate-100 dark:hover:text-slate-950 transition inline-flex items-center gap-1"
                  >
                    {speakingIndex === i ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Memuat</span>
                      </>
                    ) : playingIndex === i ? (
                      <>
                        <VolumeX className="w-3.5 h-3.5 text-rose-500" />
                        <span>Stop</span>
                      </>
                    ) : (
                      <>
                        <Volume2 className="w-3.5 h-3.5" />
                        <span>Dengarkan</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCopyMessage(m.content, i)}
                    className="min-h-[32px] px-2 py-1 text-[11px] font-mono font-bold border border-slate-950 dark:border-slate-100 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 hover:bg-slate-950 hover:text-white dark:hover:bg-slate-100 dark:hover:text-slate-950 transition inline-flex items-center gap-1"
                  >
                    {copiedIndex === i ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        <span>Tersalin</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Salin</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {m.role === "assistant" && m.savedExpenses && m.savedExpenses.length > 0 && (
              <div className="mt-2 max-w-[92%] w-full space-y-1.5">
                {m.savedExpenses.map((exp) => (
                  <div
                    key={exp.id}
                    className="flex items-center gap-2 bg-emerald-100 dark:bg-emerald-950/60 border-2 border-slate-950 dark:border-slate-100 rounded-none px-3 py-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                  >
                    <Check className="w-4 h-4 text-emerald-800 dark:text-emerald-300 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-headline font-bold uppercase tracking-wider text-slate-950 dark:text-slate-100 truncate">
                        {exp.description}
                      </p>
                      <p className="text-[11px] font-mono font-bold text-slate-700 dark:text-slate-300">
                        {formatIDR(exp.amount)} · {exp.categoryName}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => undoExpense(i, exp.id)}
                      className="min-h-[34px] px-2 text-[11px] font-mono font-bold uppercase border border-slate-950 text-rose-700 dark:text-rose-300 bg-white dark:bg-slate-900 hover:bg-rose-500 hover:text-white transition shrink-0"
                    >
                      Batalkan
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex items-start">
            <div className="bg-white dark:bg-surface-dark border-2 border-slate-950 dark:border-slate-100 rounded-none px-3.5 py-2.5 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center gap-2 text-xs font-mono font-bold text-slate-700 dark:text-slate-300">
              <Loader2 className="w-4 h-4 animate-spin text-brand-600 dark:text-brand-400 shrink-0" />
              <span>Menyiapkan jawaban...</span>
            </div>
          </div>
        )}
      </div>

      {/* Error Banner */}
      {error && (
        <div
          role="alert"
          className="px-3.5 py-2 bg-rose-100 dark:bg-rose-950/60 border-t-2 border-slate-950 dark:border-slate-100 shrink-0"
        >
          <p className="text-xs font-mono font-bold text-rose-700 dark:text-rose-300">{error}</p>
        </div>
      )}

      {/* Proper Docked Composer Bar */}
      <div className="shrink-0 px-3 py-2.5 bg-white dark:bg-surface-dark border-t-4 border-slate-950 dark:border-slate-100">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend(input);
          }}
          className="flex items-end gap-2"
        >
          <div className="flex-1 min-w-0">
            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={handleTextareaChange}
              onKeyDown={(e) => {
                const isFinePointer =
                  typeof window !== "undefined" &&
                  window.matchMedia("(pointer: fine)").matches;
                if (
                  e.key === "Enter" &&
                  !e.shiftKey &&
                  !e.nativeEvent.isComposing &&
                  (isFinePointer || e.metaKey || e.ctrlKey)
                ) {
                  e.preventDefault();
                  handleSend(input);
                }
              }}
              placeholder="Tanya keuangan atau catat belanja..."
              aria-label="Tulis pesan untuk Asisten Keuangan"
              className="w-full resize-none py-2.5 px-3 rounded-none bg-slate-50 dark:bg-slate-950 border-2 border-slate-950 dark:border-slate-100 text-base sm:text-sm font-sans text-slate-950 dark:text-slate-100 placeholder:text-slate-400 min-h-[44px] max-h-[120px] leading-snug shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
              disabled={loading}
            />
          </div>
          <button
            type="submit"
            disabled={loading || !input.trim()}
            aria-label="Kirim pesan"
            className="min-w-[44px] min-h-[44px] rounded-none bg-brand-500 hover:bg-brand-400 text-slate-950 border-2 border-slate-950 dark:border-slate-100 flex items-center justify-center shrink-0 disabled:opacity-40 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>

      {/* Full-Viewport Sessions Drawer */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-[1px]"
            onClick={() => setSidebarOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Riwayat Percakapan"
            className="relative z-10 w-[85%] max-w-[320px] h-full bg-white dark:bg-surface-dark border-r-4 border-slate-950 dark:border-slate-100 shadow-[8px_0px_0px_0px_rgba(0,0,0,1)] flex flex-col"
          >
            <div className="flex items-center justify-between px-4 py-3.5 border-b-4 border-slate-950 dark:border-slate-100">
              <h3 className="text-xs font-headline font-bold text-slate-950 dark:text-slate-100 uppercase tracking-wider">
                Riwayat Chat
              </h3>
              <button
                type="button"
                onClick={() => setSidebarOpen(false)}
                aria-label="Tutup riwayat chat"
                className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-none border border-slate-950 dark:border-slate-100 text-slate-950 dark:text-slate-100 hover:bg-slate-950 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-3 py-3 border-b-2 border-slate-950 dark:border-slate-100">
              <button
                type="button"
                onClick={() => {
                  createNewSession();
                  setSidebarOpen(false);
                }}
                className="w-full min-h-[44px] flex items-center justify-center gap-2 py-2.5 rounded-none font-headline font-bold text-xs uppercase tracking-wider bg-brand-500 text-slate-950 border-2 border-slate-950 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none"
              >
                <Plus className="w-4 h-4" /> Percakapan Baru
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
              {sessions.length === 0 ? (
                <p className="text-center text-xs font-mono text-slate-400 py-6 uppercase">
                  Belum ada riwayat chat.
                </p>
              ) : (
                sessions.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      selectSession(s);
                      setSidebarOpen(false);
                    }}
                    className={cn(
                      "w-full min-h-[48px] text-left px-3 py-2.5 rounded-none transition-all border-2 border-slate-950 dark:border-slate-100",
                      s.id === activeSessionId
                        ? "bg-slate-950 text-white dark:bg-slate-100 dark:text-slate-950 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                        : "bg-white dark:bg-surface-dark text-slate-950 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800",
                    )}
                  >
                    <p className="text-xs font-headline font-bold uppercase truncate leading-snug">
                      {s.title}
                    </p>
                    <p className="text-[10px] opacity-75 mt-1 flex items-center gap-1 font-mono">
                      <Clock className="w-3 h-3" /> {relativeTime(s.updated_at)}
                    </p>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Full-Viewport AI Memory Modal */}
      {showMemoryModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="ai-memory-title"
            className="bg-white dark:bg-surface-dark border-4 border-slate-950 dark:border-slate-100 rounded-none w-full max-w-md p-4 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:shadow-[8px_8px_0px_0px_rgba(255,255,255,1)] space-y-3 max-h-[85dvh] flex flex-col"
          >
            <div className="flex items-center justify-between pb-2 border-b-2 border-slate-950 dark:border-slate-100 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-none border-2 border-slate-950 bg-brand-400 text-slate-950 flex items-center justify-center">
                  <Brain className="w-4 h-4" />
                </div>
                <div>
                  <h3
                    id="ai-memory-title"
                    className="text-xs font-headline font-bold text-slate-950 dark:text-slate-100 uppercase tracking-wider"
                  >
                    Memori AI
                  </h3>
                  <p className="text-[10px] font-mono text-slate-500 dark:text-slate-400 uppercase">
                    Fakta penting keluarga
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowMemoryModal(false)}
                aria-label="Tutup modal memori AI"
                className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-none border border-slate-950 dark:border-slate-100 text-slate-950 dark:text-slate-100 hover:bg-slate-950 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs font-mono text-slate-600 dark:text-slate-300 leading-relaxed bg-slate-100 dark:bg-slate-950 border border-slate-950 p-2.5 rounded-none shrink-0">
              AI otomatis mendeteksi fakta penting dari obrolan. Anda juga bisa tambah atau edit manual.
            </p>

            {showAddMemoryForm ? (
              <div className="p-2.5 bg-slate-50 dark:bg-slate-900 border-2 border-slate-950 dark:border-slate-100 rounded-none space-y-2 shrink-0">
                <textarea
                  value={newMemoryContent}
                  onChange={(e) => setNewMemoryContent(e.target.value)}
                  placeholder="Contoh: Budget liburan keluarga 7 juta"
                  className="w-full text-base sm:text-xs p-2 rounded-none border-2 border-slate-950 dark:border-slate-100 bg-white dark:bg-slate-950 text-slate-950 dark:text-slate-100 font-mono resize-none"
                  rows={2}
                />
                <div className="flex justify-end gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddMemoryForm(false);
                      setNewMemoryContent("");
                    }}
                    className="min-h-[36px] text-[11px] font-headline font-bold uppercase px-3 py-1 rounded-none border border-slate-950 bg-white dark:bg-slate-950 text-slate-950 dark:text-slate-100"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await addManualMemory(newMemoryContent);
                      setNewMemoryContent("");
                      setShowAddMemoryForm(false);
                    }}
                    disabled={!newMemoryContent.trim()}
                    className="min-h-[36px] text-[11px] font-headline font-bold uppercase px-3 py-1 rounded-none bg-brand-500 text-slate-950 border border-slate-950 shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] disabled:opacity-50"
                  >
                    Simpan
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowAddMemoryForm(true)}
                className="w-full min-h-[42px] flex items-center justify-center gap-1.5 py-2 rounded-none border-2 border-dashed border-slate-950 dark:border-slate-100 text-slate-950 dark:text-slate-100 text-xs font-headline font-bold uppercase hover:bg-slate-100 dark:hover:bg-slate-800 transition shrink-0"
              >
                <Plus className="w-3.5 h-3.5" /> Tambah Catatan Manual
              </button>
            )}

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {memories.length === 0 ? (
                <div className="text-center py-6 text-xs font-mono uppercase text-slate-400">
                  Belum ada memori tersimpan.
                </div>
              ) : (
                memories.map((m) => (
                  <div
                    key={m.id}
                    className="p-2.5 bg-slate-50 dark:bg-slate-950 border-2 border-slate-950 dark:border-slate-100 rounded-none shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                  >
                    {editingMemoryId === m.id ? (
                      <div className="space-y-2">
                        <textarea
                          value={editingContent}
                          onChange={(e) => setEditingContent(e.target.value)}
                          className="w-full text-base sm:text-xs p-2 rounded-none border-2 border-slate-950 dark:border-slate-100 bg-white dark:bg-slate-900 text-slate-950 dark:text-slate-100 font-mono resize-none"
                          rows={2}
                        />
                        <div className="flex justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingMemoryId(null);
                              setEditingContent("");
                            }}
                            className="min-h-[36px] text-[11px] font-headline font-bold uppercase px-3 py-1 rounded-none border border-slate-950 bg-white dark:bg-slate-950 text-slate-950 dark:text-slate-100"
                          >
                            Batal
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              await saveEditedMemory(m.id, editingContent);
                              setEditingMemoryId(null);
                              setEditingContent("");
                            }}
                            disabled={!editingContent.trim()}
                            className="min-h-[36px] text-[11px] font-headline font-bold uppercase px-3 py-1 rounded-none bg-brand-500 text-slate-950 border border-slate-950 shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] disabled:opacity-50"
                          >
                            Simpan
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-xs font-mono text-slate-800 dark:text-slate-200 flex-1 leading-snug">
                          • {m.content}
                        </p>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingMemoryId(m.id);
                              setEditingContent(m.content);
                            }}
                            className="min-h-[34px] min-w-[34px] flex items-center justify-center text-slate-600 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white"
                            title="Edit"
                            aria-label="Edit memori"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteMemory(m.id)}
                            className="min-h-[34px] min-w-[34px] flex items-center justify-center text-slate-600 hover:text-rose-600 dark:text-slate-300 dark:hover:text-rose-400"
                            title="Hapus"
                            aria-label="Hapus memori"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowMemoryModal(false)}
              className="w-full min-h-[44px] py-2.5 text-xs font-headline font-bold uppercase tracking-wider bg-slate-950 text-white dark:bg-slate-100 dark:text-slate-950 border-2 border-slate-950 dark:border-slate-100 rounded-none shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] shrink-0"
            >
              Tutup
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

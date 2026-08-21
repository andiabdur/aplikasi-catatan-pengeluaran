"use client";

import { useEffect, useRef, useState } from "react";
import {
  Send, Loader2, Sparkles, Trash2, Check, X, Volume2, VolumeX,
  Plus, Brain, Clock, Pencil, Menu, ArrowUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { MarkdownLite } from "@/components/markdown-lite";
import { useChatContext } from "@/contexts/chat-context";

const SUGGESTIONS = [
  "Berapa total pengeluaran bulan ini?",
  "Kategori mana yang paling boros?",
  "Gimana cara nabung lebih cepat?",
  "Kasih tips hemat buat keluarga.",
];

function formatIDR(n: number) {
  return "Rp " + n.toLocaleString("id-ID");
}

export function FinancialChat({
  householdId,
  fullPage = false,
}: {
  householdId: string;
  fullPage?: boolean;
}) {
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

  // Sync householdId into context on render/mount
  useEffect(() => {
    if (householdId) {
      setHouseholdId(householdId);
    }
  }, [householdId, setHouseholdId]);

  // ── Local UI state ───────────────────────────────────────────────────────
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showMemoryModal, setShowMemoryModal] = useState(false);
  const [editingMemoryId, setEditingMemoryId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState("");
  const [showAddMemoryForm, setShowAddMemoryForm] = useState(false);
  const [newMemoryContent, setNewMemoryContent] = useState("");
  const [input, setInput] = useState("");

  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingIndex, setPlayingIndex] = useState<number | null>(null);
  const [speakingIndex, setSpeakingIndex] = useState<number | null>(null);

  // ── Audio cleanup ────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (audioRef.current) audioRef.current.pause();
    };
  }, []);

  // ── Auto-scroll to bottom ───────────────────────────────────────────────
  useEffect(() => {
    if (loadingHistory || loadingMoreHistory) return;
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, loading, loadingHistory, loadingMoreHistory]);

  // ── Scroll listener for lazy load ───────────────────────────────────────
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

  // ── TTS ─────────────────────────────────────────────────────────────────
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

  // ── Submit handler ───────────────────────────────────────────────────────
  async function handleSend(text: string) {
    const q = text.trim();
    if (!q || loading) return;
    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
    await send(q);
  }

  // ── Auto-resize textarea ────────────────────────────────────────────────
  function handleTextareaChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  }

  // ── Relative time formatter ─────────────────────────────────────────────
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

  // ── Height classes ──────────────────────────────────────────────────────
  const containerHeight = fullPage ? "h-[calc(100dvh-11rem)]" : "h-[65dvh]";

  return (
    <div
      className={cn(
        "relative flex flex-col rounded-none overflow-hidden border-4 border-slate-950 dark:border-slate-100 bg-white dark:bg-surface-dark shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] dark:shadow-[6px_6px_0px_0px_rgba(255,255,255,1)]",
        containerHeight
      )}
    >
      {/* ═══════════════════════════════════════════════════════════════════
          SIDEBAR — Session List (slide from left)
         ═══════════════════════════════════════════════════════════════════ */}
      {sidebarOpen && (
        <div
          className="absolute inset-0 z-30 bg-black/60 backdrop-blur-[1px]"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <div
        className={cn(
          "absolute left-0 top-0 bottom-0 z-40 w-[80%] max-w-[300px] bg-white dark:bg-surface-dark border-r-4 border-slate-950 dark:border-slate-100 shadow-[8px_0px_0px_0px_rgba(0,0,0,1)] transition-transform duration-300 ease-out flex flex-col",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Sidebar header */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b-4 border-slate-950 dark:border-slate-100">
          <h3 className="text-xs font-headline font-bold text-slate-950 dark:text-slate-100 uppercase tracking-wider">Riwayat Chat</h3>
          <button
            onClick={() => setSidebarOpen(false)}
            className="p-1.5 rounded-none border border-slate-950 text-slate-950 dark:text-slate-100 hover:bg-slate-950 hover:text-white transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* New session button */}
        <div className="px-3 py-3 border-b-2 border-slate-950 dark:border-slate-100">
          <button
            type="button"
            onClick={() => {
              createNewSession();
              setSidebarOpen(false);
            }}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-none font-headline font-bold text-xs uppercase tracking-wider bg-brand-500 text-slate-950 border-2 border-slate-950 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none"
          >
            <Plus className="w-4 h-4" /> Percakapan Baru
          </button>
        </div>

        {/* Session list */}
        <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1.5">
          {sessions.length === 0 ? (
            <p className="text-center text-xs font-mono text-slate-400 py-6 uppercase">Belum ada riwayat chat.</p>
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
                  "w-full text-left px-3 py-2.5 rounded-none transition-all border-2 border-slate-950 dark:border-slate-100",
                  s.id === activeSessionId
                    ? "bg-slate-950 text-white dark:bg-slate-100 dark:text-slate-950 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                    : "bg-white dark:bg-surface-dark text-slate-950 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800"
                )}
              >
                <p className="text-xs font-headline font-bold uppercase truncate leading-snug">
                  {s.title}
                </p>
                <p className="text-[10px] opacity-70 mt-1 flex items-center gap-1 font-mono">
                  <Clock className="w-3 h-3" /> {relativeTime(s.updated_at)}
                </p>
              </button>
            ))
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          CHAT HEADER
         ═══════════════════════════════════════════════════════════════════ */}
      <div className="flex items-center gap-2 px-3.5 py-3 bg-white dark:bg-surface-dark border-b-4 border-slate-950 dark:border-slate-100 shrink-0">
        {/* Hamburger */}
        <button
          type="button"
          onClick={() => setSidebarOpen(true)}
          className="p-2 rounded-none border-2 border-slate-950 dark:border-slate-100 text-slate-950 dark:text-slate-100 hover:bg-slate-950 hover:text-white dark:hover:bg-slate-100 dark:hover:text-slate-950 transition shrink-0 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
          title="Riwayat sesi"
        >
          <Menu className="w-4 h-4" />
        </button>

        {/* Title */}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-headline font-bold text-slate-950 dark:text-slate-100 uppercase truncate tracking-wider">
            {activeTitle}
          </p>
          <p className="text-[10px] font-mono font-bold text-brand-600 dark:text-brand-400 uppercase tracking-widest">AI Financial Advisor</p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setShowMemoryModal(true)}
            title="Memori AI"
            className="p-2 rounded-none border-2 border-slate-950 dark:border-slate-100 text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/40 hover:bg-purple-100 transition relative shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
          >
            <Brain className="w-4 h-4" />
            {memories.length > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-purple-600 text-white text-[9px] font-mono font-bold rounded-none border border-slate-950 flex items-center justify-center">
                {memories.length > 9 ? "9+" : memories.length}
              </span>
            )}
          </button>
          {activeSessionId && (
            <button
              type="button"
              onClick={deleteCurrentSession}
              title="Hapus sesi ini"
              className="p-2 rounded-none border-2 border-slate-950 dark:border-slate-100 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          MEMORY MODAL
         ═══════════════════════════════════════════════════════════════════ */}
      {showMemoryModal && (
        <div className="absolute inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-surface-dark border-4 border-slate-950 dark:border-slate-100 rounded-none w-full max-w-sm p-4 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:shadow-[8px_8px_0px_0px_rgba(255,255,255,1)] space-y-3 max-h-[80%] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between pb-2 border-b-2 border-slate-950 dark:border-slate-100 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-none border-2 border-slate-950 bg-purple-200 text-purple-900 flex items-center justify-center">
                  <Brain className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-headline font-bold text-slate-950 dark:text-slate-100 uppercase tracking-wider">
                    Memori AI
                  </h3>
                  <p className="text-[10px] font-mono text-slate-500 dark:text-slate-400 uppercase">
                    Fakta penting keluarga
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowMemoryModal(false)}
                className="p-1.5 rounded-none border border-slate-950 text-slate-950 dark:text-slate-100 hover:bg-slate-950 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs font-mono text-slate-600 dark:text-slate-300 leading-relaxed bg-slate-100 dark:bg-slate-950 border border-slate-950 p-2.5 rounded-none shrink-0">
              AI otomatis mendeteksi fakta penting dari obrolan. Anda juga bisa tambah/edit manual.
            </p>

            {/* Add memory form */}
            {showAddMemoryForm ? (
              <div className="p-2.5 bg-purple-50 dark:bg-purple-950/20 border-2 border-slate-950 dark:border-slate-100 rounded-none space-y-2 shrink-0">
                <textarea
                  value={newMemoryContent}
                  onChange={(e) => setNewMemoryContent(e.target.value)}
                  placeholder="Contoh: Budget liburan keluarga 7 juta"
                  className="w-full text-xs p-2 rounded-none border-2 border-slate-950 dark:border-slate-100 bg-white dark:bg-slate-950 text-slate-950 dark:text-slate-100 font-mono resize-none"
                  rows={2}
                />
                <div className="flex justify-end gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddMemoryForm(false);
                      setNewMemoryContent("");
                    }}
                    className="text-[11px] font-headline font-bold uppercase px-2.5 py-1 rounded-none border border-slate-950 bg-white dark:bg-slate-950 text-slate-950 dark:text-slate-100"
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
                    className="text-[11px] font-headline font-bold uppercase px-2.5 py-1 rounded-none bg-brand-500 text-slate-950 border border-slate-950 shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] disabled:opacity-50"
                  >
                    Simpan
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowAddMemoryForm(true)}
                className="w-full flex items-center justify-center gap-1.5 py-2 rounded-none border-2 border-dashed border-slate-950 dark:border-slate-100 text-slate-950 dark:text-slate-100 text-xs font-headline font-bold uppercase hover:bg-slate-100 dark:hover:bg-slate-800 transition shrink-0"
              >
                <Plus className="w-3.5 h-3.5" /> Tambah Catatan Manual
              </button>
            )}

            {/* Memory list */}
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
                          className="w-full text-xs p-2 rounded-none border-2 border-slate-950 dark:border-slate-100 bg-white dark:bg-slate-900 text-slate-950 dark:text-slate-100 font-mono resize-none"
                          rows={2}
                        />
                        <div className="flex justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingMemoryId(null);
                              setEditingContent("");
                            }}
                            className="text-[11px] font-headline font-bold uppercase px-2.5 py-1 rounded-none border border-slate-950 bg-white dark:bg-slate-950 text-slate-950 dark:text-slate-100"
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
                            className="text-[11px] font-headline font-bold uppercase px-2.5 py-1 rounded-none bg-brand-500 text-slate-950 border border-slate-950 shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] disabled:opacity-50"
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
                            className="text-slate-600 hover:text-slate-950 p-1"
                            title="Edit"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteMemory(m.id)}
                            className="text-slate-600 hover:text-rose-600 p-1"
                            title="Hapus"
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
              onClick={() => setShowMemoryModal(false)}
              className="w-full py-2.5 text-xs font-headline font-bold uppercase tracking-wider bg-slate-950 text-white dark:bg-slate-100 dark:text-slate-950 border-2 border-slate-950 dark:border-slate-100 rounded-none shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] shrink-0"
            >
              Tutup
            </button>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          MESSAGES AREA
         ═══════════════════════════════════════════════════════════════════ */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-3 bg-slate-50 dark:bg-slate-950">
        {/* Loading skeleton */}
        {loadingHistory ? (
          <div className="flex items-center justify-center py-10 gap-2 text-xs font-mono uppercase text-slate-400">
            <Loader2 className="w-4 h-4 animate-spin text-brand-500" /> Memuat percakapan...
          </div>
        ) : messages.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center h-full text-center px-2 py-4">
            <div className="w-14 h-14 rounded-none bg-brand-500 text-slate-950 border-2 border-slate-950 flex items-center justify-center mb-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <Sparkles className="w-7 h-7" />
            </div>
            <p className="text-sm font-headline font-bold uppercase tracking-wider text-slate-950 dark:text-slate-100 mb-1">
              Halo! Ada yang bisa saya bantu?
            </p>
            <p className="text-xs font-mono text-slate-500 dark:text-slate-400 mb-4 max-w-[280px] uppercase">
              Tanya saran atau catat belanja:{" "}
              <span className="font-bold text-brand-600 dark:text-brand-400">
                &quot;jajan sate 35rb&quot;
              </span>
            </p>
            <div className="w-full space-y-2 max-w-[300px]">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => handleSend(s)}
                  className="w-full text-left text-xs font-headline font-bold uppercase text-slate-950 dark:text-slate-100 bg-white dark:bg-surface-dark border-2 border-slate-950 dark:border-slate-100 hover:bg-slate-950 hover:text-white dark:hover:bg-slate-100 dark:hover:text-slate-950 rounded-none px-3.5 py-2.5 transition shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,1)]"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {/* Load older indicator */}
        {hasMoreHistory && !loadingHistory && (
          <div className="flex justify-center py-1">
            <button
              type="button"
              onClick={loadOlderMessages}
              disabled={loadingMoreHistory}
              className="text-[11px] font-headline font-bold uppercase text-slate-950 dark:text-slate-100 bg-white dark:bg-surface-dark border-2 border-slate-950 dark:border-slate-100 px-3.5 py-1.5 rounded-none transition flex items-center gap-1.5 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
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

        {/* Chat bubbles */}
        {messages.map((m, i) => (
          <div
            key={m.id ?? i}
            className={cn("flex flex-col", m.role === "user" ? "items-end" : "items-start")}
          >
            <div
              className={cn(
                "flex items-end gap-2",
                m.role === "user" ? "flex-row-reverse" : "flex-row"
              )}
            >
              {/* Avatar */}
              {m.role === "assistant" && (
                <div className="w-7 h-7 rounded-none border-2 border-slate-950 bg-brand-500 text-slate-950 flex items-center justify-center shrink-0 shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] mb-0.5">
                  <Sparkles className="w-3.5 h-3.5" />
                </div>
              )}

              {/* Bubble */}
              <div
                className={cn(
                  "max-w-[85%] rounded-none px-4 py-3 text-xs sm:text-sm leading-relaxed border-2 border-slate-950 dark:border-slate-100 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_rgba(255,255,255,1)]",
                  m.role === "user"
                    ? "bg-slate-950 text-white dark:bg-slate-100 dark:text-slate-950 whitespace-pre-wrap font-headline font-bold uppercase tracking-wide"
                    : "bg-white dark:bg-surface-dark text-slate-950 dark:text-slate-100 font-sans"
                )}
              >
                {m.role === "user" ? m.content : <MarkdownLite text={m.content} />}
              </div>

              {/* TTS button */}
              {m.role === "assistant" && (
                <button
                  type="button"
                  onClick={() => speak(m.content, i)}
                  className="p-1.5 rounded-none border border-slate-950 dark:border-slate-100 bg-white dark:bg-surface-dark text-slate-950 dark:text-slate-100 hover:bg-slate-950 hover:text-white shrink-0 self-end transition mb-0.5 shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]"
                  title="Dengarkan"
                >
                  {speakingIndex === i ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />
                  ) : playingIndex === i ? (
                    <VolumeX className="w-3.5 h-3.5 text-rose-500" />
                  ) : (
                    <Volume2 className="w-3.5 h-3.5" />
                  )}
                </button>
              )}
            </div>

            {/* Saved expenses */}
            {m.role === "assistant" && m.savedExpenses && m.savedExpenses.length > 0 && (
              <div className="mt-2 ml-9 max-w-[85%] w-full space-y-1.5">
                {m.savedExpenses.map((exp) => (
                  <div
                    key={exp.id}
                    className="flex items-center gap-2 bg-emerald-100 dark:bg-emerald-950/60 border-2 border-slate-950 dark:border-slate-100 rounded-none px-3.5 py-2.5 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                  >
                    <Check className="w-4 h-4 text-emerald-800 dark:text-emerald-300 shrink-0 font-bold" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-headline font-bold uppercase tracking-wider text-slate-950 dark:text-slate-100 truncate">
                        {exp.description}
                      </p>
                      <p className="text-[11px] font-mono font-bold text-slate-700 dark:text-slate-300">
                        {formatIDR(exp.amount)} · {exp.categoryName}
                      </p>
                    </div>
                    <button
                      onClick={() => undoExpense(i, exp.id)}
                      className="p-1.5 rounded-none border border-slate-950 text-slate-950 hover:bg-rose-500 hover:text-white transition shrink-0"
                      title="Batalkan"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        {/* Typing indicator */}
        {loading && (
          <div className="flex items-end gap-2">
            <div className="w-7 h-7 rounded-none border-2 border-slate-950 bg-brand-500 text-slate-950 flex items-center justify-center shrink-0 shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]">
              <Sparkles className="w-3.5 h-3.5" />
            </div>
            <div className="bg-white dark:bg-surface-dark border-2 border-slate-950 dark:border-slate-100 rounded-none px-4 py-3 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              <div className="flex gap-1.5">
                <span
                  className="w-2 h-2 bg-slate-950 dark:bg-slate-100 rounded-none animate-bounce"
                  style={{ animationDelay: "0ms" }}
                />
                <span
                  className="w-2 h-2 bg-slate-950 dark:bg-slate-100 rounded-none animate-bounce"
                  style={{ animationDelay: "150ms" }}
                />
                <span
                  className="w-2 h-2 bg-slate-950 dark:bg-slate-100 rounded-none animate-bounce"
                  style={{ animationDelay: "300ms" }}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          ERROR BANNER
         ═══════════════════════════════════════════════════════════════════ */}
      {error && (
        <div className="px-3.5 py-2.5 bg-rose-100 dark:bg-rose-950/60 border-t-2 border-slate-950 dark:border-slate-100 shrink-0">
          <p className="text-xs font-mono font-bold text-rose-700 dark:text-rose-300 uppercase">{error}</p>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          INPUT BAR (sticky bottom)
         ═══════════════════════════════════════════════════════════════════ */}
      <div className="px-3.5 py-3 bg-white dark:bg-surface-dark border-t-4 border-slate-950 dark:border-slate-100 shrink-0">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend(input);
          }}
          className="flex items-end gap-2"
        >
          <div className="flex-1 min-w-0 relative">
            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={handleTextareaChange}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  handleSend(input);
                }
              }}
              placeholder="Tanya saran atau catat belanja..."
              className="w-full resize-none py-2.5 px-3.5 rounded-none bg-slate-50 dark:bg-slate-950 border-2 border-slate-950 dark:border-slate-100 text-xs sm:text-sm text-slate-950 dark:text-slate-100 placeholder:text-slate-400 outline-none transition min-h-[42px] max-h-[120px] leading-relaxed font-mono shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
              disabled={loading}
            />
          </div>
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="w-10 h-10 rounded-none bg-brand-500 text-slate-950 border-2 border-slate-950 flex items-center justify-center shrink-0 disabled:opacity-40 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none mb-0.5"
            title="Kirim (⌘+Enter)"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
        <p className="text-[10px] text-slate-500 text-center mt-1.5 font-mono uppercase">
          Enter = baris baru · ⌘/Ctrl+Enter = kirim
        </p>
      </div>
    </div>
  );
}

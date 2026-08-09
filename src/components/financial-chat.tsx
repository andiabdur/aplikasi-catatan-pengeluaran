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
        "relative flex flex-col rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900",
        containerHeight
      )}
    >
      {/* ═══════════════════════════════════════════════════════════════════
          SIDEBAR — Session List (slide from left)
         ═══════════════════════════════════════════════════════════════════ */}
      {sidebarOpen && (
        <div
          className="absolute inset-0 z-30 bg-black/30 backdrop-blur-[2px]"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <div
        className={cn(
          "absolute left-0 top-0 bottom-0 z-40 w-[75%] max-w-[280px] bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 shadow-2xl transition-transform duration-300 ease-out flex flex-col",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Sidebar header */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-100 dark:border-slate-700">
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">Riwayat Chat</h3>
          <button
            onClick={() => setSidebarOpen(false)}
            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* New session button */}
        <div className="px-3 py-2.5">
          <button
            type="button"
            onClick={() => {
              createNewSession();
              setSidebarOpen(false);
            }}
            className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 active:scale-[0.98] transition shadow-sm"
          >
            <Plus className="w-4 h-4" /> Percakapan Baru
          </button>
        </div>

        {/* Session list */}
        <div className="flex-1 overflow-y-auto px-2 pb-3 space-y-0.5">
          {sessions.length === 0 ? (
            <p className="text-center text-xs text-slate-400 py-6">Belum ada riwayat chat.</p>
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
                  "w-full text-left px-3 py-2.5 rounded-xl transition group",
                  s.id === activeSessionId
                    ? "bg-brand-50 dark:bg-brand-900/30 border border-brand-200 dark:border-brand-800"
                    : "hover:bg-slate-50 dark:hover:bg-slate-700/50"
                )}
              >
                <p
                  className={cn(
                    "text-sm truncate leading-snug",
                    s.id === activeSessionId
                      ? "font-semibold text-brand-700 dark:text-brand-300"
                      : "text-slate-700 dark:text-slate-300"
                  )}
                >
                  {s.title}
                </p>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 flex items-center gap-1">
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
      <div className="flex items-center gap-2 px-3 py-2.5 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 shrink-0">
        {/* Hamburger */}
        <button
          type="button"
          onClick={() => setSidebarOpen(true)}
          className="p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition shrink-0"
          title="Riwayat sesi"
        >
          <Menu className="w-4.5 h-4.5" />
        </button>

        {/* Title */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">
            {activeTitle}
          </p>
          <p className="text-[11px] text-slate-400 dark:text-slate-500">AI Financial Advisor</p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            type="button"
            onClick={() => setShowMemoryModal(true)}
            title="Memori AI"
            className="p-2 rounded-xl text-purple-500 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition relative"
          >
            <Brain className="w-4.5 h-4.5" />
            {memories.length > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-purple-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                {memories.length > 9 ? "9+" : memories.length}
              </span>
            )}
          </button>
          {activeSessionId && (
            <button
              type="button"
              onClick={deleteCurrentSession}
              title="Hapus sesi ini"
              className="p-2 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition"
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
        <div className="absolute inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-sm p-4 shadow-2xl space-y-3 max-h-[80%] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                  <Brain className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Memori AI
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Fakta penting keluarga Anda
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowMemoryModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl shrink-0">
              AI akan otomatis menyimpan fakta penting dari chat. Anda juga bisa tambah/edit manual.
            </p>

            {/* Add memory form */}
            {showAddMemoryForm ? (
              <div className="p-2.5 bg-purple-50/70 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-xl space-y-2 shrink-0">
                <textarea
                  value={newMemoryContent}
                  onChange={(e) => setNewMemoryContent(e.target.value)}
                  placeholder="Contoh: Budget liburan keluarga 7 juta"
                  className="w-full text-xs p-2 rounded-lg border border-purple-300 dark:border-purple-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 resize-none"
                  rows={2}
                />
                <div className="flex justify-end gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddMemoryForm(false);
                      setNewMemoryContent("");
                    }}
                    className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
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
                    className="text-[11px] px-2.5 py-1 rounded-lg bg-purple-600 text-white font-medium disabled:opacity-50"
                  >
                    Simpan
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowAddMemoryForm(true)}
                className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl border border-dashed border-purple-300 dark:border-purple-800 text-purple-700 dark:text-purple-400 text-xs font-medium hover:bg-purple-50/50 dark:hover:bg-purple-900/20 transition shrink-0"
              >
                <Plus className="w-3.5 h-3.5" /> Tambah Catatan Manual
              </button>
            )}

            {/* Memory list */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {memories.length === 0 ? (
                <div className="text-center py-6 text-xs text-slate-400">
                  Belum ada memori tersimpan.
                </div>
              ) : (
                memories.map((m) => (
                  <div
                    key={m.id}
                    className="p-2.5 bg-purple-50/50 dark:bg-purple-900/10 border border-purple-100 dark:border-purple-900/30 rounded-xl"
                  >
                    {editingMemoryId === m.id ? (
                      <div className="space-y-2">
                        <textarea
                          value={editingContent}
                          onChange={(e) => setEditingContent(e.target.value)}
                          className="w-full text-xs p-2 rounded-lg border border-purple-300 dark:border-purple-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 resize-none"
                          rows={2}
                        />
                        <div className="flex justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingMemoryId(null);
                              setEditingContent("");
                            }}
                            className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
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
                            className="text-[11px] px-2.5 py-1 rounded-lg bg-purple-600 text-white font-medium disabled:opacity-50"
                          >
                            Simpan
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-xs text-slate-700 dark:text-slate-300 flex-1 leading-snug">
                          • {m.content}
                        </p>
                        <div className="flex items-center gap-0.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingMemoryId(m.id);
                              setEditingContent(m.content);
                            }}
                            className="text-slate-400 hover:text-purple-600 p-1 transition"
                            title="Edit"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteMemory(m.id)}
                            className="text-slate-400 hover:text-red-500 p-1 transition"
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
              className="btn-primary w-full py-2 text-xs shrink-0"
            >
              Tutup
            </button>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          MESSAGES AREA
         ═══════════════════════════════════════════════════════════════════ */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {/* Loading skeleton */}
        {loadingHistory ? (
          <div className="flex items-center justify-center py-10 gap-2 text-xs text-slate-400">
            <Loader2 className="w-4 h-4 animate-spin text-brand-600" /> Memuat percakapan...
          </div>
        ) : messages.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center h-full text-center px-2 py-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-100 to-brand-200 dark:from-brand-900/40 dark:to-brand-800/30 text-brand-600 dark:text-brand-400 flex items-center justify-center mb-3 shadow-sm">
              <Sparkles className="w-7 h-7" />
            </div>
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">
              Halo! Ada yang bisa dibantu?
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mb-4 max-w-[280px]">
              Tanya soal keuangan, atau langsung catat pengeluaran:{" "}
              <span className="font-medium text-slate-600 dark:text-slate-300">
                &quot;jajan gorengan 5rb&quot;
              </span>
            </p>
            <div className="w-full space-y-2 max-w-[300px]">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => handleSend(s)}
                  className="w-full text-left text-xs text-brand-700 dark:text-brand-400 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-brand-300 dark:hover:border-brand-700 hover:bg-brand-50 dark:hover:bg-brand-900/20 rounded-xl px-3.5 py-2.5 transition shadow-sm"
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
              className="text-[11px] font-medium text-slate-500 hover:text-brand-600 dark:text-slate-400 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-brand-300 px-3.5 py-1.5 rounded-full transition flex items-center gap-1.5 shadow-sm"
            >
              {loadingMoreHistory ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin text-brand-600" /> Memuat...
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
                "flex items-end gap-1.5",
                m.role === "user" ? "flex-row-reverse" : "flex-row"
              )}
            >
              {/* Avatar */}
              {m.role === "assistant" && (
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-white flex items-center justify-center shrink-0 shadow-sm mb-0.5">
                  <Sparkles className="w-3.5 h-3.5" />
                </div>
              )}

              {/* Bubble */}
              <div
                className={cn(
                  "max-w-[82%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-sm",
                  m.role === "user"
                    ? "bg-brand-600 text-white rounded-br-md whitespace-pre-wrap"
                    : "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-bl-md"
                )}
              >
                {m.role === "user" ? m.content : <MarkdownLite text={m.content} />}
              </div>

              {/* TTS button */}
              {m.role === "assistant" && (
                <button
                  type="button"
                  onClick={() => speak(m.content, i)}
                  className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0 self-end transition mb-0.5"
                  title="Dengarkan"
                >
                  {speakingIndex === i ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />
                  ) : playingIndex === i ? (
                    <VolumeX className="w-3.5 h-3.5 text-red-500" />
                  ) : (
                    <Volume2 className="w-3.5 h-3.5" />
                  )}
                </button>
              )}
            </div>

            {/* Saved expenses */}
            {m.role === "assistant" && m.savedExpenses && m.savedExpenses.length > 0 && (
              <div className="mt-1.5 ml-8 max-w-[82%] w-full space-y-1">
                {m.savedExpenses.map((exp) => (
                  <div
                    key={exp.id}
                    className="flex items-center gap-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl px-3 py-2"
                  >
                    <Check className="w-3.5 h-3.5 text-green-600 dark:text-green-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                        {exp.description}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {formatIDR(exp.amount)} · {exp.categoryName}
                      </p>
                    </div>
                    <button
                      onClick={() => undoExpense(i, exp.id)}
                      className="p-1 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition shrink-0"
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
          <div className="flex items-end gap-1.5">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-white flex items-center justify-center shrink-0 shadow-sm">
              <Sparkles className="w-3.5 h-3.5" />
            </div>
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
              <div className="flex gap-1">
                <span
                  className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"
                  style={{ animationDelay: "0ms" }}
                />
                <span
                  className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"
                  style={{ animationDelay: "150ms" }}
                />
                <span
                  className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"
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
        <div className="px-3 py-2 bg-red-50 dark:bg-red-900/20 border-t border-red-200 dark:border-red-800 shrink-0">
          <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          INPUT BAR (sticky bottom)
         ═══════════════════════════════════════════════════════════════════ */}
      <div className="px-3 py-2.5 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 shrink-0">
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
              placeholder="Tanya atau catat pengeluaran..."
              className="w-full resize-none py-2.5 px-3.5 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:border-brand-400 dark:focus:border-brand-500 focus:ring-1 focus:ring-brand-400/30 text-sm text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 outline-none transition min-h-[42px] max-h-[120px] leading-relaxed"
              disabled={loading}
            />
          </div>
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="w-10 h-10 rounded-xl bg-brand-600 text-white flex items-center justify-center shrink-0 disabled:opacity-40 hover:bg-brand-700 active:scale-95 transition shadow-sm mb-0.5"
            title="Kirim (⌘+Enter)"
          >
            <Send className="w-4.5 h-4.5" />
          </button>
        </form>
        <p className="text-[10px] text-slate-400 text-center mt-1.5">
          Enter = baris baru · ⌘/Ctrl+Enter = kirim
        </p>
      </div>
    </div>
  );
}

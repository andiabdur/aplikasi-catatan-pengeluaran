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
    <div className="flex-1 min-h-0 flex flex-col bg-card border-t sm:border-x border-border sm:rounded-t-2xl overflow-hidden shadow-sm">
      {/* Clean Single Chat Toolbar */}
      <div className="shrink-0 flex items-center gap-2 px-3 py-2.5 bg-card border-b border-border">
        <button
          type="button"
          onClick={() => setSidebarOpen(true)}
          aria-label="Riwayat percakapan"
          title="Riwayat percakapan"
          className="min-h-[40px] min-w-[40px] rounded-xl border border-border bg-background text-foreground hover:bg-muted transition-colors shrink-0 flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Menu className="w-4 h-4" />
        </button>

        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-foreground truncate">
            {activeTitle}
          </p>
          <p className="text-[11px] font-medium text-primary">
            Asisten CFO
          </p>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={createNewSession}
            aria-label="Percakapan baru"
            title="Percakapan baru"
            className="min-h-[40px] min-w-[40px] rounded-xl border border-border bg-accent text-accent-foreground hover:bg-primary hover:text-primary-foreground transition-colors flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Plus className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => setShowMemoryModal(true)}
            aria-label="Memori AI"
            title="Memori AI"
            className="min-h-[40px] min-w-[40px] rounded-xl border border-border text-foreground bg-secondary hover:bg-muted transition-colors relative flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Brain className="w-4 h-4" />
            {memories.length > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-mono font-semibold flex items-center justify-center">
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
              className="min-h-[40px] min-w-[40px] rounded-xl border border-border text-rose-700 dark:text-rose-300 bg-card hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Messages Stream */}
      <div
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-y-auto px-3.5 py-4 space-y-4 bg-background"
      >
        {loadingHistory ? (
          <div className="flex items-center justify-center py-12 gap-2 text-xs text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
            Memuat percakapan...
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-full text-center px-2 py-6">
            <div className="w-12 h-12 rounded-2xl bg-accent text-primary border border-brand-200 dark:border-brand-800/40 flex items-center justify-center mb-3">
              <MessageCircle className="w-6 h-6" />
            </div>
            <p className="text-sm font-semibold text-foreground mb-1">
              Mulai obrolan keuangan
            </p>
            <p className="text-xs text-muted-foreground mb-4 max-w-[290px] leading-relaxed">
              Tanya analisis cashflow, simulasi budget, atau langsung catat belanja seperti{" "}
              <span className="font-mono font-semibold text-primary">
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
                  className="w-full min-h-[44px] text-left text-xs font-medium text-foreground bg-card border border-border hover:bg-accent hover:text-accent-foreground hover:border-primary/40 rounded-xl px-3.5 py-2.5 transition-colors shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
              className="min-h-[38px] text-xs font-medium text-foreground bg-card border border-border hover:bg-muted px-3.5 py-1.5 rounded-xl transition-colors flex items-center gap-1.5 shadow-sm"
            >
              {loadingMoreHistory ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin text-primary" /> Memuat...
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
              <div className="max-w-[85%] rounded-2xl rounded-br-sm px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words bg-primary text-primary-foreground shadow-sm">
                {m.content}
              </div>
            ) : (
              <div className="max-w-[92%] w-fit rounded-2xl rounded-bl-sm px-3.5 py-3 bg-card text-card-foreground border border-border shadow-sm space-y-2">
                <p className="text-[11px] font-semibold text-primary">
                  Asisten CFO
                </p>
                <div className="text-sm leading-relaxed">
                  <MarkdownLite text={m.content} />
                </div>
                <div className="border-t border-border pt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => speak(m.content, i)}
                    className="min-h-[32px] px-2.5 py-1 rounded-lg text-xs font-medium border border-border bg-secondary text-secondary-foreground hover:bg-muted transition-colors inline-flex items-center gap-1"
                  >
                    {speakingIndex === i ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Memuat</span>
                      </>
                    ) : playingIndex === i ? (
                      <>
                        <VolumeX className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
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
                    className="min-h-[32px] px-2.5 py-1 rounded-lg text-xs font-medium border border-border bg-secondary text-secondary-foreground hover:bg-muted transition-colors inline-flex items-center gap-1"
                  >
                    {copiedIndex === i ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-teal-700 dark:text-teal-300" />
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
                    className="flex items-center gap-2 bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800/60 rounded-xl px-3 py-2"
                  >
                    <Check className="w-4 h-4 text-teal-700 dark:text-teal-300 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-foreground truncate">
                        {exp.description}
                      </p>
                      <p className="text-xs font-mono text-teal-800 dark:text-teal-200">
                        {formatIDR(exp.amount)} · {exp.categoryName}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => undoExpense(i, exp.id)}
                      className="min-h-[34px] px-2.5 rounded-lg text-xs font-medium border border-rose-200 dark:border-rose-800/60 text-rose-700 dark:text-rose-300 bg-card hover:bg-rose-600 hover:text-white transition-colors shrink-0"
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
            <div className="bg-card border border-border rounded-2xl rounded-bl-sm px-3.5 py-2.5 shadow-sm flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin text-primary shrink-0" />
              <span>Menyiapkan jawaban...</span>
            </div>
          </div>
        )}
      </div>

      {/* Error Banner */}
      {error && (
        <div
          role="alert"
          className="px-3.5 py-2 bg-rose-50 dark:bg-rose-950/40 border-t border-rose-200 dark:border-rose-800/60 shrink-0"
        >
          <p className="text-xs font-medium text-rose-700 dark:text-rose-300">{error}</p>
        </div>
      )}

      {/* Docked Composer Bar */}
      <div className="shrink-0 px-3 py-2.5 bg-card border-t border-border">
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
              className="w-full resize-none py-2.5 px-3.5 rounded-xl bg-background border border-input text-base sm:text-sm text-foreground placeholder:text-muted-foreground min-h-[44px] max-h-[120px] leading-snug focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              disabled={loading}
            />
          </div>
          <button
            type="submit"
            disabled={loading || !input.trim()}
            aria-label="Kirim pesan"
            className="min-w-[44px] min-h-[44px] rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground flex items-center justify-center shrink-0 disabled:opacity-40 shadow-sm active:scale-95 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>

      {/* Full-Viewport Sessions Drawer */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-[1px]"
            onClick={() => setSidebarOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Riwayat Percakapan"
            className="relative z-10 w-[85%] max-w-[320px] h-full bg-card border-r border-border shadow-xl flex flex-col"
          >
            <div className="flex items-center justify-between px-4 py-3.5 border-b border-border">
              <h3 className="text-sm font-semibold text-foreground">
                Riwayat Chat
              </h3>
              <button
                type="button"
                onClick={() => setSidebarOpen(false)}
                aria-label="Tutup riwayat chat"
                className="min-h-[36px] min-w-[36px] rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-3 py-3 border-b border-border">
              <button
                type="button"
                onClick={() => {
                  createNewSession();
                  setSidebarOpen(false);
                }}
                className="w-full min-h-[44px] flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-xs bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm active:scale-[0.98] transition-all"
              >
                <Plus className="w-4 h-4" /> Percakapan Baru
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
              {sessions.length === 0 ? (
                <p className="text-center text-xs text-muted-foreground py-6">
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
                      "w-full min-h-[48px] text-left px-3 py-2.5 rounded-xl transition-colors border",
                      s.id === activeSessionId
                        ? "bg-accent text-accent-foreground border-primary/50"
                        : "bg-background text-foreground border-border hover:bg-muted",
                    )}
                  >
                    <p className="text-xs font-semibold truncate leading-snug">
                      {s.title}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1 font-mono">
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
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="ai-memory-title"
            className="bg-card border border-border rounded-2xl w-full max-w-md p-4 shadow-xl space-y-3 max-h-[85dvh] flex flex-col"
          >
            <div className="flex items-center justify-between pb-2.5 border-b border-border shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-accent text-primary flex items-center justify-center">
                  <Brain className="w-4 h-4" />
                </div>
                <div>
                  <h3
                    id="ai-memory-title"
                    className="text-sm font-semibold text-foreground"
                  >
                    Memori AI
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Fakta penting keluarga
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowMemoryModal(false)}
                aria-label="Tutup modal memori AI"
                className="min-h-[36px] min-w-[36px] rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed bg-muted/60 border border-border p-2.5 rounded-xl shrink-0">
              AI otomatis mendeteksi fakta penting dari obrolan. Anda juga bisa tambah atau edit manual.
            </p>

            {showAddMemoryForm ? (
              <div className="p-2.5 bg-muted/40 border border-border rounded-xl space-y-2 shrink-0">
                <textarea
                  value={newMemoryContent}
                  onChange={(e) => setNewMemoryContent(e.target.value)}
                  placeholder="Contoh: Budget liburan keluarga 7 juta"
                  className="w-full text-base sm:text-xs p-2.5 rounded-xl border border-input bg-background text-foreground resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  rows={2}
                />
                <div className="flex justify-end gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddMemoryForm(false);
                      setNewMemoryContent("");
                    }}
                    className="min-h-[36px] text-xs font-medium px-3 py-1 rounded-xl border border-border bg-card text-foreground hover:bg-muted"
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
                    className="min-h-[36px] text-xs font-semibold px-3 py-1 rounded-xl bg-primary text-primary-foreground disabled:opacity-50"
                  >
                    Simpan
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowAddMemoryForm(true)}
                className="w-full min-h-[42px] flex items-center justify-center gap-1.5 py-2 rounded-xl border border-dashed border-border text-foreground text-xs font-medium hover:bg-muted transition-colors shrink-0"
              >
                <Plus className="w-3.5 h-3.5" /> Tambah Catatan Manual
              </button>
            )}

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {memories.length === 0 ? (
                <div className="text-center py-6 text-xs text-muted-foreground">
                  Belum ada memori tersimpan.
                </div>
              ) : (
                memories.map((m) => (
                  <div
                    key={m.id}
                    className="p-2.5 bg-background border border-border rounded-xl"
                  >
                    {editingMemoryId === m.id ? (
                      <div className="space-y-2">
                        <textarea
                          value={editingContent}
                          onChange={(e) => setEditingContent(e.target.value)}
                          className="w-full text-base sm:text-xs p-2 rounded-xl border border-input bg-background text-foreground resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          rows={2}
                        />
                        <div className="flex justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingMemoryId(null);
                              setEditingContent("");
                            }}
                            className="min-h-[36px] text-xs font-medium px-3 py-1 rounded-xl border border-border bg-card text-foreground"
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
                            className="min-h-[36px] text-xs font-semibold px-3 py-1 rounded-xl bg-primary text-primary-foreground disabled:opacity-50"
                          >
                            Simpan
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-xs text-foreground flex-1 leading-snug">
                          • {m.content}
                        </p>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingMemoryId(m.id);
                              setEditingContent(m.content);
                            }}
                            className="min-h-[34px] min-w-[34px] rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted"
                            title="Edit"
                            aria-label="Edit memori"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteMemory(m.id)}
                            className="min-h-[34px] min-w-[34px] rounded-lg flex items-center justify-center text-muted-foreground hover:text-rose-700 dark:hover:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40"
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
              className="w-full min-h-[44px] py-2.5 text-xs font-semibold bg-secondary text-secondary-foreground border border-border hover:bg-muted rounded-xl shrink-0"
            >
              Tutup
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

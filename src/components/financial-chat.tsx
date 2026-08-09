"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Send, Loader2, Sparkles, Trash2, Check, X, Volume2, VolumeX,
  Plus, Brain, ChevronDown, MessageSquare, Clock, Pencil
} from "lucide-react";
import { cn } from "@/lib/utils";
import { MarkdownLite } from "@/components/markdown-lite";
import { createClient } from "@/lib/supabase/client";

type SavedExpense = { id?: string; description: string; amount: number; categoryName: string };
type ChatMessage = {
  id?: string;
  role: "user" | "assistant";
  content: string;
  savedExpenses?: SavedExpense[];
  createdAt?: string;
};

type ChatSession = {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
};

type AIMemory = {
  id: string;
  content: string;
  created_at: string;
};

const SUGGESTIONS = [
  "Berapa total pengeluaran untuk event & liburan keluarga?",
  "Kategori mana yang paling boros bulan ini?",
  "Gimana cara nabung lebih cepat buat goal aku?",
  "Kasih tips hemat buat keluarga aku.",
];

function formatIDR(n: number) {
  return "Rp " + n.toLocaleString("id-ID");
}

export function FinancialChat({ householdId }: { householdId: string }) {
  const lastSessionKey = `active_chat_session_${householdId}`;
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [activeTitle, setActiveTitle] = useState<string>("Percakapan Baru");

  const [memories, setMemories] = useState<AIMemory[]>([]);
  const [showMemoryModal, setShowMemoryModal] = useState(false);
  const [showSessionDropdown, setShowSessionDropdown] = useState(false);

  // Manual memory edit / add states
  const [editingMemoryId, setEditingMemoryId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState("");
  const [showAddMemoryForm, setShowAddMemoryForm] = useState(false);
  const [newMemoryContent, setNewMemoryContent] = useState("");

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [hasMoreHistory, setHasMoreHistory] = useState(false);
  const [loadingMoreHistory, setLoadingMoreHistory] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingIndex, setPlayingIndex] = useState<number | null>(null);
  const [speakingIndex, setSpeakingIndex] = useState<number | null>(null);

  // Stop audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, []);

  // Fetch initial session list and memories
  useEffect(() => {
    async function loadSessionsAndMemories() {
      try {
        const res = await fetch("/api/chat-sessions");
        if (res.ok) {
          const data = await res.json();
          const sList: ChatSession[] = data.sessions || [];
          const mList: AIMemory[] = data.memories || [];
          setSessions(sList);
          setMemories(mList);

          // Restore last active session from localStorage if valid, or select top session
          let savedId: string | null = null;
          try {
            savedId = localStorage.getItem(lastSessionKey);
          } catch { /* ignore */ }

          const matched = sList.find((s) => s.id === savedId);
          if (matched) {
            setActiveSessionId(matched.id);
            setActiveTitle(matched.title);
          } else if (sList.length > 0) {
            setActiveSessionId(sList[0].id);
            setActiveTitle(sList[0].title);
          }
        }
      } catch {
        /* ignore */
      }
    }
    loadSessionsAndMemories();
  }, [householdId, lastSessionKey]);

  // Load initial 2 latest messages when activeSessionId changes
  useEffect(() => {
    if (!activeSessionId) {
      setMessages([]);
      setHasMoreHistory(false);
      return;
    }

    try {
      localStorage.setItem(lastSessionKey, activeSessionId);
    } catch { /* ignore */ }

    async function loadSessionMessages() {
      setLoadingHistory(true);
      setHasMoreHistory(false);
      try {
        const res = await fetch(`/api/chat-sessions/${activeSessionId}?limit=2`);
        if (res.ok) {
          const data = await res.json();
          setMessages(data.messages || []);
          setHasMoreHistory(!!data.hasMore);
          if (data.session?.title) {
            setActiveTitle(data.session.title);
          }
        }
      } catch {
        setError("Gagal memuat riwayat percakapan.");
      }
      setLoadingHistory(false);
    }

    loadSessionMessages();
  }, [activeSessionId, lastSessionKey]);

  // Scroll to bottom on initial message load or new message sent
  useEffect(() => {
    if (loadingHistory || loadingMoreHistory) return;
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, loading, loadingHistory, loadingMoreHistory]);

  // Lazy load 3 older messages on demand (scroll to top or button click)
  async function loadOlderMessages() {
    if (!activeSessionId || !hasMoreHistory || loadingMoreHistory || loadingHistory || messages.length === 0) return;

    const oldestMsg = messages[0];
    if (!oldestMsg?.createdAt) return;

    setLoadingMoreHistory(true);
    const container = scrollRef.current;
    const prevScrollHeight = container ? container.scrollHeight : 0;
    const prevScrollTop = container ? container.scrollTop : 0;

    try {
      const res = await fetch(
        `/api/chat-sessions/${activeSessionId}?limit=3&before=${encodeURIComponent(oldestMsg.createdAt)}`
      );
      if (res.ok) {
        const data = await res.json();
        const older: ChatMessage[] = data.messages || [];
        if (older.length > 0) {
          setMessages((prev) => [...older, ...prev]);
        }
        setHasMoreHistory(!!data.hasMore);

        // Retain scroll position so container doesn't jump
        requestAnimationFrame(() => {
          if (container) {
            const newScrollHeight = container.scrollHeight;
            container.scrollTop = newScrollHeight - prevScrollHeight + prevScrollTop;
          }
        });
      }
    } catch {
      /* ignore */
    }
    setLoadingMoreHistory(false);
  }

  // Attach scroll listener to trigger loading older messages when scrolled to top
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
  }, [hasMoreHistory, loadingMoreHistory, loadingHistory, activeSessionId, messages]);

  // Create a brand new session
  async function createNewSession() {
    setError(null);
    setMessages([]);
    setHasMoreHistory(false);
    setActiveSessionId(null);
    setActiveTitle("Percakapan Baru");
    setShowSessionDropdown(false);
  }

  // Switch session
  function selectSession(session: ChatSession) {
    setActiveSessionId(session.id);
    setActiveTitle(session.title);
    setShowSessionDropdown(false);
    setError(null);
  }

  // Delete current session
  async function deleteCurrentSession() {
    if (!activeSessionId) {
      setMessages([]);
      return;
    }

    if (!confirm(`Hapus sesi "${activeTitle}"? Seluruh riwayat di sesi ini akan dihapus.`)) return;

    try {
      const res = await fetch(`/api/chat-sessions/${activeSessionId}`, { method: "DELETE" });
      if (res.ok) {
        const remaining = sessions.filter((s) => s.id !== activeSessionId);
        setSessions(remaining);
        if (remaining.length > 0) {
          setActiveSessionId(remaining[0].id);
          setActiveTitle(remaining[0].title);
        } else {
          setActiveSessionId(null);
          setActiveTitle("Percakapan Baru");
          setMessages([]);
        }
      }
    } catch {
      setError("Gagal menghapus sesi.");
    }
  }

  // Delete specific AI memory
  async function deleteMemory(memoryId: string) {
    try {
      const res = await fetch(`/api/ai-memories?id=${memoryId}`, { method: "DELETE" });
      if (res.ok) {
        setMemories((prev) => prev.filter((m) => m.id !== memoryId));
      }
    } catch {
      setError("Gagal menghapus memori.");
    }
  }

  // Save manual edit of a memory item
  async function saveEditedMemory(memoryId: string) {
    if (!editingContent.trim()) return;
    try {
      const res = await fetch("/api/ai-memories", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: memoryId, content: editingContent.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        setMemories((prev) =>
          prev.map((m) => (m.id === memoryId ? { ...m, content: data.memory.content } : m)),
        );
        setEditingMemoryId(null);
        setEditingContent("");
      }
    } catch {
      setError("Gagal mengedit memori.");
    }
  }

  // Manually add a new memory item
  async function addManualMemory() {
    if (!newMemoryContent.trim()) return;
    try {
      const res = await fetch("/api/ai-memories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newMemoryContent.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        setMemories((prev) => [data.memory, ...prev]);
        setNewMemoryContent("");
        setShowAddMemoryForm(false);
      }
    } catch {
      setError("Gagal menambah memori.");
    }
  }

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
        utterance.onend = () => {
          setPlayingIndex(null);
        };
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

  async function send(text: string) {
    const q = text.trim();
    if (!q || loading) return;
    setError(null);

    const next: ChatMessage[] = [...messages, { role: "user", content: q }];
    setMessages(next);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/financial-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: next.map(({ role, content }) => ({ role, content })),
          sessionId: activeSessionId || "new",
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        setError(json.error || "Gagal menjawab.");
      } else {
        const reply = (json.reply || "").trim();
        const saved: SavedExpense[] = Array.isArray(json.saved_expenses) ? json.saved_expenses : [];

        if (json.session_id && json.session_id !== activeSessionId) {
          setActiveSessionId(json.session_id);
          try {
            localStorage.setItem(lastSessionKey, json.session_id);
          } catch { /* ignore */ }
        }

        if (json.title) {
          setActiveTitle(json.title);
        }

        if (reply) {
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: reply, savedExpenses: saved.length > 0 ? saved : undefined },
          ]);
          if (saved.length > 0) startTransition(() => router.refresh());
        } else {
          setError("Respons kosong dari AI. Coba tanya ulang.");
        }

        // Refresh sessions list & memories silently
        fetch("/api/chat-sessions")
          .then((r) => r.json())
          .then((d) => {
            if (d.sessions) setSessions(d.sessions);
            if (d.memories) setMemories(d.memories);
          })
          .catch(() => {});
      }
    } catch {
      setError("Gagal terhubung. Cek koneksi.");
    }

    setLoading(false);
  }

  async function undoExpense(msgIdx: number, expenseId?: string) {
    if (!expenseId) return;
    const supabase = createClient();
    await supabase.from("expenses").delete().eq("id", expenseId);
    setMessages((prev) =>
      prev.map((m, i) =>
        i === msgIdx
          ? { ...m, savedExpenses: m.savedExpenses?.filter((e) => e.id !== expenseId) }
          : m,
      ),
    );
    startTransition(() => router.refresh());
  }

  return (
    <div className="space-y-3">
      {/* Session Navigation Bar */}
      <div className="card p-2 flex items-center justify-between gap-2 bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700">
        <div className="relative flex-1 min-w-0">
          <button
            type="button"
            onClick={() => setShowSessionDropdown((v) => !v)}
            className="w-full flex items-center justify-between gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-left text-xs font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
          >
            <span className="flex items-center gap-1.5 truncate">
              <MessageSquare className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400 shrink-0" />
              <span className="truncate">{activeTitle}</span>
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          </button>

          {/* Sessions Dropdown Menu */}
          {showSessionDropdown && (
            <div className="absolute top-full left-0 mt-1 w-full max-h-60 overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-50 p-1.5 space-y-1">
              <button
                type="button"
                onClick={createNewSession}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-brand-700 dark:text-brand-400 bg-brand-50 dark:bg-brand-900/30 hover:bg-brand-100 dark:hover:bg-brand-900/50 transition"
              >
                <Plus className="w-4 h-4" /> Sesi Percakapan Baru
              </button>

              {sessions.length > 0 && (
                <div className="pt-1 border-t border-slate-100 dark:border-slate-800 space-y-0.5">
                  <p className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Histori Percakapan
                  </p>
                  {sessions.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => selectSession(s)}
                      className={cn(
                        "w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-xs text-left transition",
                        s.id === activeSessionId
                          ? "bg-slate-100 dark:bg-slate-800 text-brand-700 dark:text-brand-300 font-semibold"
                          : "text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50",
                      )}
                    >
                      <span className="truncate">{s.title}</span>
                      <span className="text-[10px] text-slate-400 shrink-0 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(s.updated_at).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={createNewSession}
            title="Sesi Baru"
            className="flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-xl bg-brand-600 text-white hover:bg-brand-700 transition"
          >
            <Plus className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Sesi Baru</span>
          </button>

          <button
            type="button"
            onClick={() => setShowMemoryModal(true)}
            title="Memori AI"
            className="flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <Brain className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
            <span>Memori ({memories.length})</span>
          </button>

          {activeSessionId && (
            <button
              type="button"
              onClick={deleteCurrentSession}
              title="Hapus Sesi"
              className="p-1.5 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* AI Memory Management Modal with Add & Edit */}
      {showMemoryModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-4 shadow-2xl space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                  <Brain className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Memori Permanen AI</h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Catatan &amp; fakta penting keluarga Anda</p>
                </div>
              </div>
              <button
                onClick={() => setShowMemoryModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl">
              Fakta ini dikelola otomatis oleh AI (tambah/edit/hapus) dari chat Anda atau dapat Anda edit/tambah secara manual. AI akan selalu mengacu pada memori ini.
            </p>

            {/* Manual add memory form */}
            {showAddMemoryForm ? (
              <div className="p-2.5 bg-purple-50/70 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-xl space-y-2">
                <p className="text-xs font-semibold text-purple-900 dark:text-purple-300">Tambah Catatan Memori Manual</p>
                <textarea
                  value={newMemoryContent}
                  onChange={(e) => setNewMemoryContent(e.target.value)}
                  placeholder="Contoh: Rencana liburan ke Jogja budget 7 juta"
                  className="w-full text-xs p-2 rounded-lg border border-purple-300 dark:border-purple-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
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
                    onClick={addManualMemory}
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
                className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-xl border border-dashed border-purple-300 dark:border-purple-800 text-purple-700 dark:text-purple-400 text-xs font-medium hover:bg-purple-50/50 dark:hover:bg-purple-900/20 transition"
              >
                <Plus className="w-3.5 h-3.5" /> Tambah Catatan Manual
              </button>
            )}

            <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
              {memories.length === 0 ? (
                <div className="text-center py-6 text-xs text-slate-400">
                  Belum ada fakta/catatan memori tersimpan. Ceritakan rencana atau kesepakatan keluarga Anda di chat!
                </div>
              ) : (
                memories.map((m) => (
                  <div
                    key={m.id}
                    className="p-2.5 bg-purple-50/50 dark:bg-purple-900/10 border border-purple-100 dark:border-purple-900/30 rounded-xl space-y-2"
                  >
                    {editingMemoryId === m.id ? (
                      <div className="space-y-2">
                        <textarea
                          value={editingContent}
                          onChange={(e) => setEditingContent(e.target.value)}
                          className="w-full text-xs p-2 rounded-lg border border-purple-300 dark:border-purple-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
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
                            onClick={() => saveEditedMemory(m.id)}
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
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingMemoryId(m.id);
                              setEditingContent(m.content);
                            }}
                            className="text-slate-400 hover:text-purple-600 p-1 transition"
                            title="Edit memori"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteMemory(m.id)}
                            className="text-slate-400 hover:text-red-500 p-1 transition"
                            title="Hapus memori"
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

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setShowMemoryModal(false)}
                className="btn-primary w-full py-2 text-xs"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Messages Scroll View */}
      <div ref={scrollRef} className="space-y-3 max-h-[55dvh] overflow-y-auto pr-0.5">
        {loadingHistory ? (
          <div className="flex items-center justify-center py-10 gap-2 text-xs text-slate-400">
            <Loader2 className="w-4 h-4 animate-spin text-brand-600" /> Memuat percakapan...
          </div>
        ) : messages.length === 0 ? (
          <div className="card text-center py-6 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-brand-100 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 flex items-center justify-center mx-auto">
              <Sparkles className="w-6 h-6" />
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Tanya soal keuangan atau langsung catat: <span className="font-medium text-slate-700 dark:text-slate-300">&quot;jajan gorengan 5rb&quot;</span>
            </p>
            <div className="space-y-1.5">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => send(s)}
                  className="block w-full text-left text-xs text-brand-700 dark:text-brand-400 bg-brand-50 dark:bg-brand-900/20 hover:bg-brand-100 dark:hover:bg-brand-900/40 rounded-lg px-3 py-2 transition"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {/* Indicator to load 3 older messages on scroll/click */}
        {hasMoreHistory && !loadingHistory && (
          <div className="flex justify-center py-1">
            <button
              type="button"
              onClick={loadOlderMessages}
              disabled={loadingMoreHistory}
              className="text-[11px] font-medium text-slate-500 hover:text-brand-600 dark:text-slate-400 dark:hover:text-brand-400 bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700 px-3 py-1.5 rounded-full transition flex items-center gap-1.5 shadow-sm"
            >
              {loadingMoreHistory ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin text-brand-600" /> Memuat 3 pesan terdahulu...
                </>
              ) : (
                "↑ Scroll ke atas / Klik untuk muat 3 pesan terdahulu"
              )}
            </button>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={m.id ?? i} className={cn("flex flex-col", m.role === "user" ? "items-end" : "items-start")}>
            <div className="flex items-end gap-1.5 w-full">
              <div
                className={cn(
                  "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                  m.role === "user"
                    ? "bg-brand-600 text-white rounded-br-md whitespace-pre-wrap"
                    : "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-bl-md",
                )}
              >
                {m.role === "user" ? m.content : <MarkdownLite text={m.content} />}
              </div>
              {m.role === "assistant" && (
                <button
                  type="button"
                  onClick={() => speak(m.content, i)}
                  className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0 self-end transition mb-0.5"
                  title="Dengarkan suara"
                >
                  {speakingIndex === i ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />
                  ) : playingIndex === i ? (
                    <VolumeX className="w-3.5 h-3.5 text-red-500" />
                  ) : (
                    <Volume2 className="w-3.5 h-3.5 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300" />
                  )}
                </button>
              )}
            </div>

            {/* Saved expenses card — shown below assistant message */}
            {m.role === "assistant" && m.savedExpenses && m.savedExpenses.length > 0 && (
              <div className="mt-1.5 max-w-[85%] w-full space-y-1">
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

        {loading && (
          <div className="flex justify-start">
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl rounded-bl-md px-3.5 py-2.5">
              <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
            </div>
          </div>
        )}
      </div>

      {error && <p className="text-xs text-red-600 dark:text-red-400 px-1">{error}</p>}

      {/* Message Input Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex items-center gap-2"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Tanya keuangan atau catat: jajan 5rb..."
          className="input flex-1"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="w-11 h-11 rounded-xl bg-brand-600 text-white flex items-center justify-center shrink-0 disabled:opacity-50 active:scale-95 transition"
        >
          <Send className="w-5 h-5" />
        </button>
      </form>
    </div>
  );
}

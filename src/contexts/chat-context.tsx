"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// ─── Types ────────────────────────────────────────────────────────────────────
export type SavedExpense = {
  id?: string;
  description: string;
  amount: number;
  categoryName: string;
};
export type ChatMessage = {
  id?: string;
  role: "user" | "assistant";
  content: string;
  savedExpenses?: SavedExpense[];
  createdAt?: string;
};
export type ChatSession = {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
};
export type AIMemory = {
  id: string;
  content: string;
  created_at: string;
};

export type Insight = { title: string; detail: string; severity: string };
export type SuggestedBudget = { category_id: string; category_name: string; amount: number; reason: string };
export type GoalAdvice = { goal_name: string; advice: string };

export type Analysis = {
  summary: string;
  health: string;
  insights: Insight[];
  action_now: string[];
  suggested_budgets: SuggestedBudget[];
  goal_advice: GoalAdvice[];
  next_label_month: string;
  next_period_title: string;
  periods_analyzed: string[];
};

interface ChatContextType {
  // State
  householdId: string | null;
  sessions: ChatSession[];
  activeSessionId: string | null;
  activeTitle: string;
  messages: ChatMessage[];
  loading: boolean;
  loadingHistory: boolean;
  hasMoreHistory: boolean;
  loadingMoreHistory: boolean;
  memories: AIMemory[];
  error: string | null;
  initialized: boolean;

  // Financial Advisor Analysis State
  analysisData: Analysis | null;
  analysisLoading: boolean;
  analysisError: string | null;
  analysisApplied: boolean;
  applyingBudgets: boolean;

  // Actions
  setHouseholdId: (id: string) => void;
  send: (text: string) => Promise<void>;
  createNewSession: () => void;
  selectSession: (session: ChatSession) => void;
  deleteCurrentSession: () => Promise<void>;
  loadOlderMessages: () => Promise<void>;
  deleteMemory: (id: string) => Promise<void>;
  saveEditedMemory: (id: string, content: string) => Promise<void>;
  addManualMemory: (content: string) => Promise<void>;
  undoExpense: (msgIdx: number, expenseId?: string) => Promise<void>;
  setError: (error: string | null) => void;
  runAnalysis: () => Promise<void>;
  applySuggestedBudgets: () => Promise<void>;
}

const ChatContext = createContext<ChatContextType | null>(null);

export function useChatContext() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChatContext must be used within ChatProvider");
  return ctx;
}

// ─── Provider ─────────────────────────────────────────────────────────────────
export function ChatProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  // ── State ───────────────────────────────────────────────────────────────
  const [householdId, _setHouseholdId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, _setActiveSessionId] = useState<string | null>(null);
  const [activeTitle, setActiveTitle] = useState("Percakapan Baru");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [hasMoreHistory, setHasMoreHistory] = useState(false);
  const [loadingMoreHistory, setLoadingMoreHistory] = useState(false);
  const [memories, setMemories] = useState<AIMemory[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  // Financial Advisor State
  const [analysisData, setAnalysisData] = useState<Analysis | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analysisApplied, setAnalysisApplied] = useState(false);
  const [applyingBudgets, setApplyingBudgets] = useState(false);

  // ── Refs (sync'd every render for safe async access) ────────────────────
  const householdIdRef = useRef(householdId);
  const activeSessionIdRef = useRef(activeSessionId);
  const messagesRef = useRef(messages);
  const loadingRef = useRef(loading);
  const hasMoreHistoryRef = useRef(hasMoreHistory);
  const loadingMoreHistoryRef = useRef(loadingMoreHistory);
  const loadingHistoryRef = useRef(loadingHistory);
  const analysisLoadingRef = useRef(analysisLoading);

  householdIdRef.current = householdId;
  activeSessionIdRef.current = activeSessionId;
  messagesRef.current = messages;
  loadingRef.current = loading;
  hasMoreHistoryRef.current = hasMoreHistory;
  loadingMoreHistoryRef.current = loadingMoreHistory;
  loadingHistoryRef.current = loadingHistory;
  analysisLoadingRef.current = analysisLoading;

  // ── Helpers ─────────────────────────────────────────────────────────────
  function setActiveSessionId(id: string | null) {
    _setActiveSessionId(id);
    activeSessionIdRef.current = id;
    if (id && householdIdRef.current) {
      try {
        localStorage.setItem(`active_chat_session_${householdIdRef.current}`, id);
      } catch { /* */ }
    }
  }

  function setHouseholdId(id: string) {
    if (householdIdRef.current === id) return;
    _setHouseholdId(id);
    householdIdRef.current = id;
  }

  // ── Initialize sessions, memories & analysis when householdId first available ─────
  useEffect(() => {
    if (!householdId) return;

    // Restore analysis from localStorage
    try {
      const raw = localStorage.getItem(`fin_analysis_${householdId}`);
      if (raw) setAnalysisData(JSON.parse(raw));
    } catch { /* */ }

    async function init() {
      try {
        const res = await fetch("/api/chat-sessions");
        if (!res.ok) return;
        const data = await res.json();
        const sList: ChatSession[] = data.sessions || [];
        const mList: AIMemory[] = data.memories || [];
        setSessions(sList);
        setMemories(mList);

        let savedId: string | null = null;
        try {
          savedId = localStorage.getItem(`active_chat_session_${householdId}`);
        } catch { /* */ }

        const matched = sList.find((s) => s.id === savedId);
        if (matched) {
          setActiveSessionId(matched.id);
          setActiveTitle(matched.title);
        } else if (sList.length > 0) {
          setActiveSessionId(sList[0].id);
          setActiveTitle(sList[0].title);
        }
      } catch { /* */ }
      setInitialized(true);
    }

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [householdId]);

  // ── Load messages when activeSessionId changes ──────────────────────────
  useEffect(() => {
    const sid = activeSessionId;
    if (!sid) {
      setMessages([]);
      setHasMoreHistory(false);
      return;
    }

    let cancelled = false;
    async function load() {
      setLoadingHistory(true);
      setHasMoreHistory(false);
      try {
        const res = await fetch(`/api/chat-sessions/${sid}?limit=2`);
        if (res.ok && !cancelled) {
          const data = await res.json();
          setMessages(data.messages || []);
          messagesRef.current = data.messages || [];
          setHasMoreHistory(!!data.hasMore);
          if (data.session?.title) setActiveTitle(data.session.title);
        }
      } catch {
        if (!cancelled) setError("Gagal memuat riwayat percakapan.");
      }
      if (!cancelled) setLoadingHistory(false);
    }

    load();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSessionId]);

  // ── Load older messages ─────────────────────────────────────────────────
  async function loadOlderMessages() {
    const sid = activeSessionIdRef.current;
    if (
      !sid ||
      !hasMoreHistoryRef.current ||
      loadingMoreHistoryRef.current ||
      loadingHistoryRef.current
    ) return;

    const oldest = messagesRef.current[0];
    if (!oldest?.createdAt) return;

    setLoadingMoreHistory(true);
    try {
      const res = await fetch(
        `/api/chat-sessions/${sid}?limit=3&before=${encodeURIComponent(oldest.createdAt)}`
      );
      if (res.ok) {
        const data = await res.json();
        const older: ChatMessage[] = data.messages || [];
        if (older.length > 0) {
          setMessages((prev) => [...older, ...prev]);
        }
        setHasMoreHistory(!!data.hasMore);
      }
    } catch { /* */ }
    setLoadingMoreHistory(false);
  }

  // ── Session CRUD ────────────────────────────────────────────────────────
  function createNewSession() {
    setError(null);
    setMessages([]);
    messagesRef.current = [];
    setHasMoreHistory(false);
    _setActiveSessionId(null);
    activeSessionIdRef.current = null;
    setActiveTitle("Percakapan Baru");
  }

  function selectSession(session: ChatSession) {
    setActiveSessionId(session.id);
    setActiveTitle(session.title);
    setError(null);
  }

  async function deleteCurrentSession() {
    const sid = activeSessionIdRef.current;
    if (!sid) {
      setMessages([]);
      return;
    }

    try {
      const res = await fetch(`/api/chat-sessions/${sid}`, { method: "DELETE" });
      if (res.ok) {
        setSessions((prev) => {
          const remaining = prev.filter((s) => s.id !== sid);
          if (remaining.length > 0) {
            setActiveSessionId(remaining[0].id);
            setActiveTitle(remaining[0].title);
          } else {
            _setActiveSessionId(null);
            activeSessionIdRef.current = null;
            setActiveTitle("Percakapan Baru");
            setMessages([]);
            messagesRef.current = [];
          }
          return remaining;
        });
      }
    } catch {
      setError("Gagal menghapus sesi.");
    }
  }

  // ── Send message (persists across navigations!) ─────────────────────────
  async function send(text: string) {
    const q = text.trim();
    if (!q || loadingRef.current) return;
    setError(null);

    const nextMessages: ChatMessage[] = [
      ...messagesRef.current,
      { role: "user", content: q },
    ];
    setMessages(nextMessages);
    messagesRef.current = nextMessages;
    setLoading(true);
    loadingRef.current = true;

    const sessionId = activeSessionIdRef.current;

    try {
      const res = await fetch("/api/financial-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages.map(({ role, content }) => ({ role, content })),
          sessionId: sessionId || "new",
        }),
      });
      const json = await res.json();

      if (!res.ok) {
        setError(json.error || "Gagal menjawab.");
      } else {
        const reply = (json.reply || "").trim();
        const saved: SavedExpense[] = Array.isArray(json.saved_expenses)
          ? json.saved_expenses
          : [];

        if (json.session_id && json.session_id !== activeSessionIdRef.current) {
          setActiveSessionId(json.session_id);
        }
        if (json.title) setActiveTitle(json.title);

        if (reply) {
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: reply,
              savedExpenses: saved.length > 0 ? saved : undefined,
            },
          ]);
          if (saved.length > 0) startTransition(() => router.refresh());
        } else {
          setError("Respons kosong dari AI. Coba tanya ulang.");
        }

        // Refresh sessions & memories silently
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
    loadingRef.current = false;
  }

  // ── Memory CRUD ─────────────────────────────────────────────────────────
  async function deleteMemory(memoryId: string) {
    try {
      const res = await fetch(`/api/ai-memories?id=${memoryId}`, { method: "DELETE" });
      if (res.ok) setMemories((prev) => prev.filter((m) => m.id !== memoryId));
    } catch {
      setError("Gagal menghapus memori.");
    }
  }

  async function saveEditedMemory(memoryId: string, content: string) {
    if (!content.trim()) return;
    try {
      const res = await fetch("/api/ai-memories", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: memoryId, content: content.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        setMemories((prev) =>
          prev.map((m) =>
            m.id === memoryId ? { ...m, content: data.memory.content } : m
          )
        );
      }
    } catch {
      setError("Gagal mengedit memori.");
    }
  }

  async function addManualMemory(content: string) {
    if (!content.trim()) return;
    try {
      const res = await fetch("/api/ai-memories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: content.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        setMemories((prev) => [data.memory, ...prev]);
      }
    } catch {
      setError("Gagal menambah memori.");
    }
  }

  // ── Undo expense ────────────────────────────────────────────────────────
  async function undoExpense(msgIdx: number, expenseId?: string) {
    if (!expenseId) return;
    const supabase = createClient();
    await supabase.from("expenses").delete().eq("id", expenseId);
    setMessages((prev) =>
      prev.map((m, i) =>
        i === msgIdx
          ? { ...m, savedExpenses: m.savedExpenses?.filter((e) => e.id !== expenseId) }
          : m
      )
    );
    startTransition(() => router.refresh());
  }

  // ── Financial Advisor Analysis Actions ──────────────────────────────────
  async function runAnalysis() {
    if (analysisLoadingRef.current) return;
    setAnalysisLoading(true);
    analysisLoadingRef.current = true;
    setAnalysisError(null);
    setAnalysisApplied(false);

    try {
      const res = await fetch("/api/financial-advisor", { method: "POST" });
      const json = await res.json();

      if (!res.ok) {
        setAnalysisError(json.error || "Gagal menganalisa.");
      } else {
        const analysis = json as Analysis;
        setAnalysisData(analysis);
        if (householdIdRef.current) {
          try {
            localStorage.setItem(
              `fin_analysis_${householdIdRef.current}`,
              JSON.stringify(analysis)
            );
          } catch { /* */ }
        }
      }
    } catch {
      setAnalysisError("Gagal terhubung. Cek koneksi.");
    }

    setAnalysisLoading(false);
    analysisLoadingRef.current = false;
  }

  async function applySuggestedBudgets() {
    const hId = householdIdRef.current;
    if (!analysisData || !hId) return;
    setApplyingBudgets(true);
    const supabase = createClient();
    const rows = analysisData.suggested_budgets.map((s) => ({
      household_id: hId,
      category_id: s.category_id,
      month: analysisData.next_label_month,
      amount: s.amount,
    }));

    const { error: err } = await supabase
      .from("budgets")
      .upsert(rows, { onConflict: "category_id,month" });
    setApplyingBudgets(false);

    if (err) {
      setAnalysisError("Gagal menerapkan budget: " + err.message);
      return;
    }
    setAnalysisApplied(true);
  }

  // ── Context value ───────────────────────────────────────────────────────
  const value: ChatContextType = {
    householdId, sessions, activeSessionId, activeTitle,
    messages, loading, loadingHistory, hasMoreHistory,
    loadingMoreHistory, memories, error, initialized,
    analysisData, analysisLoading, analysisError, analysisApplied, applyingBudgets,
    setHouseholdId, send, createNewSession, selectSession,
    deleteCurrentSession, loadOlderMessages, deleteMemory,
    saveEditedMemory, addManualMemory, undoExpense, setError,
    runAnalysis, applySuggestedBudgets,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

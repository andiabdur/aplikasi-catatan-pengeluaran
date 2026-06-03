"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Send, Loader2, Sparkles, Trash2, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { MarkdownLite } from "@/components/markdown-lite";
import { createClient } from "@/lib/supabase/client";

type SavedExpense = { id?: string; description: string; amount: number; categoryName: string };
type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  savedExpenses?: SavedExpense[];
};

const SUGGESTIONS = [
  "Gimana cara nabung lebih cepat buat goal aku?",
  "Kategori mana yang paling boros bulan ini?",
  "Realistis gak target aku kekejar tahun ini?",
  "Kasih tips hemat buat keluarga aku.",
];

function formatIDR(n: number) {
  return "Rp " + n.toLocaleString("id-ID");
}

export function FinancialChat({ householdId }: { householdId: string }) {
  const storageKey = `fin_chat_${householdId}`;
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Restore history (only role + content, not savedExpenses — those are ephemeral)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) setMessages(JSON.parse(raw));
    } catch { /* ignore */ }
    setHydrated(true);
  }, [storageKey]);

  // Persist history (strip savedExpenses to keep storage clean)
  useEffect(() => {
    if (!hydrated) return;
    try {
      const toStore = messages.map(({ role, content }) => ({ role, content }));
      localStorage.setItem(storageKey, JSON.stringify(toStore));
    } catch { /* ignore */ }
  }, [messages, hydrated, storageKey]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

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
        // Send only role+content to keep payload small
        body: JSON.stringify({ messages: next.map(({ role, content }) => ({ role, content })) }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Gagal menjawab.");
      } else {
        const reply = (json.reply || "").trim();
        const saved: SavedExpense[] = Array.isArray(json.saved_expenses) ? json.saved_expenses : [];
        if (reply) {
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: reply, savedExpenses: saved.length > 0 ? saved : undefined },
          ]);
          if (saved.length > 0) startTransition(() => router.refresh());
        } else {
          setError("Respons kosong dari AI. Coba tanya ulang.");
        }
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

  function clearChat() {
    setMessages([]);
    setError(null);
  }

  return (
    <div className="space-y-3">
      <div ref={scrollRef} className="space-y-3 max-h-[55dvh] overflow-y-auto pr-0.5">
        {messages.length === 0 && (
          <div className="card text-center py-6 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-brand-100 dark:bg-brand-900/30 text-brand-600 flex items-center justify-center mx-auto">
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
        )}

        {messages.map((m, i) => (
          <div key={i} className={cn("flex flex-col", m.role === "user" ? "items-end" : "items-start")}>
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

            {/* Saved expenses card — shown below assistant message */}
            {m.role === "assistant" && m.savedExpenses && m.savedExpenses.length > 0 && (
              <div className="mt-1.5 max-w-[85%] w-full space-y-1">
                {m.savedExpenses.map((exp) => (
                  <div
                    key={exp.id}
                    className="flex items-center gap-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl px-3 py-2"
                  >
                    <Check className="w-3.5 h-3.5 text-green-600 shrink-0" />
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

      {error && <p className="text-xs text-red-600 px-1">{error}</p>}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex items-center gap-2"
      >
        {messages.length > 0 && (
          <button
            type="button"
            onClick={clearChat}
            title="Hapus chat"
            className="p-2.5 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
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

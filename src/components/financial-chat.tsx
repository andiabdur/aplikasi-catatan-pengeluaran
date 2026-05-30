"use client";

import { useEffect, useRef, useState } from "react";
import { Send, Loader2, Sparkles, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { MarkdownLite } from "@/components/markdown-lite";

type ChatMessage = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "Gimana cara nabung lebih cepat buat goal aku?",
  "Kategori mana yang paling boros bulan ini?",
  "Realistis gak target aku kekejar tahun ini?",
  "Kasih tips hemat buat keluarga aku.",
];

export function FinancialChat({ householdId }: { householdId: string }) {
  const storageKey = `fin_chat_${householdId}`;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Restore history
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) setMessages(JSON.parse(raw));
    } catch { /* ignore */ }
    setHydrated(true);
  }, [storageKey]);

  // Persist history
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(messages));
    } catch { /* ignore */ }
  }, [messages, hydrated, storageKey]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  async function send(text: string) {
    const q = text.trim();
    if (!q || loading) return;
    setError(null);
    const next = [...messages, { role: "user" as const, content: q }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/financial-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Gagal menjawab.");
      } else {
        setMessages((prev) => [...prev, { role: "assistant", content: json.reply || "" }]);
      }
    } catch {
      setError("Gagal terhubung. Cek koneksi.");
    }
    setLoading(false);
  }

  function clearChat() {
    setMessages([]);
    setError(null);
  }

  return (
    <div className="space-y-3">
      <div
        ref={scrollRef}
        className="space-y-3 max-h-[55dvh] overflow-y-auto pr-0.5"
      >
        {messages.length === 0 && (
          <div className="card text-center py-6 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-brand-100 text-brand-600 flex items-center justify-center mx-auto">
              <Sparkles className="w-6 h-6" />
            </div>
            <p className="text-sm text-slate-600">
              Tanya apa aja soal keuangan keluarga lu. AI selalu lihat data asli lu.
            </p>
            <div className="space-y-1.5">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => send(s)}
                  className="block w-full text-left text-xs text-brand-700 bg-brand-50 hover:bg-brand-100 rounded-lg px-3 py-2 transition"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div
            key={i}
            className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}
          >
            <div
              className={cn(
                "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                m.role === "user"
                  ? "bg-brand-600 text-white rounded-br-md whitespace-pre-wrap"
                  : "bg-white border border-slate-200 text-slate-700 rounded-bl-md",
              )}
            >
              {m.role === "user" ? m.content : <MarkdownLite text={m.content} />}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-md px-3.5 py-2.5">
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
            className="p-2.5 rounded-xl text-slate-400 hover:bg-slate-100 shrink-0"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Tanya soal keuangan lu..."
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

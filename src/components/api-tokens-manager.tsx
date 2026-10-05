"use client";

import { useEffect, useState } from "react";
import {
  Key,
  Bot,
  Copy,
  Check,
  Trash2,
  ShieldCheck,
  AlertCircle,
  Loader2,
  Plus,
  Terminal,
  ExternalLink,
  X,
} from "lucide-react";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";

type ApiTokenItem = {
  id: string;
  name: string;
  token_prefix: string;
  scopes: string[];
  last_used_at: string | null;
  created_at: string;
};

export function ApiTokensManager() {
  const [tokens, setTokens] = useState<ApiTokenItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [tokenName, setTokenName] = useState("");
  const [creating, setCreating] = useState(false);
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  const [tokenCopied, setTokenCopied] = useState(false);
  const [urlCopied, setUrlCopied] = useState(false);

  // Deleting State
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Host URL detection for MCP endpoint
  const [mcpUrl, setMcpUrl] = useState("/api/mcp");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setMcpUrl(`${window.location.origin}/api/mcp`);
    }
    loadTokens();
  }, []);

  async function loadTokens() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/tokens");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal memuat token");
      setTokens(json.tokens || []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Terjadi kesalahan";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateToken(e: React.FormEvent) {
    e.preventDefault();
    if (!tokenName.trim()) return;

    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: tokenName.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal membuat token");

      setGeneratedToken(json.token);
      setTokens((prev) => [json.tokenInfo, ...prev]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal membuat token";
      setError(msg);
    } finally {
      setCreating(false);
    }
  }

  async function handleDeleteToken(id: string) {
    if (!confirm("Apakah Anda yakin ingin mencabut token akses ini? Integrasi yang menggunakan token ini akan terputus.")) {
      return;
    }

    setDeletingId(id);
    try {
      const res = await fetch(`/api/tokens/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal mencabut token");

      setTokens((prev) => prev.filter((t) => t.id !== id));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal menghapus token";
      alert(msg);
    } finally {
      setDeletingId(null);
    }
  }

  function handleCopyToken() {
    if (!generatedToken) return;
    navigator.clipboard.writeText(generatedToken);
    setTokenCopied(true);
    setTimeout(() => setTokenCopied(false), 2000);
  }

  function handleCopyUrl() {
    navigator.clipboard.writeText(mcpUrl);
    setUrlCopied(true);
    setTimeout(() => setUrlCopied(false), 2000);
  }

  function closeModal() {
    setIsModalOpen(false);
    setTokenName("");
    setGeneratedToken(null);
    setTokenCopied(false);
  }

  return (
    <div className="bg-white dark:bg-surface-dark border-4 border-slate-950 dark:border-slate-100 p-4 md:p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] dark:shadow-[6px_6px_0px_0px_rgba(255,255,255,1)] space-y-5">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b-2 border-slate-950 dark:border-slate-100 pb-4">
        <div className="flex items-start gap-3">
          <div className="p-2.5 bg-brand-500 text-slate-950 border-2 border-slate-950 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
            <Bot className="w-6 h-6" />
          </div>
          <div>
            <h2 className="font-headline font-black text-lg uppercase tracking-wider text-slate-950 dark:text-slate-100">
              Integrasi AI & Token MCP
            </h2>
            <p className="text-xs font-mono text-slate-600 dark:text-slate-400 mt-0.5">
              Hubungkan ke Google Gemini di HP/Web, Claude, atau OmniRoute via Model Context Protocol.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setIsModalOpen(true);
            setGeneratedToken(null);
            setTokenName("");
          }}
          className="self-start sm:self-auto px-4 py-2 bg-brand-500 hover:bg-brand-400 text-slate-950 font-headline font-black text-xs uppercase tracking-wider border-2 border-slate-950 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none flex items-center gap-1.5 transition-all"
        >
          <Plus className="w-4 h-4" />
          Buat Token Baru
        </button>
      </div>

      {/* MCP Endpoint Box */}
      <div className="p-3.5 bg-slate-100 dark:bg-slate-900 border-2 border-slate-950 dark:border-slate-100 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-headline font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
            <Terminal className="w-3.5 h-3.5" />
            Endpoint URL MCP Server
          </span>
          <button
            type="button"
            onClick={handleCopyUrl}
            className="text-[11px] font-mono font-bold text-slate-950 dark:text-slate-100 flex items-center gap-1 hover:underline"
          >
            {urlCopied ? (
              <>
                <Check className="w-3 h-3 text-emerald-600" /> Tersalin
              </>
            ) : (
              <>
                <Copy className="w-3 h-3" /> Salin URL
              </>
            )}
          </button>
        </div>
        <div className="font-mono text-xs text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-950 border border-slate-950 dark:border-slate-800 p-2 break-all select-all font-bold">
          {mcpUrl}
        </div>
      </div>

      {/* Token List */}
      {error && (
        <div className="p-3 bg-rose-100 dark:bg-rose-950/60 border-2 border-rose-600 text-rose-900 dark:text-rose-200 text-xs font-mono font-bold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          {error}
        </div>
      )}

      {loading ? (
        <div className="p-8 flex items-center justify-center gap-2 text-xs font-mono text-slate-500">
          <Loader2 className="w-4 h-4 animate-spin" />
          Memuat daftar token...
        </div>
      ) : tokens.length === 0 ? (
        <div className="p-6 bg-slate-50 dark:bg-slate-900/50 border-2 border-dashed border-slate-300 dark:border-slate-800 text-center space-y-2">
          <Key className="w-8 h-8 mx-auto text-slate-400" />
          <p className="text-xs font-headline font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Belum ada Token Akses
          </p>
          <p className="text-[11px] font-mono text-slate-500 max-w-sm mx-auto">
            Klik &quot;Buat Token Baru&quot; di atas untuk membuat Access Token pertama Anda dan pasang di Gemini HP.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <h3 className="text-xs font-headline font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Token Akses Aktif ({tokens.length})
          </h3>
          <div className="grid gap-3">
            {tokens.map((t) => (
              <div
                key={t.id}
                className="p-3 bg-white dark:bg-slate-900 border-2 border-slate-950 dark:border-slate-100 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_rgba(255,255,255,1)] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-headline font-black text-sm uppercase text-slate-950 dark:text-slate-100">
                      {t.name}
                    </span>
                    <span className="font-mono text-[10px] px-1.5 py-0.5 bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-300 border border-slate-950 dark:border-slate-600">
                      {t.token_prefix}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-mono text-slate-500 dark:text-slate-400">
                    <span>
                      Dibuat: {format(new Date(t.created_at), "d MMM yyyy", { locale: idLocale })}
                    </span>
                    <span>
                      Terakhir dipakai:{" "}
                      {t.last_used_at
                        ? format(new Date(t.last_used_at), "d MMM yyyy, HH:mm", { locale: idLocale })
                        : "Belum pernah"}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleDeleteToken(t.id)}
                  disabled={deletingId === t.id}
                  className="self-end sm:self-auto px-3 py-1.5 bg-rose-100 dark:bg-rose-950/60 hover:bg-rose-200 dark:hover:bg-rose-900 border border-rose-600 text-rose-800 dark:text-rose-200 font-mono text-xs font-bold flex items-center gap-1.5 transition"
                >
                  {deletingId === t.id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="w-3.5 h-3.5" />
                  )}
                  Cabut
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal Buat Token */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-surface-dark border-4 border-slate-950 dark:border-slate-100 w-full max-w-lg p-5 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:shadow-[8px_8px_0px_0px_rgba(255,255,255,1)] space-y-4 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b-2 border-slate-950 dark:border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-brand-500 text-slate-950 border-2 border-slate-950 flex items-center justify-center font-bold">
                  <Key className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-headline font-black text-base uppercase tracking-wider text-slate-950 dark:text-slate-100">
                    {generatedToken ? "Token Berhasil Dibuat" : "Buat Token Akses Baru"}
                  </h3>
                  <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                    {generatedToken ? "Salin dan simpan token rahasia ini sekarang" : "Beri nama perangkat atau klien AI"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="p-1 text-slate-600 hover:text-slate-950 dark:text-slate-400 dark:hover:text-slate-100 border border-transparent hover:border-slate-950"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {!generatedToken ? (
              /* Form Input Nama Token */
              <form onSubmit={handleCreateToken} className="space-y-4">
                <div>
                  <label className="text-xs font-headline font-bold uppercase tracking-wider text-slate-950 dark:text-slate-100 block mb-1">
                    Nama Token / Klien
                  </label>
                  <input
                    type="text"
                    value={tokenName}
                    onChange={(e) => setTokenName(e.target.value)}
                    placeholder="Contoh: Gemini HP Andi, Claude Desktop, OmniRoute"
                    className="w-full border-2 border-slate-950 dark:border-slate-100 bg-slate-50 dark:bg-slate-950 text-slate-950 dark:text-slate-100 px-3 py-2 text-xs font-mono font-bold focus:outline-none shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                    autoFocus
                  />
                  <p className="text-[10px] font-mono text-slate-500 mt-1">
                    Digunakan untuk mengidentifikasi perangkat yang terhubung.
                  </p>
                </div>

                <div className="flex gap-2 justify-end pt-3 border-t-2 border-slate-950 dark:border-slate-100">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="text-xs font-headline font-bold uppercase text-slate-950 dark:text-slate-100 px-4 py-2 border-2 border-slate-950 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={creating || !tokenName.trim()}
                    className="text-xs font-headline font-black uppercase px-5 py-2 bg-brand-500 text-slate-950 hover:bg-brand-400 border-2 border-slate-950 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none flex items-center gap-1.5 transition-all disabled:opacity-50"
                  >
                    {creating ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" /> Membuat...
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" /> Buat Token
                      </>
                    )}
                  </button>
                </div>
              </form>
            ) : (
              /* Layar Tampil Token Baru (Reveal Once) */
              <div className="space-y-4">
                <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border-2 border-amber-600 text-amber-900 dark:text-amber-200 text-xs font-mono space-y-1">
                  <div className="flex items-center gap-1.5 font-bold">
                    <ShieldCheck className="w-4 h-4 text-amber-600" />
                    Penting: Salin Sekarang!
                  </div>
                  <p>
                    Token ini hanya akan ditampilkan satu kali ini saja. Simpan di tempat yang aman karena kami tidak dapat menampilkannya lagi.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-headline font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Token Akses Rahasia
                  </label>
                  <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-950 border-2 border-slate-950 dark:border-slate-100 p-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                    <input
                      type="text"
                      readOnly
                      value={generatedToken}
                      className="w-full bg-transparent font-mono text-xs font-bold text-slate-950 dark:text-slate-100 focus:outline-none select-all"
                    />
                    <button
                      type="button"
                      onClick={handleCopyToken}
                      className="px-3 py-1 bg-brand-500 hover:bg-brand-400 text-slate-950 text-xs font-headline font-black uppercase border border-slate-950 flex items-center gap-1 shrink-0"
                    >
                      {tokenCopied ? (
                        <>
                          <Check className="w-3.5 h-3.5" /> Tersalin
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" /> Salin
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 space-y-2 text-xs font-mono text-slate-700 dark:text-slate-300">
                  <p className="font-headline font-bold uppercase text-[11px] text-slate-950 dark:text-slate-100 flex items-center gap-1">
                    <ExternalLink className="w-3 h-3" /> Cara Menghubungkan ke Gemini:
                  </p>
                  <ol className="list-decimal pl-4 space-y-1 text-[11px]">
                    <li>Buka <strong>gemini.google.com</strong> di browser komputer / HP.</li>
                    <li>Masuk ke <strong>Settings</strong> $\rightarrow$ <strong>Connected Apps</strong>.</li>
                    <li>Pilih <strong>+ Add Custom Connected App</strong>.</li>
                    <li>Isi Server URL dengan: <code className="font-bold">{mcpUrl}</code></li>
                    <li>Masukkan token yang baru saja Anda salin ke konfigurasi autentikasi.</li>
                  </ol>
                </div>

                <div className="pt-2 border-t-2 border-slate-950 dark:border-slate-100 flex justify-end">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="text-xs font-headline font-black uppercase px-6 py-2 bg-slate-950 text-white dark:bg-slate-100 dark:text-slate-950 border-2 border-slate-950 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all"
                  >
                    Saya Sudah Menyalinnya, Tutup
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

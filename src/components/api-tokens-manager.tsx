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

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [tokenName, setTokenName] = useState("");
  const [creating, setCreating] = useState(false);
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  const [tokenCopied, setTokenCopied] = useState(false);
  const [urlCopied, setUrlCopied] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
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
    <div className="bg-card border border-border rounded-2xl p-4 md:p-5 shadow-sm space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border pb-4">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-accent text-primary shrink-0">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-semibold text-base text-foreground">
              Integrasi AI &amp; Token MCP
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
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
          className="self-start sm:self-auto min-h-[40px] px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs shadow-sm active:scale-95 flex items-center gap-1.5 transition-all"
        >
          <Plus className="w-4 h-4" />
          Buat Token Baru
        </button>
      </div>

      <div className="p-3.5 bg-muted/60 border border-border rounded-xl space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
            <Terminal className="w-3.5 h-3.5" />
            Endpoint URL MCP Server
          </span>
          <button
            type="button"
            onClick={handleCopyUrl}
            className="text-xs font-medium text-primary flex items-center gap-1 hover:underline"
          >
            {urlCopied ? (
              <>
                <Check className="w-3.5 h-3.5 text-teal-700 dark:text-teal-300" /> Tersalin
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" /> Salin URL
              </>
            )}
          </button>
        </div>
        <div className="font-mono text-xs text-foreground bg-background border border-border rounded-lg p-2.5 break-all select-all">
          {mcpUrl}
        </div>
      </div>

      {error && (
        <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 rounded-xl text-rose-700 dark:text-rose-300 text-xs font-medium flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {loading ? (
        <div className="p-8 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin text-primary" />
          Memuat daftar token...
        </div>
      ) : tokens.length === 0 ? (
        <div className="p-6 bg-muted/40 border border-dashed border-border rounded-xl text-center space-y-2">
          <Key className="w-8 h-8 mx-auto text-muted-foreground" />
          <p className="text-xs font-semibold text-foreground">
            Belum ada Token Akses
          </p>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Klik &quot;Buat Token Baru&quot; di atas untuk membuat Access Token pertama Anda.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          <h3 className="text-xs font-semibold text-muted-foreground">
            Token Akses Aktif ({tokens.length})
          </h3>
          <div className="grid gap-2.5">
            {tokens.map((t) => (
              <div
                key={t.id}
                className="p-3.5 bg-background border border-border rounded-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-foreground">
                      {t.name}
                    </span>
                    <span className="font-mono text-[11px] px-2 py-0.5 rounded-md bg-muted text-muted-foreground border border-border">
                      {t.token_prefix}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
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
                  className="self-end sm:self-auto min-h-[36px] px-3 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-600 hover:text-white border border-rose-200 dark:border-rose-800/60 text-rose-700 dark:text-rose-300 text-xs font-medium flex items-center gap-1.5 transition-colors"
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

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl w-full max-w-lg p-5 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-accent text-primary flex items-center justify-center">
                  <Key className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-base text-foreground">
                    {generatedToken ? "Token Berhasil Dibuat" : "Buat Token Akses Baru"}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {generatedToken ? "Salin dan simpan token rahasia ini sekarang" : "Beri nama perangkat atau klien AI"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="min-h-[36px] min-w-[36px] rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {!generatedToken ? (
              <form onSubmit={handleCreateToken} className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1.5">
                    Nama Token / Klien
                  </label>
                  <input
                    type="text"
                    value={tokenName}
                    onChange={(e) => setTokenName(e.target.value)}
                    placeholder="Contoh: Gemini HP Andi, Claude Desktop, OmniRoute"
                    className="w-full min-h-[44px] border border-input bg-background text-foreground rounded-xl px-3 py-2 text-base sm:text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    autoFocus
                  />
                  <p className="text-xs text-muted-foreground mt-1.5">
                    Digunakan untuk mengidentifikasi perangkat yang terhubung.
                  </p>
                </div>

                <div className="flex gap-2 justify-end pt-3 border-t border-border">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="min-h-[42px] text-xs font-medium text-foreground px-4 py-2 rounded-xl border border-border hover:bg-muted transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={creating || !tokenName.trim()}
                    className="min-h-[42px] text-xs font-semibold px-5 py-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm flex items-center gap-1.5 transition-all disabled:opacity-50"
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
              <div className="space-y-4">
                <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl text-amber-800 dark:text-amber-200 text-xs space-y-1">
                  <div className="flex items-center gap-1.5 font-semibold">
                    <ShieldCheck className="w-4 h-4" />
                    Penting: Salin Sekarang!
                  </div>
                  <p>
                    Token ini hanya akan ditampilkan satu kali ini saja. Simpan di tempat yang aman karena kami tidak dapat menampilkannya lagi.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    Token Akses Rahasia
                  </label>
                  <div className="flex items-center gap-2 bg-muted/60 border border-border rounded-xl p-2">
                    <input
                      type="text"
                      readOnly
                      value={generatedToken}
                      className="w-full bg-transparent font-mono text-xs font-medium text-foreground focus:outline-none select-all px-1"
                    />
                    <button
                      type="button"
                      onClick={handleCopyToken}
                      className="min-h-[36px] px-3 py-1 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold flex items-center gap-1 shrink-0"
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

                <div className="p-3.5 bg-muted/40 border border-border rounded-xl space-y-2 text-xs text-muted-foreground">
                  <p className="font-semibold text-foreground flex items-center gap-1">
                    <ExternalLink className="w-3.5 h-3.5" /> Cara Menghubungkan ke Gemini:
                  </p>
                  <ol className="list-decimal pl-4 space-y-1">
                    <li>Buka <strong>gemini.google.com</strong> di browser komputer / HP.</li>
                    <li>Masuk ke <strong>Settings</strong> &rarr; <strong>Connected Apps</strong>.</li>
                    <li>Pilih <strong>+ Add Custom Connected App</strong>.</li>
                    <li>Isi Server URL dengan: <code className="font-mono font-semibold text-foreground">{mcpUrl}</code></li>
                    <li>Masukkan token yang baru saja Anda salin ke konfigurasi autentikasi.</li>
                  </ol>
                </div>

                <div className="pt-2 border-t border-border flex justify-end">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="min-h-[42px] text-xs font-semibold px-6 py-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm transition-all"
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

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Wallet, Loader2, Heart } from "lucide-react";

type Mode = "signin" | "signup";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } =
      mode === "signin"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });

    setLoading(false);
    if (error) {
      setError(translateError(error.message));
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-4 py-8 bg-slate-50 dark:bg-background-dark">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-brand-500 text-slate-950 flex items-center justify-center shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] border border-slate-950 mb-4">
            <Wallet className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">Catatan Keuangan Keluarga</h1>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1">
            {mode === "signin" ? "Masuk ke akun keluarga Anda" : "Buat akun baru untuk keluarga"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="neo-card-lg p-6 space-y-4">
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1.5" htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nama@email.com"
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-brand-500"
              autoComplete="email"
            />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1.5" htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="minimal 6 karakter"
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-brand-500"
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
            />
          </div>
          {error && (
            <p className="text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl p-3">
              {error}
            </p>
          )}
          <button type="submit" disabled={loading} className="btn-primary w-full py-3.5 rounded-xl font-bold text-sm shadow-sm flex items-center justify-center">
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : mode === "signin" ? (
              "Masuk"
            ) : (
              "Daftar"
            )}
          </button>

          <div className="text-center pt-3 border-t border-slate-100 dark:border-slate-800">
            {mode === "signin" ? (
              <button
                type="button"
                onClick={() => { setMode("signup"); setError(null); }}
                className="text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition"
              >
                Belum punya akun? <span className="text-brand-600 dark:text-brand-400 font-bold underline">Daftar</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => { setMode("signin"); setError(null); }}
                className="text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition"
              >
                Sudah punya akun? <span className="text-brand-600 dark:text-brand-400 font-bold underline">Masuk</span>
              </button>
            )}
          </div>
        </form>

        <p className="text-[11px] text-slate-400 dark:text-slate-500 text-center mt-4">
          Daftar sekali pakai email + password tanpa perlu verifikasi email.
        </p>

        <div className="mt-8 text-center space-y-1">
          <p className="text-xs font-mono font-semibold text-slate-400">by andiabdur</p>
          <p className="text-xs text-slate-400 flex items-center justify-center gap-1">
            made with <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500 inline" /> for Umma
          </p>
        </div>
      </div>
    </div>
  );
}

function translateError(msg: string): string {
  if (msg.includes("Invalid login credentials")) return "Email atau password salah.";
  if (msg.includes("User already registered")) return "Email sudah terdaftar. Klik 'Masuk' di bawah.";
  if (msg.includes("Email not confirmed"))
    return "Email belum dikonfirmasi. Matikan email confirmation di Supabase: Authentication → Providers → Email → Confirm email = OFF.";
  if (msg.includes("rate limit")) return "Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi.";
  if (msg.includes("Password should be at least")) return "Password minimal 6 karakter.";
  return msg;
}

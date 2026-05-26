"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Wallet, Loader2 } from "lucide-react";

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
    <div className="min-h-dvh flex flex-col items-center justify-center px-6 bg-gradient-to-br from-brand-50 to-slate-100">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-brand-600 text-white flex items-center justify-center shadow-lg shadow-brand-600/30 mb-4">
            <Wallet className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Catatan Keluarga</h1>
          <p className="text-sm text-slate-600 mt-1">
            {mode === "signin" ? "Masuk ke akun Anda" : "Buat akun baru"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="card space-y-4">
          <div>
            <label className="label" htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="kamu@email.com"
              className="input"
              autoComplete="email"
            />
          </div>
          <div>
            <label className="label" htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="minimal 6 karakter"
              className="input"
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
            />
          </div>
          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-2.5">
              {error}
            </p>
          )}
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : mode === "signin" ? (
              "Masuk"
            ) : (
              "Daftar"
            )}
          </button>

          <div className="text-center pt-2 border-t border-slate-100">
            {mode === "signin" ? (
              <button
                type="button"
                onClick={() => { setMode("signup"); setError(null); }}
                className="text-sm text-slate-600"
              >
                Belum punya akun? <span className="text-brand-600 font-medium">Daftar</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => { setMode("signin"); setError(null); }}
                className="text-sm text-slate-600"
              >
                Sudah punya akun? <span className="text-brand-600 font-medium">Masuk</span>
              </button>
            )}
          </div>
        </form>

        <p className="text-xs text-slate-500 text-center mt-4">
          Daftar sekali pake email + password. Tanpa email konfirmasi.
        </p>
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

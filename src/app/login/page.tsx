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
    <div className="min-h-dvh flex flex-col items-center justify-center px-4 py-8 bg-background text-foreground">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-6 text-center">
          <div className="w-14 h-14 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center shadow-sm mb-4">
            <Wallet className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Smart Family Finance</h1>
          <p className="text-xs text-muted-foreground mt-1">
            {mode === "signin" ? "Masuk ke akun keluarga Anda" : "Buat akun baru untuk keluarga"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-card border border-border rounded-2xl p-6 space-y-4 shadow-sm">
          <div>
            <label className="text-xs font-semibold text-foreground block mb-1.5" htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nama@email.com"
              className="w-full min-h-[44px] bg-background border border-input rounded-xl px-3.5 py-2.5 text-base sm:text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              autoComplete="email"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-foreground block mb-1.5" htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimal 6 karakter"
              className="w-full min-h-[44px] bg-background border border-input rounded-xl px-3.5 py-2.5 text-base sm:text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
            />
          </div>
          {error && (
            <p className="text-xs font-medium text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 rounded-xl p-3">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full min-h-[46px] py-3 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold text-sm rounded-xl shadow-sm active:scale-[0.98] transition-all flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : mode === "signin" ? (
              "Masuk"
            ) : (
              "Daftar"
            )}
          </button>

          <div className="text-center pt-3 border-t border-border">
            {mode === "signin" ? (
              <button
                type="button"
                onClick={() => { setMode("signup"); setError(null); }}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Belum punya akun? <span className="text-primary font-semibold hover:underline">Daftar</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => { setMode("signin"); setError(null); }}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Sudah punya akun? <span className="text-primary font-semibold hover:underline">Masuk</span>
              </button>
            )}
          </div>
        </form>

        <p className="text-xs text-muted-foreground text-center mt-4">
          Daftar sekali pakai email &amp; password tanpa verifikasi email.
        </p>

        <div className="mt-8 text-center space-y-1">
          <p className="text-xs font-mono font-medium text-muted-foreground">by andiabdur</p>
          <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
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
    return "Email belum dikonfirmasi. Matikan email confirmation di Supabase: Authentication -> Providers -> Email -> Confirm email = OFF.";
  if (msg.includes("rate limit")) return "Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi.";
  if (msg.includes("Password should be at least")) return "Password minimal 6 karakter.";
  return msg;
}

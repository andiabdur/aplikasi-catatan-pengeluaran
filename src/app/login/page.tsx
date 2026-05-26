"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Wallet, Mail } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    setLoading(false);
    if (error) setError(error.message);
    else setSent(true);
  }

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-6 bg-gradient-to-br from-brand-50 to-slate-100">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-brand-600 text-white flex items-center justify-center shadow-lg shadow-brand-600/30 mb-4">
            <Wallet className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Catatan Keluarga</h1>
          <p className="text-sm text-slate-600 mt-1">Masuk untuk mulai mencatat</p>
        </div>

        {sent ? (
          <div className="card text-center space-y-2">
            <Mail className="w-10 h-10 mx-auto text-brand-600" />
            <p className="font-medium">Cek email Anda</p>
            <p className="text-sm text-slate-600">
              Kami sudah kirim link login ke <span className="font-medium">{email}</span>. Buka email
              tersebut di perangkat yang sama untuk masuk.
            </p>
            <button onClick={() => setSent(false)} className="text-sm text-brand-600 mt-2">
              Pakai email lain
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="card space-y-4">
            <div>
              <label className="label" htmlFor="email">
                Email
              </label>
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
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? "Mengirim link..." : "Kirim link login"}
            </button>
            <p className="text-xs text-slate-500 text-center">
              Tanpa password. Kami kirim link sekali pakai ke email.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}

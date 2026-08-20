"use client";

import { useEffect, useState } from "react";
import { Wallet, Smartphone, Heart, CheckCircle2 } from "lucide-react";
import InstallPWA from "@/components/install-pwa";

// Dedicated install landing page. Share THIS link to friends.
// Its only job: show a big install button — no login form in the way.

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export default function InstallPage() {
  const [mounted, setMounted] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    setMounted(true);
    setInstalled(isStandalone());
  }, []);

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-4 py-8 bg-slate-50 dark:bg-background-dark">
      <div className="w-full max-w-sm text-center">
        <div className="flex flex-col items-center mb-6">
          <div className="w-16 h-16 rounded-2xl bg-brand-500 text-slate-950 flex items-center justify-center shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] border border-slate-950 mb-4">
            <Wallet className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
            Catatan Keuangan Keluarga
          </h1>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
            Catat pengeluaran keluarga cukup dengan suara atau foto struk. Install ke HP untuk akses cepat.
          </p>
        </div>

        <div className="neo-card-lg p-6 space-y-4">
          {mounted && installed ? (
            <div className="flex items-center gap-2.5 text-xs font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3.5 text-left">
              <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span>Aplikasi sudah ter-install di HP ini. Buka langsung dari layar utama.</span>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-center gap-2 text-slate-500 dark:text-slate-400 text-xs font-medium">
                <Smartphone className="w-4 h-4 text-brand-500" />
                Tap tombol di bawah untuk memasang aplikasi
              </div>
              <InstallPWA />
            </>
          )}

          <a
            href="/login"
            className="block text-xs font-bold text-brand-600 dark:text-brand-400 pt-3 border-t border-slate-100 dark:border-slate-800 hover:underline"
          >
            Lewati, langsung buka aplikasi →
          </a>
        </div>

        <Footer />
      </div>
    </div>
  );
}

function Footer() {
  return (
    <div className="mt-8 text-center space-y-1">
      <p className="text-xs font-mono font-semibold text-slate-400">by andiabdur</p>
      <p className="text-xs text-slate-400 flex items-center justify-center gap-1">
        made with <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500 inline" /> for Umma
      </p>
    </div>
  );
}

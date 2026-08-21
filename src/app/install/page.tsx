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
          <div className="w-16 h-16 rounded-none bg-brand-500 text-slate-950 flex items-center justify-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)] border-4 border-slate-950 dark:border-slate-100 mb-4">
            <Wallet className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-headline font-black text-slate-950 dark:text-slate-100 uppercase tracking-tight">
            Smart Family Finance
          </h1>
          <p className="text-xs font-mono uppercase text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
            Catat pengeluaran cukup dengan suara atau foto struk. Install ke HP untuk akses cepat.
          </p>
        </div>

        <div className="bg-white dark:bg-surface-dark border-4 border-slate-950 dark:border-slate-100 rounded-none p-6 space-y-4 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:shadow-[8px_8px_0px_0px_rgba(255,255,255,1)]">
          {mounted && installed ? (
            <div className="flex items-center gap-2.5 text-xs font-mono font-bold text-emerald-900 bg-emerald-100 border-2 border-slate-950 rounded-none p-3.5 text-left uppercase">
              <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-700" />
              <span>Aplikasi sudah ter-install di HP ini. Buka langsung dari layar utama.</span>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-center gap-2 text-slate-600 dark:text-slate-300 text-xs font-mono uppercase">
                <Smartphone className="w-4 h-4 text-brand-600" />
                Tap tombol di bawah untuk memasang aplikasi
              </div>
              <InstallPWA />
            </>
          )}

          <a
            href="/login"
            className="block text-xs font-mono font-bold uppercase text-slate-600 dark:text-slate-400 pt-3 border-t-2 border-slate-950 dark:border-slate-100 hover:text-slate-950 dark:hover:text-white"
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

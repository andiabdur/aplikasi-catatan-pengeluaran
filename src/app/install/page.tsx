"use client";

import { useEffect, useState } from "react";
import { Wallet, Smartphone, Heart, CheckCircle2 } from "lucide-react";
import InstallPWA from "@/components/install-pwa";

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
    <div className="min-h-dvh flex flex-col items-center justify-center px-4 py-8 bg-background text-foreground">
      <div className="w-full max-w-sm text-center">
        <div className="flex flex-col items-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center shadow-sm mb-4">
            <Wallet className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">
            Smart Family Finance
          </h1>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            Catat pengeluaran cepat dengan form ringkas, suara, atau asisten AI. Install ke HP untuk akses cepat.
          </p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-6 space-y-4 shadow-sm">
          {mounted && installed ? (
            <div className="flex items-center gap-2.5 text-xs font-medium text-teal-800 dark:text-teal-200 bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800/60 rounded-xl p-3.5 text-left">
              <CheckCircle2 className="w-5 h-5 shrink-0 text-teal-700 dark:text-teal-300" />
              <span>Aplikasi sudah ter-install di HP ini. Buka langsung dari layar utama.</span>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-center gap-2 text-muted-foreground text-xs">
                <Smartphone className="w-4 h-4 text-primary" />
                Tap tombol di bawah untuk memasang aplikasi
              </div>
              <InstallPWA />
            </>
          )}

          <a
            href="/login"
            className="block text-xs font-medium text-muted-foreground pt-3 border-t border-border hover:text-foreground transition-colors"
          >
            Lewati, langsung buka aplikasi
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
      <p className="text-xs font-mono font-medium text-muted-foreground">by andiabdur</p>
      <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
        made with <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500 inline" /> for Umma
      </p>
    </div>
  );
}

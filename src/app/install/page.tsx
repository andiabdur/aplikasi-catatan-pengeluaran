"use client";

import { useEffect, useState } from "react";
import { Wallet, Smartphone } from "lucide-react";
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
    <div className="min-h-dvh flex flex-col items-center justify-center px-6 bg-gradient-to-br from-brand-50 to-slate-100">
      <div className="w-full max-w-sm text-center">
        <div className="flex flex-col items-center mb-8">
          <div className="w-20 h-20 rounded-3xl bg-brand-600 text-white flex items-center justify-center shadow-lg shadow-brand-600/30 mb-5">
            <Wallet className="w-10 h-10" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">
            Catatan Keuangan Keluarga
          </h1>
          <p className="text-sm text-slate-600 mt-2 leading-relaxed">
            Catat pengeluaran keluarga cukup dengan ngomong. Install dulu ke HP,
            lalu buat akun sendiri.
          </p>
        </div>

        <div className="card space-y-4">
          {mounted && installed ? (
            <p className="text-sm text-brand-700 bg-brand-50 border border-brand-200 rounded-lg p-3">
              Aplikasi sudah ter-install di HP ini. Buka dari layar utama ya. 🎉
            </p>
          ) : (
            <>
              <div className="flex items-center justify-center gap-2 text-slate-500 text-sm">
                <Smartphone className="w-4 h-4" />
                Tap tombol di bawah untuk pasang
              </div>
              <InstallPWA />
            </>
          )}

          <a
            href="/login"
            className="block text-sm text-brand-600 font-medium pt-2 border-t border-slate-100"
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
    <div className="mt-8 text-center">
      <p className="text-xs text-slate-500">by andiabdur</p>
      <p className="text-xs text-slate-400 mt-0.5 flex items-center justify-center gap-1">
        made with <span className="text-red-500">❤</span> for Umma :D
      </p>
    </div>
  );
}

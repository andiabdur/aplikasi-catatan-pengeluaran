"use client";

import { useEffect, useState } from "react";
import { Download, Share, Plus, X } from "lucide-react";

// Cross-platform "Install app" button.
// - Android/Chrome: captures beforeinstallprompt and triggers the native prompt.
// - iOS Safari: no prompt event exists, so we show a manual instructions modal.
// - Already installed / standalone: renders nothing.

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari exposes this non-standard flag
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const iOSDevice = /iPad|iPhone|iPod/.test(ua);
  // iPadOS 13+ reports as Mac but has touch
  const iPadOS = ua.includes("Macintosh") && "ontouchend" in document;
  return iOSDevice || iPadOS;
}

export default function InstallPWA() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [showIOS, setShowIOS] = useState(false);
  const [ios, setIos] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (isStandalone()) {
      setInstalled(true);
      return;
    }
    setIos(isIOS());

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  // Don't render until mounted (avoids hydration mismatch), or if already installed.
  if (!mounted || installed) return null;

  // Show the button only when we can actually do something:
  // Android has a deferred prompt, or it's iOS (manual instructions).
  const canShow = deferred !== null || ios;
  if (!canShow) return null;

  async function handleClick() {
    if (deferred) {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      if (choice.outcome === "accepted") setInstalled(true);
      setDeferred(null);
      return;
    }
    if (ios) setShowIOS(true);
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className="btn-primary w-full py-3.5 rounded-xl font-bold text-sm shadow-sm flex items-center justify-center gap-2"
      >
        <Download className="w-4 h-4" />
        Install Aplikasi di HP
      </button>

      {showIOS && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm px-4"
          onClick={() => setShowIOS(false)}
        >
          <div
            className="w-full max-w-sm neo-card-lg bg-white dark:bg-slate-900 rounded-2xl p-5 shadow-2xl space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <h2 className="font-bold text-slate-900 dark:text-slate-100 text-sm">Install di iPhone / iPad</h2>
              <button
                type="button"
                onClick={() => setShowIOS(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
                aria-label="Tutup"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <ol className="space-y-3 text-xs text-slate-700 dark:text-slate-200">
              <li className="flex items-start gap-2.5">
                <span className="font-mono font-bold text-brand-600 dark:text-brand-400 bg-brand-500/10 w-5 h-5 rounded-full flex items-center justify-center shrink-0">1</span>
                <span className="flex items-center gap-1 flex-wrap pt-0.5">
                  Tap tombol <Share className="inline w-3.5 h-3.5 text-blue-500" />{" "}
                  <b>Share</b> di menu bawah Safari.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="font-mono font-bold text-brand-600 dark:text-brand-400 bg-brand-500/10 w-5 h-5 rounded-full flex items-center justify-center shrink-0">2</span>
                <span className="flex items-center gap-1 flex-wrap pt-0.5">
                  Pilih <b>Add to Home Screen</b>{" "}
                  <Plus className="inline w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="font-mono font-bold text-brand-600 dark:text-brand-400 bg-brand-500/10 w-5 h-5 rounded-full flex items-center justify-center shrink-0">3</span>
                <span className="pt-0.5">
                  Tap <b>Add</b>. Aplikasi siap dibuka seperti app native.
                </span>
              </li>
            </ol>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 pt-2 border-t border-slate-100 dark:border-slate-800">
              Wajib dibuka di browser <b>Safari</b> di iOS.
            </p>
          </div>
        </div>
      )}
    </>
  );
}

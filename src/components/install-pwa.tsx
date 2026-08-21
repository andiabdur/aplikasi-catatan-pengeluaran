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
        className="w-full py-3.5 bg-brand-500 text-slate-950 hover:bg-brand-400 font-headline font-black uppercase tracking-wider text-xs rounded-none border-2 border-slate-950 dark:border-slate-100 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none flex items-center justify-center gap-2 transition-all"
      >
        <Download className="w-4 h-4" />
        Install Aplikasi di HP
      </button>

      {showIOS && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm px-4"
          onClick={() => setShowIOS(false)}
        >
          <div
            className="w-full max-w-sm bg-white dark:bg-surface-dark border-4 border-slate-950 dark:border-slate-100 rounded-none p-5 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:shadow-[8px_8px_0px_0px_rgba(255,255,255,1)] space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b-2 border-slate-950 dark:border-slate-100">
              <h2 className="font-headline font-bold text-slate-950 dark:text-slate-100 text-xs uppercase tracking-wider">Install di iPhone / iPad</h2>
              <button
                type="button"
                onClick={() => setShowIOS(false)}
                className="p-1 rounded-none border border-slate-950 text-slate-950 dark:text-slate-100 hover:bg-slate-950 hover:text-white"
                aria-label="Tutup"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <ol className="space-y-3 text-xs text-slate-900 dark:text-slate-100">
              <li className="flex items-start gap-2.5">
                <span className="font-mono font-black text-slate-950 bg-brand-400 border border-slate-950 w-5 h-5 rounded-none flex items-center justify-center shrink-0">1</span>
                <span className="flex items-center gap-1 flex-wrap pt-0.5 font-mono">
                  Tap tombol <Share className="inline w-3.5 h-3.5 text-blue-500" />{" "}
                  <b className="font-bold uppercase">Share</b> di menu bawah Safari.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="font-mono font-black text-slate-950 bg-brand-400 border border-slate-950 w-5 h-5 rounded-none flex items-center justify-center shrink-0">2</span>
                <span className="flex items-center gap-1 flex-wrap pt-0.5 font-mono">
                  Pilih <b className="font-bold uppercase">Add to Home Screen</b>{" "}
                  <Plus className="inline w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="font-mono font-black text-slate-950 bg-brand-400 border border-slate-950 w-5 h-5 rounded-none flex items-center justify-center shrink-0">3</span>
                <span className="pt-0.5 font-mono">
                  Tap <b className="font-bold uppercase">Add</b>. Aplikasi siap dibuka seperti app native.
                </span>
              </li>
            </ol>
            <p className="text-[11px] font-mono text-slate-500 uppercase pt-2 border-t-2 border-slate-950 dark:border-slate-100">
              Wajib dibuka di browser <b>Safari</b> di iOS.
            </p>
          </div>
        </div>
      )}
    </>
  );
}

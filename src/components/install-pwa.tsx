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
        className="w-full flex items-center justify-center gap-2 rounded-xl border border-brand-200 bg-white text-brand-700 font-medium py-2.5 text-sm shadow-sm active:scale-[0.99] transition"
      >
        <Download className="w-4 h-4" />
        Install aplikasi di HP
      </button>

      {showIOS && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-4"
          onClick={() => setShowIOS(false)}
        >
          <div
            className="w-full max-w-sm bg-white rounded-2xl p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-slate-900">Install di iPhone/iPad</h2>
              <button
                type="button"
                onClick={() => setShowIOS(false)}
                className="text-slate-400 p-1"
                aria-label="Tutup"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <ol className="space-y-3 text-sm text-slate-700">
              <li className="flex items-start gap-2">
                <span className="font-semibold text-brand-600">1.</span>
                <span className="flex items-center gap-1 flex-wrap">
                  Tap tombol <Share className="inline w-4 h-4 text-blue-500" />{" "}
                  <b>Share</b> di bawah layar Safari.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-semibold text-brand-600">2.</span>
                <span className="flex items-center gap-1 flex-wrap">
                  Pilih <b>Add to Home Screen</b>{" "}
                  <Plus className="inline w-4 h-4 text-slate-500" />.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-semibold text-brand-600">3.</span>
                <span>
                  Tap <b>Add</b>. Aplikasi muncul di layar utama seperti app biasa.
                </span>
              </li>
            </ol>
            <p className="text-xs text-slate-500 mt-4">
              Catatan: harus dibuka di <b>Safari</b> (bukan Chrome) supaya menu ini muncul.
            </p>
          </div>
        </div>
      )}
    </>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Download, Share, Plus, X } from "lucide-react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const iOSDevice = /iPad|iPhone|iPod/.test(ua);
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

  if (!mounted || installed) return null;

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
        className="w-full min-h-[46px] py-3 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold text-sm rounded-xl shadow-sm active:scale-[0.98] flex items-center justify-center gap-2 transition-all"
      >
        <Download className="w-4 h-4" />
        Install Aplikasi di HP
      </button>

      {showIOS && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm px-4 pb-4"
          onClick={() => setShowIOS(false)}
        >
          <div
            className="w-full max-w-sm bg-card border border-border rounded-2xl p-5 shadow-xl space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2.5 border-b border-border">
              <h2 className="font-semibold text-foreground text-sm">Install di iPhone / iPad</h2>
              <button
                type="button"
                onClick={() => setShowIOS(false)}
                className="min-h-[34px] min-w-[34px] rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted"
                aria-label="Tutup"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <ol className="space-y-3 text-xs text-foreground">
              <li className="flex items-start gap-2.5">
                <span className="font-mono font-semibold text-accent-foreground bg-accent border border-brand-200 dark:border-brand-800/50 w-5 h-5 rounded-md flex items-center justify-center shrink-0">1</span>
                <span className="flex items-center gap-1 flex-wrap pt-0.5">
                  Tap tombol <Share className="inline w-3.5 h-3.5 text-primary" />{" "}
                  <b>Share</b> di menu bawah Safari.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="font-mono font-semibold text-accent-foreground bg-accent border border-brand-200 dark:border-brand-800/50 w-5 h-5 rounded-md flex items-center justify-center shrink-0">2</span>
                <span className="flex items-center gap-1 flex-wrap pt-0.5">
                  Pilih <b>Add to Home Screen</b>{" "}
                  <Plus className="inline w-3.5 h-3.5 text-muted-foreground" />.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="font-mono font-semibold text-accent-foreground bg-accent border border-brand-200 dark:border-brand-800/50 w-5 h-5 rounded-md flex items-center justify-center shrink-0">3</span>
                <span className="pt-0.5">
                  Tap <b>Add</b>. Aplikasi siap dibuka seperti app native.
                </span>
              </li>
            </ol>
            <p className="text-xs text-muted-foreground pt-2 border-t border-border">
              Wajib dibuka di browser <b>Safari</b> di iOS.
            </p>
          </div>
        </div>
      )}
    </>
  );
}

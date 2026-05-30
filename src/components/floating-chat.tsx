"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { MessageCircle, X, Sparkles } from "lucide-react";
import { FinancialChat } from "./financial-chat";

export function FloatingChat({ householdId }: { householdId: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  if (pathname === "/asisten") return null;

  return (
    <>
      {/* Floating button — hidden when drawer open */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Chat dengan asisten keuangan"
          className="fixed bottom-[5.5rem] right-4 z-40 w-14 h-14 rounded-full bg-brand-600 text-white shadow-lg shadow-brand-600/40 flex items-center justify-center active:scale-95 transition-transform"
        >
          <MessageCircle className="w-6 h-6" />
        </button>
      )}

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Slide-up drawer */}
      <div
        className={`fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-3xl shadow-2xl transition-transform duration-300 ease-out ${
          open ? "translate-y-0" : "translate-y-full"
        }`}
        style={{ maxHeight: "85dvh" }}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-slate-200" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-2 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-brand-100 text-brand-600 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <p className="font-semibold text-slate-800 text-sm">Asisten Keuangan</p>
              <p className="text-xs text-slate-400">AI · data keuangan real-time</p>
            </div>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Chat body */}
        <div className="p-4 overflow-y-auto" style={{ maxHeight: "calc(85dvh - 80px)" }}>
          {open && <FinancialChat householdId={householdId} />}
        </div>
      </div>
    </>
  );
}

import { useState } from "react";
import { cn } from "@/lib/utils";

export type CalculatorProps = {
  onResult: (amount: number) => void;
  onClose: () => void;
};

export function Calculator({ onResult, onClose }: CalculatorProps) {
  const [calcExpr, setCalcExpr] = useState("");

  function calcPress(key: string) {
    if (key === "AC") {
      setCalcExpr("");
      return;
    }
    if (key === "⌫") {
      setCalcExpr((e) => e.slice(0, -1));
      return;
    }
    if (key === "=") {
      const clean = calcExpr.replace(/×/g, "*").replace(/÷/g, "/");
      if (!/^[\d\s+\-*/().]+$/.test(clean)) return;
      try {
        // eslint-disable-next-line no-new-func
        const result = Function('"use strict"; return (' + clean + ")")() as number;
        if (isFinite(result) && result >= 0) {
          onResult(Math.round(result));
          onClose();
        }
      } catch { /* ignore bad expr */ }
      return;
    }
    setCalcExpr((e) => e + key);
  }

  return (
    <div className="mt-2 bg-white dark:bg-surface-dark border-4 border-slate-950 dark:border-slate-100 rounded-none p-0 overflow-hidden shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)]">
      <div className="px-3.5 py-2.5 bg-slate-100 dark:bg-slate-950 border-b-2 border-slate-950 dark:border-slate-100 text-right min-h-10 flex items-center justify-end">
        <span className="text-lg font-mono font-black text-slate-950 dark:text-slate-100 truncate">
          {calcExpr || "0"}
        </span>
      </div>
      <div className="grid grid-cols-4 gap-px bg-slate-950 dark:bg-slate-100 border-t-0">
        {(["AC", "⌫", "÷", "×", "7", "8", "9", "-", "4", "5", "6", "+", "1", "2", "3", "=", "0", "00", "000", "."] as const).map(
          (k) => (
            <button
              type="button"
              key={k}
              onClick={() => calcPress(k)}
              className={cn(
                "py-3.5 text-xs font-mono font-bold bg-white dark:bg-surface-dark text-slate-950 dark:text-slate-100 hover:bg-slate-950 hover:text-white dark:hover:bg-slate-100 dark:hover:text-slate-950 transition-colors",
                (k === "AC" || k === "⌫") && "text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-600 hover:text-white",
                (k === "÷" || k === "×" || k === "-" || k === "+") &&
                  "bg-slate-100 dark:bg-slate-900 font-black",
                k === "=" && "bg-brand-500 text-slate-950 font-black hover:bg-brand-400 dark:hover:bg-brand-400 hover:text-slate-950",
              )}
            >
              {k}
            </button>
          ),
        )}
      </div>
    </div>
  );
}

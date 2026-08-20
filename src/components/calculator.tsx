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
    <div className="mt-2 neo-card p-0 overflow-hidden">
      <div className="px-3.5 py-2.5 bg-slate-100 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-right min-h-10 flex items-center justify-end">
        <span className="text-base font-mono font-bold text-slate-900 dark:text-slate-100 truncate">
          {calcExpr || "0"}
        </span>
      </div>
      <div className="grid grid-cols-4 gap-px bg-slate-200 dark:bg-slate-800">
        {(["AC", "⌫", "÷", "×", "7", "8", "9", "-", "4", "5", "6", "+", "1", "2", "3", "=", "0", "00", "000", "."] as const).map(
          (k) => (
            <button
              type="button"
              key={k}
              onClick={() => calcPress(k)}
              className={cn(
                "py-3.5 text-xs font-mono font-bold bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 active:bg-slate-100 dark:active:bg-slate-700 transition-colors",
                (k === "AC" || k === "⌫") && "text-rose-500 hover:text-rose-600",
                (k === "÷" || k === "×" || k === "-" || k === "+") &&
                  "text-brand-600 dark:text-brand-400 bg-slate-50 dark:bg-slate-950",
                k === "=" && "btn-primary !rounded-none col-span-1 text-slate-950 font-bold",
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

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
    <div className="mt-2 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
      <div className="px-3 py-2 bg-slate-50 dark:bg-slate-900/60 border-b border-slate-100 dark:border-slate-700 text-right min-h-9 flex items-center justify-end">
        <span className="text-sm font-mono text-slate-600 dark:text-slate-300 truncate">
          {calcExpr || "0"}
        </span>
      </div>
      <div className="grid grid-cols-4 gap-px bg-slate-100 dark:bg-slate-700">
        {(["AC", "⌫", "÷", "×", "7", "8", "9", "-", "4", "5", "6", "+", "1", "2", "3", "=", "0", "00", "000", "."] as const).map(
          (k) => (
            <button
              type="button"
              key={k}
              onClick={() => calcPress(k)}
              className={cn(
                "py-3.5 text-sm font-semibold bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/50 active:bg-slate-100 dark:active:bg-slate-700 transition",
                (k === "AC" || k === "⌫") && "text-red-500",
                (k === "÷" || k === "×" || k === "-" || k === "+") &&
                  "text-brand-600 dark:text-brand-400",
                k === "=" && "bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-800",
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

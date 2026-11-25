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
    <div className="mt-2 bg-card border border-border rounded-xl overflow-hidden shadow-sm">
      <div className="px-3.5 py-2.5 bg-muted/60 border-b border-border text-right min-h-10 flex items-center justify-end">
        <span className="text-lg font-mono font-bold text-foreground truncate tabular-nums">
          {calcExpr || "0"}
        </span>
      </div>
      <div className="grid grid-cols-4 gap-1 p-1.5 bg-muted/40">
        {(["AC", "⌫", "÷", "×", "7", "8", "9", "-", "4", "5", "6", "+", "1", "2", "3", "=", "0", "00", "000", "."] as const).map(
          (k) => (
            <button
              type="button"
              key={k}
              onClick={() => calcPress(k)}
              className={cn(
                "min-h-[44px] rounded-lg text-xs font-mono font-semibold bg-card text-foreground border border-border/70 hover:bg-muted active:scale-95 transition-all",
                (k === "AC" || k === "⌫") &&
                  "text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800/60 hover:bg-rose-100 dark:hover:bg-rose-950/70",
                (k === "÷" || k === "×" || k === "-" || k === "+") &&
                  "bg-secondary text-foreground font-bold",
                k === "=" &&
                  "bg-primary text-primary-foreground border-primary font-bold hover:bg-primary/90",
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

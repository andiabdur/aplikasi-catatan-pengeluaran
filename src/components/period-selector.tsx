"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { periodTitle, periodRangeText, shiftPeriod } from "@/lib/period";

export function PeriodSelector({
  labelMonth,
  payDay,
  onChange,
  compact = false,
  customRangeText,
}: {
  labelMonth: Date;
  payDay: number;
  onChange: (next: Date) => void;
  compact?: boolean;
  customRangeText?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <button
        type="button"
        onClick={() => onChange(shiftPeriod(labelMonth, -1))}
        aria-label="Periode sebelumnya"
        className="w-10 h-10 rounded-xl border border-border bg-card text-foreground hover:bg-muted active:scale-95 transition-all flex items-center justify-center shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
      <div className="flex-1 text-center min-w-0">
        <p className={compact ? "text-xs font-semibold text-foreground truncate" : "text-sm font-semibold text-foreground truncate"}>
          {periodTitle(labelMonth)}
        </p>
        <p className="text-xs font-mono text-muted-foreground mt-0.5 truncate">
          {customRangeText ?? periodRangeText(labelMonth, payDay)}
        </p>
      </div>
      <button
        type="button"
        onClick={() => onChange(shiftPeriod(labelMonth, 1))}
        aria-label="Periode berikutnya"
        className="w-10 h-10 rounded-xl border border-border bg-card text-foreground hover:bg-muted active:scale-95 transition-all flex items-center justify-center shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}

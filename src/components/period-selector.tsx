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
        className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors shadow-sm"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
      <div className="flex-1 text-center">
        <p className={compact ? "text-xs font-bold text-slate-900 dark:text-slate-100 tracking-tight" : "text-sm font-bold text-slate-900 dark:text-slate-100 tracking-tight"}>
          {periodTitle(labelMonth)}
        </p>
        <p className="text-[10px] font-mono text-slate-400 dark:text-slate-500 mt-0.5">{customRangeText ?? periodRangeText(labelMonth, payDay)}</p>
      </div>
      <button
        type="button"
        onClick={() => onChange(shiftPeriod(labelMonth, 1))}
        aria-label="Periode berikutnya"
        className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors shadow-sm"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}

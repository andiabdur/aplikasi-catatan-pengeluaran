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
        className="p-2 rounded-none border-2 border-slate-950 dark:border-slate-100 bg-white dark:bg-slate-900 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,1)] hover:bg-slate-950 hover:text-white dark:hover:bg-slate-100 dark:hover:text-slate-950 active:translate-x-[1px] active:translate-y-[1px] active:shadow-none text-slate-950 dark:text-slate-100 transition-all"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
      <div className="flex-1 text-center">
        <p className={compact ? "text-xs font-headline font-bold text-slate-950 dark:text-slate-100 uppercase tracking-wider" : "text-sm font-headline font-bold text-slate-950 dark:text-slate-100 uppercase tracking-wider"}>
          {periodTitle(labelMonth)}
        </p>
        <p className="text-[10px] font-mono font-bold text-slate-500 uppercase mt-0.5">{customRangeText ?? periodRangeText(labelMonth, payDay)}</p>
      </div>
      <button
        type="button"
        onClick={() => onChange(shiftPeriod(labelMonth, 1))}
        aria-label="Periode berikutnya"
        className="p-2 rounded-none border-2 border-slate-950 dark:border-slate-100 bg-white dark:bg-slate-900 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,1)] hover:bg-slate-950 hover:text-white dark:hover:bg-slate-100 dark:hover:text-slate-950 active:translate-x-[1px] active:translate-y-[1px] active:shadow-none text-slate-950 dark:text-slate-100 transition-all"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}

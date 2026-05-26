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
        className="p-2 rounded-lg hover:bg-slate-100 text-slate-600"
      >
        <ChevronLeft className="w-5 h-5" />
      </button>
      <div className="flex-1 text-center">
        <p className={compact ? "text-sm font-semibold" : "font-semibold"}>
          {periodTitle(labelMonth)}
        </p>
        <p className="text-xs text-slate-500">{customRangeText ?? periodRangeText(labelMonth, payDay)}</p>
      </div>
      <button
        type="button"
        onClick={() => onChange(shiftPeriod(labelMonth, 1))}
        aria-label="Periode berikutnya"
        className="p-2 rounded-lg hover:bg-slate-100 text-slate-600"
      >
        <ChevronRight className="w-5 h-5" />
      </button>
    </div>
  );
}

/**
 * Salary-period math. Mirrors the SQL functions in 0004_salary_periods.sql.
 *
 * Concepts:
 * - payDay: day-of-month a paycheck arrives (default 25).
 * - labelMonth: first day of the calendar month the period ENDS in.
 *   E.g., for payDay=25, labelMonth=2026-06-01 means
 *   period "Gajian Juni 2026" running 25 Mei → 24 Juni.
 */

export function currentPeriodLabel(payDay: number, today: Date = new Date()): Date {
  return periodLabelFor(today, payDay);
}

export function currentPeriodLabelWithCustom(
  payDay: number,
  customPeriods: { label_month: string; start_date: string; end_date: string }[],
  today: Date = new Date()
): Date {
  const todayStr = isoDate(today);
  const matched = customPeriods.find((cp) => todayStr >= cp.start_date && todayStr <= cp.end_date);
  if (matched) {
    // Parse the date components to avoid time zone shifts
    const [y, m, d] = matched.label_month.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  return currentPeriodLabel(payDay, today);
}


export function periodLabelFor(date: Date, payDay: number): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const labelDate = new Date(d.getFullYear(), d.getMonth(), 1);
  if (d.getDate() >= payDay) {
    labelDate.setMonth(labelDate.getMonth() + 1);
  }
  return labelDate;
}

export function periodStart(labelMonth: Date, payDay: number): Date {
  return new Date(labelMonth.getFullYear(), labelMonth.getMonth() - 1, payDay);
}

export function periodEnd(labelMonth: Date, payDay: number): Date {
  return new Date(labelMonth.getFullYear(), labelMonth.getMonth(), payDay - 1);
}

export function periodTitle(labelMonth: Date): string {
  return (
    "Gajian " +
    labelMonth.toLocaleDateString("id-ID", { month: "long", year: "numeric" })
  );
}

export function periodRangeText(labelMonth: Date, payDay: number): string {
  const s = periodStart(labelMonth, payDay);
  const e = periodEnd(labelMonth, payDay);
  const fmt = (d: Date, includeYear = false) =>
    `${d.getDate()} ${d.toLocaleDateString("id-ID", { month: "short" })}` +
    (includeYear ? ` ${d.getFullYear()}` : "");
  const sameYear = s.getFullYear() === e.getFullYear();
  return `${fmt(s, !sameYear)} - ${fmt(e, true)}`;
}

export function shiftPeriod(labelMonth: Date, deltaMonths: number): Date {
  return new Date(labelMonth.getFullYear(), labelMonth.getMonth() + deltaMonths, 1);
}

export function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function labelMonthKey(labelMonth: Date): string {
  return isoDate(new Date(labelMonth.getFullYear(), labelMonth.getMonth(), 1));
}

export function getPeriodRange(
  labelMonth: Date,
  payDay: number,
  customPeriods: { label_month: string; start_date: string; end_date: string }[]
) {
  const key = labelMonthKey(labelMonth);
  const custom = customPeriods.find((cp) => cp.label_month === key);
  if (custom) {
    return {
      from: custom.start_date,
      to: custom.end_date,
      isCustom: true,
    };
  }
  return {
    from: isoDate(periodStart(labelMonth, payDay)),
    to: isoDate(periodEnd(labelMonth, payDay)),
    isCustom: false,
  };
}

export function periodRangeTextWithCustom(
  labelMonth: Date,
  payDay: number,
  customPeriods: { label_month: string; start_date: string; end_date: string }[]
): string {
  const range = getPeriodRange(labelMonth, payDay, customPeriods);
  // Parse date strings in local time to avoid timezone offsets
  const parseLocalDate = (str: string) => {
    const [y, m, d] = str.split("-").map(Number);
    return new Date(y, m - 1, d);
  };
  const s = parseLocalDate(range.from);
  const e = parseLocalDate(range.to);
  const fmt = (d: Date, includeYear = false) =>
    `${d.getDate()} ${d.toLocaleDateString("id-ID", { month: "short" })}` +
    (includeYear ? ` ${d.getFullYear()}` : "");
  const sameYear = s.getFullYear() === e.getFullYear();
  return `${fmt(s, !sameYear)} - ${fmt(e, true)}`;
}


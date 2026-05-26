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

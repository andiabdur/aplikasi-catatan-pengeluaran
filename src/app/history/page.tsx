import { createClient } from "@/lib/supabase/server";
import { getCurrentHouseholdId } from "@/lib/supabase/household";
import { PageShell } from "@/components/page-shell";
import { HistoryList } from "@/components/history-list";
import { currentPeriodLabelWithCustom, labelMonthKey } from "@/lib/period";
import type { Category } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ cat?: string; period?: string }>;
}) {
  const supabase = await createClient();
  const householdId = await getCurrentHouseholdId();
  const params = await searchParams;

  const [catRes, hhRes, cpRes] = await Promise.all([
    supabase
      .from("categories")
      .select("*")
      .eq("household_id", householdId ?? "")
      .eq("is_archived", false)
      .order("sort_order"),
    supabase
      .from("households")
      .select("pay_day_of_month")
      .eq("id", householdId ?? "")
      .maybeSingle(),
    supabase
      .from("custom_periods")
      .select("label_month, start_date, end_date")
      .eq("household_id", householdId ?? ""),
  ]);

  const payDay = hhRes.data?.pay_day_of_month ?? 25;
  const customPeriods = cpRes.data ?? [];
  const defaultLabelMonth = labelMonthKey(currentPeriodLabelWithCustom(payDay, customPeriods));
  const initialLabelMonth = params.period ?? defaultLabelMonth;

  return (
    <PageShell title="Riwayat" subtitle="Filter, analisis, & cari">
      <HistoryList
        categories={(catRes.data ?? []) as Category[]}
        householdId={householdId ?? ""}
        payDay={payDay}
        initialLabelMonth={initialLabelMonth}
        initialCatFilter={params.cat ?? ""}
        customPeriods={customPeriods}
      />
    </PageShell>
  );
}


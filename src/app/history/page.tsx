import { createClient } from "@/lib/supabase/server";
import { getCurrentHouseholdId } from "@/lib/supabase/household";
import { PageShell } from "@/components/page-shell";
import { HistoryList } from "@/components/history-list";
import { currentPeriodLabel, labelMonthKey } from "@/lib/period";
import type { Category } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  const supabase = await createClient();
  const householdId = await getCurrentHouseholdId();

  const [catRes, hhRes] = await Promise.all([
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
  ]);

  const payDay = hhRes.data?.pay_day_of_month ?? 25;
  const initialLabelMonth = labelMonthKey(currentPeriodLabel(payDay));

  return (
    <PageShell title="Riwayat" subtitle="Filter, analisis, & cari">
      <HistoryList
        categories={(catRes.data ?? []) as Category[]}
        householdId={householdId ?? ""}
        payDay={payDay}
        initialLabelMonth={initialLabelMonth}
      />
    </PageShell>
  );
}

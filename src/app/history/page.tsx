import { createClient } from "@/lib/supabase/server";
import { getCurrentHouseholdId } from "@/lib/supabase/household";
import { PageShell } from "@/components/page-shell";
import { HistoryList } from "@/components/history-list";
import { currentPeriodLabelWithCustom, isoDate, labelMonthKey } from "@/lib/period";
import type { Category, Goal } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{
    cat?: string;
    period?: string;
    event?: string;
    evt?: string;
  }>;
}) {
  const supabase = await createClient();
  const householdId = await getCurrentHouseholdId();
  const params = await searchParams;

  const [catRes, hhRes, cpRes, evtRes, goalsRes, memRes] = householdId
    ? await Promise.all([
        supabase
          .from("categories")
          .select("*")
          .eq("household_id", householdId)
          .eq("is_archived", false)
          .order("sort_order"),
        supabase
          .from("households")
          .select("pay_day_of_month")
          .eq("id", householdId)
          .maybeSingle(),
        supabase
          .from("custom_periods")
          .select("label_month, start_date, end_date")
          .eq("household_id", householdId),
        supabase
          .from("events")
          .select("id, name, status, start_date, end_date")
          .eq("household_id", householdId)
          .order("start_date", { ascending: false }),
        supabase
          .from("goals")
          .select("id, name, emoji, color, status")
          .eq("household_id", householdId)
          .order("created_at"),
        supabase
          .from("household_members")
          .select("user_id, display_name")
          .eq("household_id", householdId)
          .order("joined_at", { ascending: true }),
      ])
    : [
        { data: [] },
        { data: null },
        { data: [] },
        { data: [] },
        { data: [] },
        { data: [] },
      ];

  const payDay = hhRes.data?.pay_day_of_month ?? 25;
  const customPeriods = cpRes.data ?? [];
  const today = new Date();
  const todayStr = isoDate(today);
  const defaultLabelMonth = labelMonthKey(
    currentPeriodLabelWithCustom(payDay, customPeriods, today)
  );
  const initialLabelMonth = params.period ?? defaultLabelMonth;
  const initialEvtFilter = params.event || params.evt || "";

  return (
    <PageShell title="Riwayat" subtitle="Cari, filter & eksplorasi transaksi">
      <HistoryList
        events={evtRes.data ?? []}
        goals={(goalsRes.data ?? []) as Goal[]}
        categories={(catRes.data ?? []) as Category[]}
        members={memRes.data ?? []}
        householdId={householdId ?? ""}
        payDay={payDay}
        todayStr={todayStr}
        defaultLabelMonth={defaultLabelMonth}
        initialLabelMonth={initialLabelMonth}
        initialCatFilter={params.cat ?? ""}
        initialEvtFilter={initialEvtFilter}
        customPeriods={customPeriods}
      />
    </PageShell>
  );
}

import { createClient } from "@/lib/supabase/server";
import { getCurrentHouseholdId } from "@/lib/supabase/household";
import { PageShell } from "@/components/page-shell";
import { AnalysisClient } from "@/components/analysis-client";
import { currentPeriodLabelWithCustom, isoDate, labelMonthKey } from "@/lib/period";
import type {
  AnalysisCategory,
  AnalysisEvent,
  AnalysisMember,
  CustomPeriodRange,
} from "@/lib/analysis";

export const dynamic = "force-dynamic";

export default async function AnalysisPage({
  searchParams,
}: {
  searchParams: Promise<{ event?: string }>;
}) {
  const supabase = await createClient();
  const householdId = await getCurrentHouseholdId();
  const params = await searchParams;

  const [hhRes, cpRes, catRes, evtRes, memRes] = householdId
    ? await Promise.all([
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
          .from("categories")
          .select("id, name, color, sort_order, is_archived")
          .eq("household_id", householdId)
          .order("sort_order"),
        supabase
          .from("events")
          .select("id, name, status, start_date, end_date")
          .eq("household_id", householdId)
          .order("start_date", { ascending: false }),
        supabase
          .from("household_members")
          .select("user_id, display_name")
          .eq("household_id", householdId)
          .order("joined_at", { ascending: true }),
      ])
    : [
        { data: null },
        { data: [] },
        { data: [] },
        { data: [] },
        { data: [] },
      ];

  const payDay = hhRes.data?.pay_day_of_month ?? 25;
  const customPeriods = (cpRes.data ?? []) as CustomPeriodRange[];
  const today = new Date();
  const todayStr = isoDate(today);
  const defaultLabelMonth = labelMonthKey(
    currentPeriodLabelWithCustom(payDay, customPeriods, today)
  );

  return (
    <PageShell
      title="Analisis Pengeluaran"
      subtitle="Eksplorasi tren, metrik & rincian belanja"
    >
      <AnalysisClient
        householdId={householdId ?? ""}
        payDay={payDay}
        todayStr={todayStr}
        defaultLabelMonth={defaultLabelMonth}
        customPeriods={customPeriods}
        categories={(catRes.data ?? []) as AnalysisCategory[]}
        events={(evtRes.data ?? []) as AnalysisEvent[]}
        members={(memRes.data ?? []) as AnalysisMember[]}
        initialEventId={params.event ?? null}
      />
    </PageShell>
  );
}

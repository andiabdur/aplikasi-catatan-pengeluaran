import { createClient } from "@/lib/supabase/server";
import { getCurrentHouseholdId } from "@/lib/supabase/household";
import { PageShell } from "@/components/page-shell";
import { DashboardClient } from "@/components/dashboard-client";
import { currentPeriodLabelWithCustom, labelMonthKey } from "@/lib/period";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createClient();
  const householdId = await getCurrentHouseholdId();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const displayName = user?.email?.split("@")[0] ?? "Keluarga";

  // Pull household's pay day & custom periods
  const [hhRes, cpRes] = await Promise.all([
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

  const initialLabel = labelMonthKey(currentPeriodLabelWithCustom(payDay, customPeriods));

  return (
    <PageShell title={`Hai, ${displayName} 👋`} subtitle="Ringkasan periode gajian">
      <DashboardClient
        householdId={householdId ?? ""}
        payDay={payDay}
        initialLabelMonth={initialLabel}
        customPeriods={customPeriods}
      />
    </PageShell>
  );
}


import { createClient } from "@/lib/supabase/server";
import { getCurrentHouseholdId } from "@/lib/supabase/household";
import { PageShell } from "@/components/page-shell";
import { DashboardClient } from "@/components/dashboard-client";
import { currentPeriodLabel, labelMonthKey } from "@/lib/period";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createClient();
  const householdId = await getCurrentHouseholdId();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const displayName = user?.email?.split("@")[0] ?? "Keluarga";

  // Pull household's pay day
  const { data: hh } = await supabase
    .from("households")
    .select("pay_day_of_month")
    .eq("id", householdId ?? "")
    .maybeSingle();
  const payDay = hh?.pay_day_of_month ?? 25;

  const initialLabel = labelMonthKey(currentPeriodLabel(payDay));

  return (
    <PageShell title={`Hai, ${displayName} 👋`} subtitle="Ringkasan periode gajian">
      <DashboardClient
        householdId={householdId ?? ""}
        payDay={payDay}
        initialLabelMonth={initialLabel}
      />
    </PageShell>
  );
}

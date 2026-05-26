import { createClient } from "@/lib/supabase/server";
import { getCurrentHouseholdId } from "@/lib/supabase/household";
import { PageShell } from "@/components/page-shell";
import { SettingsClient } from "@/components/settings-client";
import { currentPeriodLabel, labelMonthKey } from "@/lib/period";
import type { Category } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const supabase = await createClient();
  const householdId = await getCurrentHouseholdId();

  const [catRes, hhRes, userRes] = await Promise.all([
    supabase
      .from("categories")
      .select("*")
      .eq("household_id", householdId ?? "")
      .order("sort_order"),
    supabase
      .from("households")
      .select("id, pay_day_of_month")
      .eq("id", householdId ?? "")
      .maybeSingle(),
    supabase.auth.getUser(),
  ]);

  const payDay = hhRes.data?.pay_day_of_month ?? 25;
  const initialLabelMonth = labelMonthKey(currentPeriodLabel(payDay));

  return (
    <PageShell title="Pengaturan" subtitle="Periode, kategori, budget, income">
      <SettingsClient
        householdId={householdId ?? ""}
        categories={(catRes.data ?? []) as Category[]}
        payDay={payDay}
        initialLabelMonth={initialLabelMonth}
        email={userRes.data.user?.email ?? ""}
      />
    </PageShell>
  );
}

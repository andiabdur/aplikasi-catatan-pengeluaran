import { createClient } from "@/lib/supabase/server";
import { getCurrentHouseholdId } from "@/lib/supabase/household";
import { PageShell } from "@/components/page-shell";
import { SettingsClient } from "@/components/settings-client";
import { monthKey } from "@/lib/format";
import type { Category, Budget, Income } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const supabase = await createClient();
  const householdId = await getCurrentHouseholdId();
  const month = monthKey();

  const [catRes, budRes, incRes, userRes] = await Promise.all([
    supabase
      .from("categories")
      .select("*")
      .eq("household_id", householdId ?? "")
      .order("sort_order"),
    supabase
      .from("budgets")
      .select("*")
      .eq("household_id", householdId ?? "")
      .eq("month", month),
    supabase
      .from("incomes")
      .select("*")
      .eq("household_id", householdId ?? "")
      .eq("month", month),
    supabase.auth.getUser(),
  ]);

  return (
    <PageShell title="Pengaturan" subtitle="Kategori, budget, & income">
      <SettingsClient
        categories={(catRes.data ?? []) as Category[]}
        budgets={(budRes.data ?? []) as Budget[]}
        incomes={(incRes.data ?? []) as Income[]}
        month={month}
        email={userRes.data.user?.email ?? ""}
      />
    </PageShell>
  );
}

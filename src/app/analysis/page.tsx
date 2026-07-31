import { createClient } from "@/lib/supabase/server";
import { getCurrentHouseholdId } from "@/lib/supabase/household";
import { PageShell } from "@/components/page-shell";
import { AnalysisClient } from "@/components/analysis-client";

export const dynamic = "force-dynamic";

export default async function AnalysisPage() {
  const supabase = await createClient();
  const householdId = await getCurrentHouseholdId();

  return (
    <PageShell title="Analisis Pengeluaran" subtitle="Analisa pengeluaran temporal keluarga">
      <AnalysisClient householdId={householdId ?? ""} />
    </PageShell>
  );
}

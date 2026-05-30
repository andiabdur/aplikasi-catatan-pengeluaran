import { getCurrentHouseholdId } from "@/lib/supabase/household";
import { PageShell } from "@/components/page-shell";
import { AsistenClient } from "@/components/asisten-client";

export const dynamic = "force-dynamic";

export default async function AsistenPage() {
  const householdId = await getCurrentHouseholdId();
  return (
    <PageShell title="Asisten Keuangan ✨" subtitle="Analisa AI dari pola belanja keluarga">
      <AsistenClient householdId={householdId ?? ""} />
    </PageShell>
  );
}

import { getCurrentHouseholdId } from "@/lib/supabase/household";
import { PageShell } from "@/components/page-shell";
import { AsistenClient } from "@/components/asisten-client";

export const dynamic = "force-dynamic";

export default async function AsistenPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const householdId = await getCurrentHouseholdId();
  const { tab } = await searchParams;
  const initialTab = tab === "chat" ? "chat" : "analisa";

  return (
    <PageShell title="Asisten Keuangan" subtitle="Chat interaktif dan audit keuangan">
      <AsistenClient householdId={householdId ?? ""} initialTab={initialTab} />
    </PageShell>
  );
}

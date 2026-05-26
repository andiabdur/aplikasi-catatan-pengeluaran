import { createClient } from "@/lib/supabase/server";
import { PageShell } from "@/components/page-shell";
import { HistoryList } from "@/components/history-list";
import type { Category } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  const supabase = await createClient();
  const { data: cats } = await supabase
    .from("categories")
    .select("*")
    .eq("is_archived", false)
    .order("sort_order");

  return (
    <PageShell title="Riwayat" subtitle="Cari & filter pengeluaran">
      <HistoryList categories={(cats ?? []) as Category[]} />
    </PageShell>
  );
}

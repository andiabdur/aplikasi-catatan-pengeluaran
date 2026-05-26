import { createClient } from "@/lib/supabase/server";
import { PageShell } from "@/components/page-shell";
import { ExpenseForm } from "@/components/expense-form";
import type { Category } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AddPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("categories")
    .select("*")
    .eq("is_archived", false)
    .order("sort_order");

  // Most-used categories last 30 days
  const since = new Date();
  since.setDate(since.getDate() - 30);
  const { data: recent } = await supabase
    .from("expenses")
    .select("category_id")
    .gte("spent_at", since.toISOString().slice(0, 10));

  const counts = new Map<string, number>();
  (recent ?? []).forEach((r) =>
    counts.set(r.category_id, (counts.get(r.category_id) ?? 0) + 1),
  );
  const categories = (data ?? []) as Category[];
  const top = [...categories]
    .sort((a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0))
    .slice(0, 4)
    .filter((c) => (counts.get(c.id) ?? 0) > 0);

  return (
    <PageShell title="Catat Pengeluaran" subtitle="Form simpel, langsung kelar">
      <ExpenseForm categories={categories} topCategories={top} />
    </PageShell>
  );
}

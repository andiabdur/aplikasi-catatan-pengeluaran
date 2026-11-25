import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentHouseholdId } from "@/lib/supabase/household";
import { isoDate } from "@/lib/period";
import { PageShell } from "@/components/page-shell";
import {
  EventsList,
  type EventCategorySummary,
  type EventExpenseItem,
  type EventWithDetails,
} from "@/components/events-list";
import type { Event } from "@/lib/types";

export const dynamic = "force-dynamic";

type RawEventExpense = {
  id: string;
  event_id: string | null;
  amount: number;
  description: string;
  note: string | null;
  spent_at: string;
  categories: {
    name: string;
    color: string | null;
  } | null;
};

export default async function EventsPage() {
  const supabase = await createClient();
  const householdId = await getCurrentHouseholdId();
  if (!householdId) redirect("/login");

  const [eventsRes, hhRes, cpRes, expensesRes] = await Promise.all([
    supabase
      .from("events")
      .select("*")
      .eq("household_id", householdId)
      .order("start_date", { ascending: false }),
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
      .from("expenses")
      .select("id, event_id, amount, description, note, spent_at, categories(name, color)")
      .eq("household_id", householdId)
      .not("event_id", "is", null)
      .order("spent_at", { ascending: false }),
  ]);

  const payDay = hhRes.data?.pay_day_of_month ?? 25;
  const customPeriods = cpRes.data ?? [];
  const events = (eventsRes.data ?? []) as Event[];
  const rawExpenses = (expensesRes.data ?? []) as unknown as RawEventExpense[];
  const todayStr = isoDate(new Date());

  const expensesByEvent = new Map<string, EventExpenseItem[]>();
  const spentByEvent = new Map<string, number>();
  const catMapByEvent = new Map<
    string,
    Map<string, { color: string; amount: number; count: number }>
  >();

  for (const exp of rawExpenses) {
    if (!exp.event_id) continue;
    const amt = Number(exp.amount) || 0;
    const catName = exp.categories?.name || "Lainnya";
    const catColor = exp.categories?.color || "#B85138";

    spentByEvent.set(exp.event_id, (spentByEvent.get(exp.event_id) ?? 0) + amt);

    const list = expensesByEvent.get(exp.event_id) ?? [];
    list.push({
      id: exp.id,
      spent_at: exp.spent_at,
      description: exp.description,
      note: exp.note,
      amount: amt,
      categoryName: catName,
      categoryColor: catColor,
    });
    expensesByEvent.set(exp.event_id, list);

    let evtCats = catMapByEvent.get(exp.event_id);
    if (!evtCats) {
      evtCats = new Map();
      catMapByEvent.set(exp.event_id, evtCats);
    }
    const prevCat = evtCats.get(catName) ?? { color: catColor, amount: 0, count: 0 };
    evtCats.set(catName, {
      color: prevCat.color,
      amount: prevCat.amount + amt,
      count: prevCat.count + 1,
    });
  }

  const eventsWithDetails: EventWithDetails[] = events.map((evt) => {
    const totalSpent = spentByEvent.get(evt.id) ?? 0;
    const items = expensesByEvent.get(evt.id) ?? [];
    const catMap = catMapByEvent.get(evt.id);
    const categoryBreakdown: EventCategorySummary[] = catMap
      ? Array.from(catMap.entries())
          .map(([name, info]) => ({
            name,
            color: info.color,
            amount: info.amount,
            count: info.count,
            sharePct: totalSpent > 0 ? (info.amount / totalSpent) * 100 : 0,
          }))
          .sort((a, b) => b.amount - a.amount)
      : [];

    return {
      ...evt,
      totalSpent,
      txCount: items.length,
      categoryBreakdown,
      expenses: items,
    };
  });

  return (
    <PageShell
      title="Event & Perjalanan"
      subtitle="Kelola acara & perjalanan khusus"
    >
      <EventsList
        householdId={householdId}
        todayStr={todayStr}
        events={eventsWithDetails}
        payDay={payDay}
        customPeriods={customPeriods}
      />
    </PageShell>
  );
}

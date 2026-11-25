import { createClient } from "@/lib/supabase/server";
import { getCurrentHouseholdId } from "@/lib/supabase/household";
import { EventsList } from "@/components/events-list";
import { redirect } from "next/navigation";
import { createEvent } from "@/app/actions/events";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

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
      .select("event_id, amount")
      .eq("household_id", householdId)
      .not("event_id", "is", null),
  ]);

  const payDay = hhRes.data?.pay_day_of_month ?? 25;
  const customPeriods = cpRes.data ?? [];
  const events = eventsRes.data ?? [];
  const expenses = expensesRes.data ?? [];

  const spentByEvent = new Map<string, number>();
  for (const exp of expenses) {
    if (exp.event_id) {
      spentByEvent.set(exp.event_id, (spentByEvent.get(exp.event_id) || 0) + (exp.amount || 0));
    }
  }

  const eventsWithTotal = events.map((evt) => ({
    ...evt,
    totalSpent: spentByEvent.get(evt.id) || 0,
  }));

  return (
    <div className="container max-w-lg mx-auto p-4 pb-32 space-y-4">
      <div className="flex items-center gap-3">
        <Link
          href="/settings"
          aria-label="Kembali ke Pengaturan"
          className="w-10 h-10 bg-card border border-border rounded-xl flex items-center justify-center hover:bg-muted transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-lg font-semibold text-foreground tracking-tight">Event &amp; Perjalanan</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Kelola anggaran khusus liburan &amp; acara</p>
        </div>
      </div>

      <form action={async (formData) => { "use server"; await createEvent(formData); }} className="bg-card border border-border rounded-2xl p-4 space-y-3 shadow-sm">
        <h2 className="text-sm font-semibold text-foreground">Buat Event Baru</h2>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-foreground block mb-1.5">Nama Event</label>
            <input required name="name" type="text" placeholder="Misal: Liburan Bali, Renovasi Dapur" className="w-full min-h-[44px] bg-background border border-input px-3.5 py-2 rounded-xl text-base sm:text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
          </div>
          <div>
            <label className="text-xs font-semibold text-foreground block mb-1.5">Tanggal Mulai</label>
            <input required name="start_date" type="date" defaultValue={new Date().toISOString().split("T")[0]} className="w-full min-h-[44px] bg-background border border-input px-3.5 py-2 rounded-xl text-base sm:text-sm font-mono text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
          </div>
          <button type="submit" className="w-full min-h-[44px] py-2.5 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold text-sm rounded-xl shadow-sm active:scale-[0.98] transition-all">Tambah Event</button>
        </div>
      </form>

      <EventsList
        events={eventsWithTotal}
        payDay={payDay}
        customPeriods={customPeriods}
      />
    </div>
  );
}

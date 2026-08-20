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

  const { data: events } = await supabase
    .from("events")
    .select("*")
    .eq("household_id", householdId)
    .order("start_date", { ascending: false });

  const { data: expenses } = await supabase
    .from("expenses")
    .select("event_id, amount")
    .eq("household_id", householdId)
    .not("event_id", "is", null);
    
  const spentByEvent = new Map<string, number>();
  if (expenses) {
    for (const exp of expenses) {
      if (exp.event_id) {
        spentByEvent.set(exp.event_id, (spentByEvent.get(exp.event_id) || 0) + (exp.amount || 0));
      }
    }
  }

  // Extend events with totalSpent
  const eventsWithTotal = (events || []).map(evt => ({
    ...evt,
    totalSpent: spentByEvent.get(evt.id) || 0
  }));

  return (
    <div className="container max-w-lg mx-auto p-4 pb-32 space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/settings" className="p-2 neo-card hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
          <ArrowLeft className="w-5 h-5 text-slate-700 dark:text-slate-200" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">Event &amp; Perjalanan</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Kelola anggaran khusus liburan, renovasi, atau acara keluarga</p>
        </div>
      </div>

      <form action={async (formData) => { "use server"; await createEvent(formData); }} className="neo-card p-4 space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Buat Event Baru</h2>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">Nama Event</label>
            <input required name="name" type="text" placeholder="Misal: Liburan Bali, Renovasi Dapur" className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-3.5 py-2.5 rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-brand-500" />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">Tanggal Mulai</label>
            <input required name="start_date" type="date" defaultValue={new Date().toISOString().split("T")[0]} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-3.5 py-2.5 rounded-xl text-xs font-mono text-slate-900 dark:text-slate-100 focus:outline-none focus:border-brand-500" />
          </div>
          <button type="submit" className="btn-primary w-full py-3 rounded-xl font-bold text-sm shadow-sm">Tambah Event</button>
        </div>
      </form>

      <EventsList events={eventsWithTotal} />
    </div>
  );
}

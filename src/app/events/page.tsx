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

  return (
    <div className="container max-w-lg mx-auto p-4 pb-32">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/settings" className="p-2 -ml-2 text-foreground/60 hover:text-foreground transition rounded-full hover:bg-slate-100 dark:hover:bg-slate-800">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-xl font-bold">Daftar Event / Kegiatan</h1>
      </div>

      <form action={async (formData) => { "use server"; await createEvent(formData); }} className="mb-6 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
        <h2 className="font-semibold mb-3">Buat Event Baru</h2>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Nama Event</label>
            <input required name="name" type="text" placeholder="Mis. Liburan Bali" className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3 py-2 rounded-xl text-sm" />
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Tanggal Mulai</label>
            <input required name="start_date" type="date" defaultValue={new Date().toISOString().split("T")[0]} className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3 py-2 rounded-xl text-sm" />
          </div>
          <button type="submit" className="w-full py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-xl font-medium text-sm transition">Tambah Event</button>
        </div>
      </form>

      <EventsList events={events || []} />
    </div>
  );
}

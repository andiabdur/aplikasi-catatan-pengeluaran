"use client";

import { deleteEvent, finishEvent } from "@/app/actions/events";
import type { Event } from "@/lib/types";

import { formatIDR } from "@/lib/format";

type EventWithTotal = Event & { totalSpent?: number };

export function EventsList({ events }: { events: EventWithTotal[] }) {
  const handleFinish = async (id: string) => {
    if (!confirm("Selesaikan event ini?")) return;
    const endDate = new Date().toISOString().split("T")[0];
    await finishEvent(id, endDate);
  };

  const handleDelete = async (id: string) => {
    if (confirm("Hapus event? Data tidak akan terhapus, tapi pengeluaran tidak punya event lagi.")) {
        await deleteEvent(id);
    }
  };

  if (!events || !events.length) return <div className="p-4 text-center text-foreground/60 border border-slate-200 dark:border-slate-800 rounded-2xl">Belum ada event.</div>;

  return (
    <div className="space-y-4">
      {events.map(evt => (
        <div key={evt.id} className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
          <div>
            <h3 className="font-semibold text-lg">{evt.name}</h3>
            <p className="font-bold text-brand-600 dark:text-brand-400 mt-0.5 mb-1 text-base">{formatIDR(evt.totalSpent || 0)}</p>
            <p className="text-sm text-foreground/60">
              {new Date(evt.start_date).toLocaleDateString("id-ID")}
               {evt.end_date ? ` - ${new Date(evt.end_date).toLocaleDateString("id-ID")}` : " - Sekarang"}
            </p>
            <span className={`inline-block mt-2 text-xs px-2 py-1 rounded-full ${evt.status === 'active' ? 'bg-green-500/20 text-green-700 dark:text-green-300' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
              {evt.status === 'active' ? 'Sedang Berjalan' : 'Selesai'}
            </span>
          </div>
          <div className="flex gap-2">
             {evt.status === "active" && (
                <button onClick={() => handleFinish(evt.id)} className="px-3 py-1.5 text-sm bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition">
                  Akhiri
                </button>
             )}
             <button onClick={() => handleDelete(evt.id)} className="px-3 py-1.5 text-sm bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/20 transition rounded-lg">
               Hapus
             </button>
          </div>
        </div>
      ))}
    </div>
  );
}

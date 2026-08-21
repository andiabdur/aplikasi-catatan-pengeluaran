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

  if (!events || !events.length) {
    return (
      <div className="bg-white dark:bg-surface-dark border-4 border-slate-950 dark:border-slate-100 rounded-none p-8 text-center text-slate-500 font-mono text-xs uppercase shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
        Belum ada event yang dibuat.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {events.map((evt) => (
        <div
          key={evt.id}
          className="bg-white dark:bg-surface-dark border-4 border-slate-950 dark:border-slate-100 rounded-none p-4 flex flex-col sm:flex-row justify-between sm:items-center gap-3.5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)]"
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-headline font-bold text-sm text-slate-950 dark:text-slate-100 uppercase tracking-wider truncate">{evt.name}</h3>
              <span
                className={`text-[10px] font-headline font-bold px-2 py-0.5 rounded-none border-2 ${
                  evt.status === "active"
                    ? "bg-emerald-400 text-slate-950 border-slate-950 shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]"
                    : "bg-slate-200 text-slate-700 border-slate-950"
                }`}
              >
                {evt.status === "active" ? "Sedang Berjalan" : "Selesai"}
              </span>
            </div>
            <p className="font-headline font-black text-brand-600 dark:text-brand-400 text-lg mt-1">
              {formatIDR(evt.totalSpent || 0)}
            </p>
            <p className="text-xs font-mono text-slate-500 dark:text-slate-400 mt-0.5 uppercase">
              {new Date(evt.start_date).toLocaleDateString("id-ID")}
              {evt.end_date ? ` - ${new Date(evt.end_date).toLocaleDateString("id-ID")}` : " - Sekarang"}
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            {evt.status === "active" && (
              <button
                onClick={() => handleFinish(evt.id)}
                className="px-3.5 py-1.5 text-xs font-headline font-bold uppercase bg-brand-500 text-slate-950 border-2 border-slate-950 rounded-none hover:bg-brand-400 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all"
              >
                Akhiri
              </button>
            )}
            <button
              onClick={() => handleDelete(evt.id)}
              className="px-3.5 py-1.5 text-xs font-headline font-bold uppercase text-rose-700 dark:text-rose-300 bg-rose-100 dark:bg-rose-950/60 border-2 border-rose-600 rounded-none hover:bg-rose-200 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all"
            >
              Hapus
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

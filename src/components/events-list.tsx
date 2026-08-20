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
      <div className="neo-card p-8 text-center text-slate-500 dark:text-slate-400 text-sm">
        Belum ada event yang dibuat.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {events.map((evt) => (
        <div
          key={evt.id}
          className="neo-card p-4 flex flex-col sm:flex-row justify-between sm:items-center gap-3.5"
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 truncate">{evt.name}</h3>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  evt.status === "active"
                    ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700"
                }`}
              >
                {evt.status === "active" ? "Sedang Berjalan" : "Selesai"}
              </span>
            </div>
            <p className="font-mono font-bold text-brand-600 dark:text-brand-400 text-base mt-1">
              {formatIDR(evt.totalSpent || 0)}
            </p>
            <p className="text-xs font-mono text-slate-400 dark:text-slate-500 mt-0.5">
              {new Date(evt.start_date).toLocaleDateString("id-ID")}
              {evt.end_date ? ` - ${new Date(evt.end_date).toLocaleDateString("id-ID")}` : " - Sekarang"}
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            {evt.status === "active" && (
              <button
                onClick={() => handleFinish(evt.id)}
                className="px-3.5 py-1.5 text-xs font-bold bg-brand-500 text-slate-950 rounded-xl hover:bg-brand-400 transition shadow-sm"
              >
                Akhiri
              </button>
            )}
            <button
              onClick={() => handleDelete(evt.id)}
              className="px-3.5 py-1.5 text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/40 border border-rose-200 dark:border-rose-800 transition rounded-xl"
            >
              Hapus
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

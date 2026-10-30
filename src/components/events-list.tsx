"use client";

import { useState } from "react";
import Link from "next/link";
import { deleteEvent, updateEvent, finishEvent } from "@/app/actions/events";
import type { Event } from "@/lib/types";
import { formatIDR } from "@/lib/format";
import { currentPeriodLabelWithCustom, labelMonthKey } from "@/lib/period";
import { ArrowUpRight, Calendar, Check, Edit3, Loader2, Pencil, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";

type EventWithTotal = Event & { totalSpent?: number };

function formatDisplayDate(dateStr: string) {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function getEventPeriodKey(
  startDateStr: string,
  payDay: number,
  customPeriods: { label_month: string; start_date: string; end_date: string }[]
): string {
  const [y, m, d] = (startDateStr || "").split("-").map(Number);
  const targetDate = !isNaN(y) && !isNaN(m) && !isNaN(d) ? new Date(y, m - 1, d) : new Date();
  const periodDate = currentPeriodLabelWithCustom(payDay, customPeriods, targetDate);
  return labelMonthKey(periodDate);
}

export function EventsList({
  events,
  payDay = 25,
  customPeriods = [],
}: {
  events: EventWithTotal[];
  payDay?: number;
  customPeriods?: { label_month: string; start_date: string; end_date: string }[];
}) {
  const [editingEvent, setEditingEvent] = useState<EventWithTotal | null>(null);
  const [isFinishingMode, setIsFinishingMode] = useState(false);
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [status, setStatus] = useState<"active" | "completed">("active");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openEditModal = (evt: EventWithTotal) => {
    setEditingEvent(evt);
    setIsFinishingMode(false);
    setName(evt.name);
    setStartDate(evt.start_date || "");
    setEndDate(evt.end_date || "");
    setStatus(evt.status);
    setError(null);
  };

  const openFinishModal = (evt: EventWithTotal) => {
    setEditingEvent(evt);
    setIsFinishingMode(true);
    setName(evt.name);
    setStartDate(evt.start_date || "");
    // Default to today or existing end_date if present
    setEndDate(evt.end_date || new Date().toISOString().split("T")[0]);
    setStatus("completed");
    setError(null);
  };

  const closeEditModal = () => {
    setEditingEvent(null);
    setIsFinishingMode(false);
    setError(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEvent) return;
    setError(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Nama event tidak boleh kosong.");
      return;
    }
    if (!startDate) {
      setError("Tanggal mulai harus diisi.");
      return;
    }
    if (status === "completed") {
      if (!endDate) {
        setError("Tanggal selesai harus diisi jika status event selesai.");
        return;
      }
      if (endDate < startDate) {
        setError("Tanggal selesai tidak boleh sebelum tanggal mulai.");
        return;
      }
    }

    setSaving(true);
    try {
      const res = await updateEvent(editingEvent.id, {
        name: trimmedName,
        start_date: startDate,
        end_date: status === "completed" ? endDate : null,
        status,
      });

      if (res && res.error) {
        setError(res.error);
        setSaving(false);
        return;
      }

      setSaving(false);
      closeEditModal();
    } catch (err: any) {
      setError(err?.message || "Gagal menyimpan perubahan event.");
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Hapus event? Data transaksi pengeluaran tidak akan terhapus, tetapi tidak lagi bertaut ke event ini.")) {
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
      {events.map((evt) => {
        const periodKey = getEventPeriodKey(evt.start_date, payDay, customPeriods);
        const historyHref = `/history?event=${evt.id}&period=${periodKey}`;

        return (
          <div
            key={evt.id}
            className="bg-white dark:bg-surface-dark border-4 border-slate-950 dark:border-slate-100 rounded-none p-4 flex flex-col sm:flex-row justify-between sm:items-center gap-3.5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)] transition-all"
          >
            {/* Clickable info area directing to History */}
            <Link
              href={historyHref}
              className="min-w-0 flex-1 group block focus:outline-none"
              title="Klik untuk membuka riwayat transaksi event ini"
            >
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-headline font-bold text-sm text-slate-950 dark:text-slate-100 uppercase tracking-wider group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors flex items-center gap-1.5">
                  <span className="truncate">{evt.name}</span>
                  <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-brand-600 dark:group-hover:text-brand-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all shrink-0" />
                </h3>
                <span
                  className={cn(
                    "text-[10px] font-headline font-bold px-2 py-0.5 rounded-none border-2",
                    evt.status === "active"
                      ? "bg-emerald-400 text-slate-950 border-slate-950 shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]"
                      : "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-950 dark:border-slate-100"
                  )}
                >
                  {evt.status === "active" ? "Sedang Berjalan" : "Selesai"}
                </span>
              </div>
              <p className="font-headline font-black text-brand-600 dark:text-brand-400 text-lg mt-1">
                {formatIDR(evt.totalSpent || 0)}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <p className="text-xs font-mono text-slate-500 dark:text-slate-400 uppercase">
                  {formatDisplayDate(evt.start_date)}
                  {evt.end_date ? ` - ${formatDisplayDate(evt.end_date)}` : " - Sekarang"}
                </p>
                <span className="text-[10px] font-headline font-bold uppercase tracking-wider text-brand-600 dark:text-brand-400 group-hover:underline">
                  Lihat Riwayat &rsaquo;
                </span>
              </div>
            </Link>

            {/* Actions: Edit, Finish, Delete */}
            <div className="flex gap-2 shrink-0 items-center pt-2 sm:pt-0 border-t-2 sm:border-t-0 border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => openEditModal(evt)}
                className="px-3 py-1.5 text-xs font-headline font-bold uppercase bg-slate-100 dark:bg-slate-900 text-slate-950 dark:text-slate-100 border-2 border-slate-950 dark:border-slate-100 rounded-none hover:bg-slate-200 dark:hover:bg-slate-800 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,1)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all flex items-center gap-1"
                title="Edit data tanggal dan nama event"
              >
                <Pencil className="w-3.5 h-3.5" />
                Edit
              </button>

              {evt.status === "active" && (
                <button
                  type="button"
                  onClick={() => openFinishModal(evt)}
                  className="px-3.5 py-1.5 text-xs font-headline font-bold uppercase bg-brand-500 text-slate-950 border-2 border-slate-950 rounded-none hover:bg-brand-400 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all flex items-center gap-1"
                  title="Akhiri event dan tentukan tanggal selesai"
                >
                  <Check className="w-3.5 h-3.5" />
                  Akhiri
                </button>
              )}

              <button
                type="button"
                onClick={() => handleDelete(evt.id)}
                className="px-3 py-1.5 text-xs font-headline font-bold uppercase text-rose-700 dark:text-rose-300 bg-rose-100 dark:bg-rose-950/60 border-2 border-rose-600 rounded-none hover:bg-rose-200 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all flex items-center gap-1"
                title="Hapus event"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Hapus
              </button>
            </div>
          </div>
        );
      })}

      {/* Edit / Finish Event Modal */}
      {editingEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-surface-dark border-4 border-slate-950 dark:border-slate-100 w-full max-w-md p-5 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:shadow-[8px_8px_0px_0px_rgba(255,255,255,1)] space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b-2 border-slate-950 dark:border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-none bg-brand-400 text-slate-950 border-2 border-slate-950 flex items-center justify-center font-bold">
                  {isFinishingMode ? <Check className="w-5 h-5" /> : <Edit3 className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="font-headline font-black text-base uppercase tracking-wider text-slate-950 dark:text-slate-100">
                    {isFinishingMode ? "Akhiri Event" : "Edit Data Event"}
                  </h3>
                  <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                    {isFinishingMode
                      ? "Tentukan tanggal selesai jika baru sempat diakhiri sekarang"
                      : "Ubah nama, tanggal mulai, atau tanggal berakhir"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeEditModal}
                className="p-1 text-slate-600 hover:text-slate-950 dark:text-slate-400 dark:hover:text-slate-100 border border-transparent hover:border-slate-950"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {error && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/60 border-2 border-rose-600 text-rose-800 dark:text-rose-200 text-xs font-mono">
                {error}
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-3.5">
              <div>
                <label className="text-xs font-headline font-bold text-slate-950 dark:text-slate-100 uppercase tracking-wider block mb-1">
                  Nama Event
                </label>
                <input
                  required
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Misal: Liburan Bali"
                  className="w-full bg-slate-50 dark:bg-slate-950 border-2 border-slate-950 dark:border-slate-100 px-3.5 py-2.5 rounded-none text-xs font-headline font-bold uppercase text-slate-950 dark:text-slate-100 focus:outline-none shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                />
              </div>

              <div>
                <label className="text-xs font-headline font-bold text-slate-950 dark:text-slate-100 uppercase tracking-wider block mb-1">
                  Tanggal Mulai
                </label>
                <input
                  required
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border-2 border-slate-950 dark:border-slate-100 px-3.5 py-2.5 rounded-none text-xs font-mono font-bold text-slate-950 dark:text-slate-100 focus:outline-none shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                />
              </div>

              <div>
                <label className="text-xs font-headline font-bold text-slate-950 dark:text-slate-100 uppercase tracking-wider block mb-1">
                  Status Event
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setStatus("active");
                      setEndDate("");
                    }}
                    className={cn(
                      "py-2 text-xs font-headline font-bold uppercase border-2 border-slate-950 dark:border-slate-100 transition-all",
                      status === "active"
                        ? "bg-slate-950 text-white dark:bg-slate-100 dark:text-slate-950 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                        : "bg-white dark:bg-surface-dark text-slate-700 dark:text-slate-300"
                    )}
                  >
                    Sedang Berjalan
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setStatus("completed");
                      if (!endDate) {
                        setEndDate(new Date().toISOString().split("T")[0]);
                      }
                    }}
                    className={cn(
                      "py-2 text-xs font-headline font-bold uppercase border-2 border-slate-950 dark:border-slate-100 transition-all",
                      status === "completed"
                        ? "bg-slate-950 text-white dark:bg-slate-100 dark:text-slate-950 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                        : "bg-white dark:bg-surface-dark text-slate-700 dark:text-slate-300"
                    )}
                  >
                    Selesai
                  </button>
                </div>
              </div>

              {status === "completed" && (
                <div className="p-3 bg-amber-50 dark:bg-slate-900 border-2 border-slate-950 dark:border-slate-100 rounded-none space-y-1.5 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                  <label className="text-xs font-headline font-bold text-slate-950 dark:text-slate-100 uppercase tracking-wider block">
                    Tanggal Selesai
                  </label>
                  <input
                    required
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full bg-white dark:bg-slate-950 border-2 border-slate-950 dark:border-slate-100 px-3.5 py-2 rounded-none text-xs font-mono font-bold text-slate-950 dark:text-slate-100 focus:outline-none shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                  />
                  <p className="text-[11px] font-mono text-slate-600 dark:text-slate-400">
                    Bisa disesuaikan jika event sebenarnya sudah selesai beberapa hari yang lalu namun kelupaan diakhiri.
                  </p>
                </div>
              )}

              <div className="flex gap-2 pt-2 border-t-2 border-slate-950 dark:border-slate-100">
                <button
                  type="button"
                  onClick={closeEditModal}
                  disabled={saving}
                  className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-900 text-slate-950 dark:text-slate-100 font-headline font-bold uppercase text-xs rounded-none border-2 border-slate-950 dark:border-slate-100 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-2.5 bg-brand-500 text-slate-950 hover:bg-brand-400 font-headline font-black uppercase text-xs rounded-none border-2 border-slate-950 dark:border-slate-100 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Menyimpan...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      Simpan
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

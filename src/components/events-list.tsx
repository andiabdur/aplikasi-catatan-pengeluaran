"use client";

import { useState } from "react";
import Link from "next/link";
import { deleteEvent, updateEvent } from "@/app/actions/events";
import type { Event } from "@/lib/types";
import { formatIDR } from "@/lib/format";
import { currentPeriodLabelWithCustom, labelMonthKey } from "@/lib/period";
import { ArrowUpRight, Check, Edit3, Loader2, Pencil, Trash2, X } from "lucide-react";
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
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan perubahan event.");
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
      <div className="bg-card border border-border rounded-2xl p-8 text-center text-muted-foreground text-xs shadow-sm">
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
            className="bg-card border border-border rounded-2xl p-4 flex flex-col sm:flex-row justify-between sm:items-center gap-3.5 shadow-sm"
          >
            <Link
              href={historyHref}
              className="min-w-0 flex-1 group block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl"
              title="Klik untuk membuka riwayat transaksi event ini"
            >
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors flex items-center gap-1.5">
                  <span className="truncate">{evt.name}</span>
                  <ArrowUpRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                </h3>
                <span
                  className={cn(
                    "text-[11px] font-medium px-2 py-0.5 rounded-full border",
                    evt.status === "active"
                      ? "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-800/60"
                      : "bg-muted text-muted-foreground border-border"
                  )}
                >
                  {evt.status === "active" ? "Sedang berjalan" : "Selesai"}
                </span>
              </div>
              <p className="font-mono font-bold text-primary text-lg mt-1 tabular-nums">
                {formatIDR(evt.totalSpent || 0)}
              </p>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <p className="text-xs font-mono text-muted-foreground">
                  {formatDisplayDate(evt.start_date)}
                  {evt.end_date ? ` - ${formatDisplayDate(evt.end_date)}` : " - Sekarang"}
                </p>
                <span className="text-xs font-medium text-primary group-hover:underline">
                  Lihat riwayat &rsaquo;
                </span>
              </div>
            </Link>

            <div className="flex gap-2 shrink-0 items-center pt-2.5 sm:pt-0 border-t sm:border-t-0 border-border">
              <button
                type="button"
                onClick={() => openEditModal(evt)}
                className="min-h-[38px] px-3 py-1.5 text-xs font-medium bg-secondary text-secondary-foreground border border-border rounded-xl hover:bg-muted transition-colors flex items-center gap-1"
                title="Edit data tanggal dan nama event"
              >
                <Pencil className="w-3.5 h-3.5" />
                Edit
              </button>

              {evt.status === "active" && (
                <button
                  type="button"
                  onClick={() => openFinishModal(evt)}
                  className="min-h-[38px] px-3.5 py-1.5 text-xs font-semibold bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 shadow-sm transition-all flex items-center gap-1"
                  title="Akhiri event dan tentukan tanggal selesai"
                >
                  <Check className="w-3.5 h-3.5" />
                  Akhiri
                </button>
              )}

              <button
                type="button"
                onClick={() => handleDelete(evt.id)}
                className="min-h-[38px] px-3 py-1.5 text-xs font-medium text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 rounded-xl hover:bg-rose-600 hover:text-white transition-colors flex items-center gap-1"
                title="Hapus event"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Hapus
              </button>
            </div>
          </div>
        );
      })}

      {editingEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md p-5 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-accent text-primary flex items-center justify-center">
                  {isFinishingMode ? <Check className="w-5 h-5" /> : <Edit3 className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="font-semibold text-base text-foreground">
                    {isFinishingMode ? "Akhiri Event" : "Edit Data Event"}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {isFinishingMode
                      ? "Tentukan tanggal selesai jika baru sempat diakhiri sekarang"
                      : "Ubah nama, tanggal mulai, atau tanggal berakhir"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeEditModal}
                aria-label="Tutup modal"
                className="min-h-[36px] min-w-[36px] rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {error && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 rounded-xl text-rose-700 dark:text-rose-300 text-xs font-medium">
                {error}
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-3.5">
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1.5">
                  Nama Event
                </label>
                <input
                  required
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Misal: Liburan Bali"
                  className="w-full min-h-[44px] bg-background border border-input px-3.5 py-2 rounded-xl text-base sm:text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground block mb-1.5">
                  Tanggal Mulai
                </label>
                <input
                  required
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full min-h-[44px] bg-background border border-input px-3.5 py-2 rounded-xl text-base sm:text-sm font-mono text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground block mb-1.5">
                  Status Event
                </label>
                <div className="grid grid-cols-2 gap-1 p-1 bg-muted rounded-xl border border-border">
                  <button
                    type="button"
                    onClick={() => {
                      setStatus("active");
                      setEndDate("");
                    }}
                    className={cn(
                      "min-h-[38px] py-1.5 rounded-lg text-xs font-semibold transition-all",
                      status === "active"
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
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
                      "min-h-[38px] py-1.5 rounded-lg text-xs font-semibold transition-all",
                      status === "completed"
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Selesai
                  </button>
                </div>
              </div>

              {status === "completed" && (
                <div className="p-3 bg-muted/50 border border-border rounded-xl space-y-1.5">
                  <label className="text-xs font-semibold text-foreground block">
                    Tanggal Selesai
                  </label>
                  <input
                    required
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full min-h-[44px] bg-background border border-input px-3.5 py-2 rounded-xl text-base sm:text-sm font-mono text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                  <p className="text-xs text-muted-foreground">
                    Bisa disesuaikan jika event sebenarnya sudah selesai beberapa hari yang lalu namun kelupaan diakhiri.
                  </p>
                </div>
              )}

              <div className="flex gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={closeEditModal}
                  disabled={saving}
                  className="flex-1 min-h-[42px] py-2 bg-secondary text-secondary-foreground font-medium text-xs rounded-xl border border-border hover:bg-muted transition-colors disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 min-h-[42px] py-2 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold text-xs rounded-xl shadow-sm transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
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

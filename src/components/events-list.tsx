"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowUpRight,
  BarChart3,
  Calendar,
  Check,
  ChevronDown,
  ChevronUp,
  Edit3,
  Link2,
  Loader2,
  Pencil,
  Plus,
  Search,
  Tent,
  Trash2,
  Unlink,
  X,
} from "lucide-react";
import {
  createEvent,
  deleteEvent,
  linkExpensesToEvent,
  unlinkExpenseFromEvent,
  updateEvent,
} from "@/app/actions/events";
import { createClient } from "@/lib/supabase/client";
import { addDays, diffDaysInclusive, formatCompactIDR, parseLocalDate } from "@/lib/analysis";
import { formatIDR } from "@/lib/format";
import { currentPeriodLabelWithCustom, labelMonthKey } from "@/lib/period";
import type { Event } from "@/lib/types";
import { cn } from "@/lib/utils";

export type EventExpenseItem = {
  id: string;
  spent_at: string;
  description: string;
  note: string | null;
  amount: number;
  categoryName: string;
  categoryColor: string;
};

export type EventCategorySummary = {
  name: string;
  color: string;
  amount: number;
  count: number;
  sharePct: number;
};

export type EventWithDetails = Event & {
  totalSpent: number;
  txCount: number;
  categoryBreakdown: EventCategorySummary[];
  expenses: EventExpenseItem[];
};

type CandidateExpense = {
  id: string;
  spent_at: string;
  description: string;
  amount: number;
  categories: { name: string; color: string | null } | null;
};

type StatusTab = "all" | "active" | "completed";
type FormMode = "create" | "edit" | "finish";

const EVENT_SUGGESTIONS = [
  "Liburan Keluarga",
  "Mudik",
  "Renovasi Rumah",
  "Acara Keluarga",
  "Perjalanan Dinas",
];

function formatDisplayDate(dateStr: string): string {
  if (!dateStr) return "";
  const d = parseLocalDate(dateStr);
  return d.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatShortDate(dateStr: string): string {
  if (!dateStr) return "";
  const d = parseLocalDate(dateStr);
  return d.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
  });
}

function getEventPeriodKey(
  startDateStr: string,
  payDay: number,
  customPeriods: { label_month: string; start_date: string; end_date: string }[]
): string {
  const targetDate = startDateStr ? parseLocalDate(startDateStr) : new Date();
  const periodDate = currentPeriodLabelWithCustom(payDay, customPeriods, targetDate);
  return labelMonthKey(periodDate);
}

function computeDurationInfo(evt: EventWithDetails, todayStr: string): {
  daysCount: number;
  badgeText: string;
} {
  if (evt.status === "completed" && evt.end_date) {
    const days = diffDaysInclusive(evt.start_date, evt.end_date);
    return {
      daysCount: days,
      badgeText: `${days} hari`,
    };
  }
  if (evt.start_date > todayStr) {
    const diff = diffDaysInclusive(todayStr, evt.start_date) - 1;
    return {
      daysCount: 1,
      badgeText: diff === 1 ? "Mulai besok" : `Mulai ${diff} hari lagi`,
    };
  }
  const days = diffDaysInclusive(evt.start_date, todayStr);
  return {
    daysCount: days,
    badgeText: `Hari ke-${days}`,
  };
}

export function EventsList({
  householdId,
  todayStr,
  events,
  payDay = 25,
  customPeriods = [],
}: {
  householdId: string;
  todayStr: string;
  events: EventWithDetails[];
  payDay?: number;
  customPeriods?: { label_month: string; start_date: string; end_date: string }[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  // Filter & expand state
  const [statusTab, setStatusTab] = useState<StatusTab>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);
  const [detailSort, setDetailSort] = useState<"date" | "amount">("date");
  const [unlinkingId, setUnlinkingId] = useState<string | null>(null);

  // Create / Edit / Finish Modal state
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [formMode, setFormMode] = useState<FormMode>("create");
  const [editingEvent, setEditingEvent] = useState<EventWithDetails | null>(null);
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState(todayStr);
  const [endDate, setEndDate] = useState("");
  const [status, setStatus] = useState<"active" | "completed">("active");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Delete Confirm Modal state
  const [deleteTarget, setDeleteTarget] = useState<EventWithDetails | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Link Expenses Modal state
  const [linkingEvent, setLinkingEvent] = useState<EventWithDetails | null>(null);
  const [candidates, setCandidates] = useState<CandidateExpense[]>([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [expandedWindow, setExpandedWindow] = useState(false);
  const [candidateSearch, setCandidateSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [linkingSaving, setLinkingSaving] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  const activeCount = useMemo(
    () => events.filter((e) => e.status === "active").length,
    [events]
  );
  const completedCount = useMemo(
    () => events.filter((e) => e.status === "completed").length,
    [events]
  );
  const grandTotalSpent = useMemo(
    () => events.reduce((s, e) => s + e.totalSpent, 0),
    [events]
  );

  const visibleEvents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return events
      .filter((evt) => {
        if (statusTab !== "all" && evt.status !== statusTab) return false;
        if (q && !evt.name.toLowerCase().includes(q)) return false;
        return true;
      })
      .sort((a, b) => {
        if (a.status !== b.status) return a.status === "active" ? -1 : 1;
        return b.start_date.localeCompare(a.start_date);
      });
  }, [events, statusTab, searchQuery]);

  function openCreateModal() {
    setFormMode("create");
    setEditingEvent(null);
    setName("");
    setStartDate(todayStr);
    setEndDate("");
    setStatus("active");
    setFormError(null);
    setFormModalOpen(true);
  }

  function openEditModal(evt: EventWithDetails) {
    setFormMode("edit");
    setEditingEvent(evt);
    setName(evt.name);
    setStartDate(evt.start_date || todayStr);
    setEndDate(evt.end_date || "");
    setStatus(evt.status);
    setFormError(null);
    setFormModalOpen(true);
  }

  function openFinishModal(evt: EventWithDetails) {
    setFormMode("finish");
    setEditingEvent(evt);
    setName(evt.name);
    setStartDate(evt.start_date || todayStr);
    const defaultEnd = evt.end_date || (evt.start_date <= todayStr ? todayStr : evt.start_date);
    setEndDate(defaultEnd);
    setStatus("completed");
    setFormError(null);
    setFormModalOpen(true);
  }

  function closeFormModal() {
    if (saving) return;
    setFormModalOpen(false);
    setEditingEvent(null);
    setFormError(null);
  }

  async function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setFormError("Nama event wajib diisi.");
      return;
    }
    if (!startDate) {
      setFormError("Tanggal mulai wajib diisi.");
      return;
    }
    if (status === "completed") {
      if (!endDate) {
        setFormError("Tanggal selesai wajib diisi jika status event selesai.");
        return;
      }
      if (endDate < startDate) {
        setFormError("Tanggal selesai tidak boleh sebelum tanggal mulai.");
        return;
      }
    }

    setSaving(true);
    try {
      if (formMode === "create") {
        const fd = new FormData();
        fd.set("name", trimmedName);
        fd.set("start_date", startDate);
        fd.set("status", status);
        if (status === "completed" && endDate) {
          fd.set("end_date", endDate);
        }
        const res = await createEvent(fd);
        if (res && "error" in res && res.error) {
          setFormError(res.error);
          setSaving(false);
          return;
        }
      } else if (editingEvent) {
        const res = await updateEvent(editingEvent.id, {
          name: trimmedName,
          start_date: startDate,
          end_date: status === "completed" ? endDate : null,
          status,
        });
        if (res && "error" in res && res.error) {
          setFormError(res.error);
          setSaving(false);
          return;
        }
      }

      setSaving(false);
      setFormModalOpen(false);
      setEditingEvent(null);
      startTransition(() => router.refresh());
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Gagal menyimpan event.");
      setSaving(false);
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteEvent(deleteTarget.id);
      if (expandedEventId === deleteTarget.id) {
        setExpandedEventId(null);
      }
      setDeleteTarget(null);
      startTransition(() => router.refresh());
    } finally {
      setDeleting(false);
    }
  }

  async function handleUnlinkExpense(expenseId: string) {
    setUnlinkingId(expenseId);
    try {
      await unlinkExpenseFromEvent(expenseId);
      startTransition(() => router.refresh());
    } finally {
      setUnlinkingId(null);
    }
  }

  async function loadCandidateExpenses(evt: EventWithDetails, wideRange: boolean) {
    setLoadingCandidates(true);
    setLinkError(null);
    try {
      const supabase = createClient();
      const fromDate = wideRange
        ? addDays(todayStr, -30)
        : addDays(evt.start_date, -2);
      const toDate = wideRange
        ? todayStr
        : addDays(evt.end_date || todayStr, 2);

      const { data, error } = await supabase
        .from("expenses")
        .select("id, spent_at, description, amount, categories(name, color)")
        .eq("household_id", householdId)
        .is("event_id", null)
        .gte("spent_at", fromDate)
        .lte("spent_at", toDate)
        .order("spent_at", { ascending: false })
        .limit(120);

      if (error) {
        setLinkError(error.message);
        setCandidates([]);
      } else {
        setCandidates((data ?? []) as unknown as CandidateExpense[]);
      }
    } finally {
      setLoadingCandidates(false);
    }
  }

  function openLinkModal(evt: EventWithDetails) {
    setLinkingEvent(evt);
    setExpandedWindow(false);
    setCandidateSearch("");
    setSelectedIds(new Set());
    setLinkError(null);
    loadCandidateExpenses(evt, false);
  }

  function closeLinkModal() {
    if (linkingSaving) return;
    setLinkingEvent(null);
    setCandidates([]);
    setSelectedIds(new Set());
    setLinkError(null);
  }

  function toggleCandidate(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const filteredCandidates = useMemo(() => {
    const q = candidateSearch.trim().toLowerCase();
    if (!q) return candidates;
    return candidates.filter((c) => {
      const catName = c.categories?.name ?? "";
      return (
        (c.description || "").toLowerCase().includes(q) ||
        catName.toLowerCase().includes(q)
      );
    });
  }, [candidates, candidateSearch]);

  const selectedCandidateTotal = useMemo(() => {
    let sum = 0;
    for (const c of candidates) {
      if (selectedIds.has(c.id)) sum += Number(c.amount) || 0;
    }
    return sum;
  }, [candidates, selectedIds]);

  async function handleConfirmLink() {
    if (!linkingEvent || selectedIds.size === 0) return;
    setLinkingSaving(true);
    setLinkError(null);
    try {
      const res = await linkExpensesToEvent(linkingEvent.id, Array.from(selectedIds));
      if (res && "error" in res && res.error) {
        setLinkError(res.error);
        setLinkingSaving(false);
        return;
      }
      setLinkingSaving(false);
      closeLinkModal();
      startTransition(() => router.refresh());
    } catch (err: unknown) {
      setLinkError(err instanceof Error ? err.message : "Gagal menautkan transaksi.");
      setLinkingSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* A. Summary Header Card + Create Button */}
      <section className="bg-card border border-border rounded-2xl p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <Link
              href="/settings"
              aria-label="Kembali ke Pengaturan"
              className="w-10 h-10 bg-background border border-border rounded-xl flex items-center justify-center hover:bg-muted transition-colors shrink-0"
            >
              <ArrowLeft className="w-4 h-4 text-foreground" />
            </Link>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">
                Ringkasan Event
              </p>
              <p className="text-xs text-muted-foreground truncate">
                Pisahkan anggaran liburan &amp; acara
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={openCreateModal}
            className="min-h-[42px] px-3.5 py-2 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold text-xs rounded-xl shadow-sm active:scale-[0.98] transition-all flex items-center gap-1.5 shrink-0"
          >
            <Plus className="w-4 h-4" />
            Buat Event
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-xl bg-teal-50/70 dark:bg-teal-950/30 border border-teal-200/80 dark:border-teal-800/50 px-3 py-2">
            <p className="text-[11px] text-teal-800 dark:text-teal-300 font-medium">Berjalan</p>
            <p className="font-mono text-base font-bold text-teal-900 dark:text-teal-200 tabular-nums">
              {activeCount}
            </p>
          </div>
          <div className="rounded-xl bg-muted/60 border border-border px-3 py-2">
            <p className="text-[11px] text-muted-foreground font-medium">Selesai</p>
            <p className="font-mono text-base font-bold text-foreground tabular-nums">
              {completedCount}
            </p>
          </div>
          <div className="rounded-xl bg-accent/70 border border-brand-200/80 dark:border-brand-800/40 px-3 py-2">
            <p className="text-[11px] text-accent-foreground font-medium">Total Event</p>
            <p className="font-mono text-sm font-bold text-foreground truncate tabular-nums">
              {formatCompactIDR(grandTotalSpent)}
            </p>
          </div>
        </div>
      </section>

      {/* B. Status Filter Tabs & Quick Search */}
      {events.length > 0 && (
        <section className="space-y-2.5">
          <div className="grid grid-cols-3 gap-1 p-1 bg-muted rounded-xl border border-border">
            {[
              { id: "all" as const, label: `Semua (${events.length})` },
              { id: "active" as const, label: `Berjalan (${activeCount})` },
              { id: "completed" as const, label: `Selesai (${completedCount})` },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusTab(tab.id)}
                className={cn(
                  "min-h-[36px] rounded-lg text-xs font-semibold transition-all truncate px-1",
                  statusTab === tab.id
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {events.length >= 3 && (
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari nama event atau perjalanan..."
                className="w-full min-h-[42px] bg-card border border-input rounded-xl pl-10 pr-9 py-2 text-base sm:text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              {searchQuery && (
                <button
                  type="button"
                  aria-label="Hapus pencarian event"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full hover:bg-muted flex items-center justify-center text-muted-foreground"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
        </section>
      )}

      {/* C. Event Cards */}
      {events.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-8 text-center shadow-sm space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-accent text-primary flex items-center justify-center mx-auto">
            <Tent className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">Belum ada event tercatat</p>
            <p className="text-xs text-muted-foreground max-w-xs mx-auto">
              Buat event untuk memisahkan biaya liburan, mudik, atau acara keluarga dari belanja harian.
            </p>
          </div>
          <button
            type="button"
            onClick={openCreateModal}
            className="min-h-[42px] px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold rounded-xl shadow-sm inline-flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            Buat Event Pertama
          </button>
        </div>
      ) : visibleEvents.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-6 text-center text-xs text-muted-foreground shadow-sm space-y-2">
          <p>Tidak ada event yang cocok dengan filter saat ini.</p>
          <button
            type="button"
            onClick={() => {
              setStatusTab("all");
              setSearchQuery("");
            }}
            className="text-xs font-semibold text-primary hover:underline"
          >
            Tampilkan Semua Event
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {visibleEvents.map((evt) => {
            const periodKey = getEventPeriodKey(evt.start_date, payDay, customPeriods);
            const historyHref = `/history?event=${evt.id}&period=${periodKey}`;
            const analysisHref = `/analysis?event=${evt.id}`;
            const addHref = `/add?event=${evt.id}`;
            const duration = computeDurationInfo(evt, todayStr);
            const dailyAvg = evt.totalSpent / Math.max(1, duration.daysCount);
            const isExpanded = expandedEventId === evt.id;

            const sortedExpenses =
              detailSort === "amount"
                ? evt.expenses.slice().sort((a, b) => b.amount - a.amount)
                : evt.expenses;

            return (
              <article
                key={evt.id}
                className="bg-card border border-border rounded-2xl p-4 shadow-sm space-y-3"
              >
                {/* Header & Totals */}
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h3 className="font-semibold text-sm text-foreground break-words">
                          {evt.name}
                        </h3>
                        <span
                          className={cn(
                            "text-[10px] font-semibold px-2 py-0.5 rounded-full border",
                            evt.status === "active"
                              ? "bg-teal-50 text-teal-800 border-teal-200 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-800/60"
                              : "bg-muted text-muted-foreground border-border"
                          )}
                        >
                          {evt.status === "active" ? "Sedang Berjalan" : "Selesai"}
                        </span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground border border-border">
                          {duration.badgeText}
                        </span>
                      </div>

                      <p className="text-xs font-mono text-muted-foreground mt-1 flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 shrink-0" />
                        <span>
                          {formatDisplayDate(evt.start_date)}
                          {evt.end_date ? ` - ${formatDisplayDate(evt.end_date)}` : " - Sekarang"}
                        </span>
                      </p>
                    </div>
                  </div>

                  {/* Cost & Stats Row */}
                  <div className="flex items-baseline justify-between gap-2 pt-0.5">
                    <p className="font-mono font-bold text-xl text-primary tabular-nums">
                      {formatIDR(evt.totalSpent)}
                    </p>
                    <p className="text-xs font-mono text-muted-foreground shrink-0 tabular-nums">
                      {evt.txCount} item &middot; {formatCompactIDR(dailyAvg)}/hr
                    </p>
                  </div>

                  {/* Mini Category Proportion Bar + Top 3 Chips */}
                  {evt.categoryBreakdown.length > 0 && (
                    <div className="space-y-1.5 pt-0.5">
                      <div className="h-2 w-full rounded-full overflow-hidden flex bg-muted gap-[1px]">
                        {evt.categoryBreakdown.map((cat) => (
                          <div
                            key={cat.name}
                            style={{
                              width: `${Math.max(4, cat.sharePct)}%`,
                              backgroundColor: cat.color,
                            }}
                            title={`${cat.name}: ${formatIDR(cat.amount)}`}
                          />
                        ))}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {evt.categoryBreakdown.slice(0, 3).map((cat) => (
                          <span
                            key={cat.name}
                            className="inline-flex items-center gap-1 text-[11px] text-muted-foreground"
                          >
                            <span
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ backgroundColor: cat.color }}
                            />
                            <span className="truncate max-w-[100px]">{cat.name}</span>
                            <span className="font-mono text-foreground font-medium tabular-nums">
                              {cat.sharePct.toFixed(0)}%
                            </span>
                          </span>
                        ))}
                        {evt.categoryBreakdown.length > 3 && (
                          <span className="text-[11px] text-muted-foreground">
                            +{evt.categoryBreakdown.length - 3} pos
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Primary Quick Actions */}
                <div className="flex items-center gap-1.5 pt-2 border-t border-border flex-wrap">
                  {evt.status === "active" ? (
                    <Link
                      href={addHref}
                      className="min-h-[38px] px-3 py-1.5 text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl shadow-sm transition-all inline-flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Catat
                    </Link>
                  ) : (
                    <Link
                      href={analysisHref}
                      className="min-h-[38px] px-3 py-1.5 text-xs font-semibold bg-accent text-accent-foreground border border-brand-200 dark:border-brand-800/50 rounded-xl hover:bg-accent/80 transition-colors inline-flex items-center gap-1"
                    >
                      <BarChart3 className="w-3.5 h-3.5" />
                      Analisis
                    </Link>
                  )}

                  {evt.status === "active" && (
                    <button
                      type="button"
                      onClick={() => openFinishModal(evt)}
                      className="min-h-[38px] px-3 py-1.5 text-xs font-semibold bg-teal-50 text-teal-800 border border-teal-200 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-800/60 rounded-xl hover:opacity-90 transition-opacity inline-flex items-center gap-1"
                    >
                      <Check className="w-3.5 h-3.5" />
                      Akhiri
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => openEditModal(evt)}
                    className="min-h-[38px] px-2.5 py-1.5 text-xs font-medium bg-secondary text-secondary-foreground border border-border rounded-xl hover:bg-muted transition-colors inline-flex items-center gap-1"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    Edit
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setExpandedEventId((prev) => (prev === evt.id ? null : evt.id))
                    }
                    className={cn(
                      "min-h-[38px] px-2.5 py-1.5 text-xs font-medium rounded-xl border transition-colors inline-flex items-center gap-1 ml-auto",
                      isExpanded
                        ? "bg-foreground text-background border-foreground"
                        : "bg-background text-foreground border-border hover:bg-muted"
                    )}
                  >
                    Rincian
                    {isExpanded ? (
                      <ChevronUp className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>

                {/* D. Expandable Inline Detail Drawer */}
                {isExpanded && (
                  <div className="pt-3 border-t border-border space-y-3.5 animate-slide-up">
                    {/* Link Missing Expenses Action */}
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => openLinkModal(evt)}
                        className="min-h-[36px] px-3 py-1.5 rounded-xl bg-accent text-accent-foreground border border-brand-200 dark:border-brand-800/50 text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-accent/80 transition-colors"
                      >
                        <Link2 className="w-3.5 h-3.5" />
                        Tautkan Transaksi Terlupa
                      </button>

                      <div className="flex items-center gap-3 text-xs">
                        <Link
                          href={historyHref}
                          className="font-medium text-primary hover:underline inline-flex items-center gap-0.5"
                        >
                          Riwayat <ArrowUpRight className="w-3.5 h-3.5" />
                        </Link>
                        {evt.status === "active" && (
                          <Link
                            href={analysisHref}
                            className="font-medium text-muted-foreground hover:text-foreground inline-flex items-center gap-0.5"
                          >
                            Analisis <ArrowUpRight className="w-3.5 h-3.5" />
                          </Link>
                        )}
                      </div>
                    </div>

                    {/* Category Breakdown */}
                    {evt.categoryBreakdown.length > 0 && (
                      <div className="rounded-xl bg-muted/40 border border-border p-3 space-y-2">
                        <p className="text-[11px] font-semibold text-muted-foreground">
                          Komposisi Pengeluaran Event
                        </p>
                        <div className="space-y-1.5">
                          {evt.categoryBreakdown.map((cat) => (
                            <div key={cat.name} className="space-y-1">
                              <div className="flex items-center justify-between gap-2 text-xs">
                                <span className="flex items-center gap-1.5 min-w-0">
                                  <span
                                    className="w-2 h-2 rounded-full shrink-0"
                                    style={{ backgroundColor: cat.color }}
                                  />
                                  <span className="font-medium text-foreground truncate">
                                    {cat.name}
                                  </span>
                                  <span className="text-[10px] text-muted-foreground">
                                    ({cat.count}x)
                                  </span>
                                </span>
                                <span className="font-mono font-semibold text-foreground shrink-0 tabular-nums">
                                  {formatIDR(cat.amount)}
                                </span>
                              </div>
                              <div className="h-1 w-full bg-muted rounded-full overflow-hidden">
                                <div
                                  className="h-full rounded-full"
                                  style={{
                                    width: `${cat.sharePct}%`,
                                    backgroundColor: cat.color,
                                  }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Event Transactions List */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold text-foreground">
                          Transaksi ({evt.txCount})
                        </p>
                        {evt.txCount > 1 && (
                          <div className="flex gap-1 p-0.5 bg-muted rounded-lg">
                            <button
                              type="button"
                              onClick={() => setDetailSort("date")}
                              className={cn(
                                "px-2 py-0.5 rounded-md text-[11px] font-medium",
                                detailSort === "date"
                                  ? "bg-card text-foreground shadow-sm"
                                  : "text-muted-foreground"
                              )}
                            >
                              Terbaru
                            </button>
                            <button
                              type="button"
                              onClick={() => setDetailSort("amount")}
                              className={cn(
                                "px-2 py-0.5 rounded-md text-[11px] font-medium",
                                detailSort === "amount"
                                  ? "bg-card text-foreground shadow-sm"
                                  : "text-muted-foreground"
                              )}
                            >
                              Terbesar
                            </button>
                          </div>
                        )}
                      </div>

                      {sortedExpenses.length === 0 ? (
                        <p className="text-xs text-muted-foreground py-3 text-center border border-dashed border-border rounded-xl">
                          Belum ada transaksi bertaut ke event ini. Gunakan tombol &quot;Catat&quot; atau &quot;Tautkan Transaksi Terlupa&quot;.
                        </p>
                      ) : (
                        <div className="space-y-1.5 max-h-64 overflow-y-auto pr-0.5">
                          {sortedExpenses.map((exp) => (
                            <div
                              key={exp.id}
                              className="flex items-center justify-between gap-2 bg-background border border-border rounded-xl px-3 py-2 text-xs"
                            >
                              <div className="min-w-0 flex-1">
                                <p className="font-medium text-foreground truncate">
                                  {exp.description || "Tanpa deskripsi"}
                                </p>
                                <p className="text-[11px] text-muted-foreground truncate">
                                  {exp.categoryName} &middot; {formatShortDate(exp.spent_at)}
                                </p>
                              </div>
                              <span className="font-mono font-semibold text-foreground shrink-0 tabular-nums">
                                {formatIDR(exp.amount)}
                              </span>
                              <button
                                type="button"
                                disabled={unlinkingId === exp.id}
                                onClick={() => handleUnlinkExpense(exp.id)}
                                title="Lepas transaksi ini dari event"
                                aria-label={`Lepas ${exp.description} dari event`}
                                className="w-7 h-7 rounded-lg text-muted-foreground hover:text-rose-700 hover:bg-rose-50 dark:hover:text-rose-300 dark:hover:bg-rose-950/40 flex items-center justify-center shrink-0 transition-colors disabled:opacity-50"
                              >
                                {unlinkingId === exp.id ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Unlink className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Delete Event safely tucked inside details */}
                    <div className="pt-2 border-t border-border flex justify-end">
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(evt)}
                        className="min-h-[36px] px-3 py-1.5 text-xs font-medium text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors inline-flex items-center gap-1.5"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Hapus Event Ini
                      </button>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {/* E1. Modal Create / Edit / Finish Event */}
      {formModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md p-5 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-accent text-primary flex items-center justify-center">
                  {formMode === "create" ? (
                    <Plus className="w-5 h-5" />
                  ) : formMode === "finish" ? (
                    <Check className="w-5 h-5" />
                  ) : (
                    <Edit3 className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <h3 className="font-semibold text-base text-foreground">
                    {formMode === "create"
                      ? "Buat Event Baru"
                      : formMode === "finish"
                        ? "Akhiri Event"
                        : "Edit Data Event"}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {formMode === "create"
                      ? "Kelompokkan biaya acara atau perjalanan"
                      : formMode === "finish"
                        ? "Tentukan tanggal selesai aktual"
                        : "Ubah nama, tanggal mulai, atau status"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeFormModal}
                aria-label="Tutup modal"
                className="min-h-[36px] min-w-[36px] rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 rounded-xl text-rose-700 dark:text-rose-300 text-xs font-medium">
                {formError}
              </div>
            )}

            <form onSubmit={handleFormSubmit} className="space-y-3.5">
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1.5">
                  Nama Event
                </label>
                <input
                  required
                  type="text"
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Misal: Liburan Bali, Renovasi Dapur"
                  className="w-full min-h-[44px] bg-background border border-input px-3.5 py-2 rounded-xl text-base sm:text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                {formMode === "create" && (
                  <div className="flex gap-1.5 flex-wrap mt-2">
                    {EVENT_SUGGESTIONS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setName(s)}
                        className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-secondary text-secondary-foreground border border-border hover:bg-muted transition-colors"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}
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
                        setEndDate(startDate <= todayStr ? todayStr : startDate);
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
                    Bisa disesuaikan ke tanggal akhir sebenarnya jika event sudah lewat beberapa hari.
                  </p>
                </div>
              )}

              <div className="flex gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={closeFormModal}
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
                      {formMode === "create" ? "Simpan Event" : "Simpan"}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* E2. Modal Link Forgotten Expenses */}
      {linkingEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md p-5 shadow-xl space-y-3.5 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-border pb-3 shrink-0">
              <div className="min-w-0 pr-2">
                <h3 className="font-semibold text-base text-foreground truncate">
                  Tautkan Transaksi ke Event
                </h3>
                <p className="text-xs text-muted-foreground truncate">
                  {linkingEvent.name}
                </p>
              </div>
              <button
                type="button"
                onClick={closeLinkModal}
                aria-label="Tutup modal tautkan"
                className="min-h-[36px] min-w-[36px] rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {linkError && (
              <div className="p-2.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 rounded-xl text-rose-700 dark:text-rose-300 text-xs font-medium shrink-0">
                {linkError}
              </div>
            )}

            <div className="flex items-center gap-2 shrink-0">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <input
                  type="text"
                  value={candidateSearch}
                  onChange={(e) => setCandidateSearch(e.target.value)}
                  placeholder="Cari transaksi..."
                  className="w-full min-h-[40px] bg-background border border-input rounded-xl pl-9 pr-3 py-1.5 text-base sm:text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  const nextWide = !expandedWindow;
                  setExpandedWindow(nextWide);
                  loadCandidateExpenses(linkingEvent, nextWide);
                }}
                className={cn(
                  "min-h-[40px] px-2.5 rounded-xl text-[11px] font-medium border whitespace-nowrap transition-colors",
                  expandedWindow
                    ? "bg-accent text-accent-foreground border-primary/40"
                    : "bg-background text-muted-foreground border-border hover:text-foreground"
                )}
              >
                {expandedWindow ? "Rentang Event" : "30 Hari Terakhir"}
              </button>
            </div>

            <div className="flex-1 min-h-[160px] max-h-[320px] overflow-y-auto space-y-1.5 pr-1">
              {loadingCandidates ? (
                <div className="py-10 flex items-center justify-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Memuat transaksi tanpa event...
                </div>
              ) : filteredCandidates.length === 0 ? (
                <div className="py-8 text-center text-xs text-muted-foreground border border-dashed border-border rounded-xl px-3 space-y-1.5">
                  <p>Tidak ada transaksi tanpa event pada rentang tanggal ini.</p>
                  {!expandedWindow && (
                    <button
                      type="button"
                      onClick={() => {
                        setExpandedWindow(true);
                        loadCandidateExpenses(linkingEvent, true);
                      }}
                      className="text-xs font-semibold text-primary hover:underline"
                    >
                      Coba cari di 30 hari terakhir
                    </button>
                  )}
                </div>
              ) : (
                filteredCandidates.map((c) => {
                  const checked = selectedIds.has(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => toggleCandidate(c.id)}
                      className={cn(
                        "w-full flex items-center justify-between gap-2.5 p-2.5 rounded-xl border text-left transition-colors",
                        checked
                          ? "bg-accent/70 border-primary/50"
                          : "bg-background border-border hover:bg-muted/40"
                      )}
                    >
                      <span
                        className={cn(
                          "w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors",
                          checked
                            ? "bg-primary border-primary text-primary-foreground"
                            : "border-input bg-card"
                        )}
                      >
                        {checked && <Check className="w-3.5 h-3.5" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-foreground truncate">
                          {c.description || "Tanpa deskripsi"}
                        </p>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {c.categories?.name ?? "Lainnya"} &middot; {formatShortDate(c.spent_at)}
                        </p>
                      </div>
                      <span className="font-mono text-xs font-bold text-foreground shrink-0 tabular-nums">
                        {formatIDR(c.amount)}
                      </span>
                    </button>
                  );
                })
              )}
            </div>

            <div className="pt-3 border-t border-border space-y-2.5 shrink-0">
              {selectedIds.size > 0 && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    Terpilih {selectedIds.size} item
                  </span>
                  <span className="font-mono font-bold text-primary tabular-nums">
                    +{formatIDR(selectedCandidateTotal)}
                  </span>
                </div>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={closeLinkModal}
                  disabled={linkingSaving}
                  className="flex-1 min-h-[42px] py-2 bg-secondary text-secondary-foreground font-medium text-xs rounded-xl border border-border hover:bg-muted transition-colors disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={linkingSaving || selectedIds.size === 0}
                  onClick={handleConfirmLink}
                  className="flex-1 min-h-[42px] py-2 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold text-xs rounded-xl shadow-sm transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {linkingSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Menautkan...
                    </>
                  ) : (
                    <>
                      <Link2 className="w-4 h-4" />
                      Tautkan ({selectedIds.size})
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* E3. Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl w-full max-w-sm p-5 shadow-xl space-y-4">
            <div className="space-y-1.5">
              <h3 className="font-semibold text-base text-foreground">
                Hapus Event &quot;{deleteTarget.name}&quot;?
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Transaksi pengeluaran di dalamnya tidak akan terhapus, tetapi tautannya ke event ini akan dilepas.
              </p>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setDeleteTarget(null)}
                className="flex-1 min-h-[42px] py-2 bg-secondary text-secondary-foreground font-medium text-xs rounded-xl border border-border hover:bg-muted transition-colors disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleConfirmDelete}
                className="flex-1 min-h-[42px] py-2 bg-destructive text-destructive-foreground hover:bg-destructive/90 font-semibold text-xs rounded-xl shadow-sm transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {deleting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Menghapus...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Hapus Event
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

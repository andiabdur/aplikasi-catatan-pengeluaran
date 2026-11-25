"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentHouseholdId } from "@/lib/supabase/household";
import { isoDate } from "@/lib/period";
import { revalidatePath } from "next/cache";

function revalidateEventPaths() {
  revalidatePath("/events");
  revalidatePath("/settings");
  revalidatePath("/history");
  revalidatePath("/add");
  revalidatePath("/analysis");
  revalidatePath("/");
}

export async function createEvent(formData: FormData) {
  const supabase = await createClient();
  const householdId = await getCurrentHouseholdId();
  if (!householdId) return { error: "Household belum dipilih." };

  const name = (formData.get("name") as string | null)?.trim() ?? "";
  const start_date = (formData.get("start_date") as string | null)?.trim() ?? "";
  const rawStatus = (formData.get("status") as string | null)?.trim() ?? "active";
  const rawEndDate = (formData.get("end_date") as string | null)?.trim() ?? "";

  if (!name) return { error: "Nama event wajib diisi." };
  if (!start_date) return { error: "Tanggal mulai wajib diisi." };

  const status: "active" | "completed" =
    rawStatus === "completed" ? "completed" : "active";

  if (status === "completed") {
    if (!rawEndDate) {
      return { error: "Tanggal selesai wajib diisi jika status selesai." };
    }
    if (rawEndDate < start_date) {
      return { error: "Tanggal selesai tidak boleh sebelum tanggal mulai." };
    }
  }

  const { error } = await supabase.from("events").insert({
    household_id: householdId,
    name,
    start_date,
    end_date: status === "completed" ? rawEndDate : null,
    status,
  });

  if (error) return { error: error.message };

  revalidateEventPaths();
  return { success: true };
}

export async function updateEvent(
  eventId: string,
  data: {
    name?: string;
    start_date?: string;
    end_date?: string | null;
    status?: "active" | "completed";
  }
) {
  const supabase = await createClient();
  const householdId = await getCurrentHouseholdId();
  if (!householdId) return { error: "Household belum dipilih." };

  const updates: {
    name?: string;
    start_date?: string;
    end_date?: string | null;
    status?: "active" | "completed";
  } = {};

  if (typeof data.name === "string" && data.name.trim()) {
    updates.name = data.name.trim();
  }
  if (data.start_date) {
    updates.start_date = data.start_date;
  }
  if (data.end_date !== undefined) {
    updates.end_date = data.end_date ? data.end_date : null;
  }
  if (data.status) {
    updates.status = data.status;
  } else if (data.end_date) {
    updates.status = "completed";
  } else if (data.end_date === null) {
    updates.status = "active";
  }

  const { error } = await supabase
    .from("events")
    .update(updates)
    .eq("id", eventId)
    .eq("household_id", householdId);

  if (error) return { error: error.message };

  revalidateEventPaths();
  return { success: true };
}

export async function finishEvent(eventId: string, end_date?: string) {
  const supabase = await createClient();
  const householdId = await getCurrentHouseholdId();
  if (!householdId) return { error: "Household belum dipilih." };

  const resolvedEndDate = end_date || isoDate(new Date());

  const { error } = await supabase
    .from("events")
    .update({ status: "completed", end_date: resolvedEndDate })
    .eq("id", eventId)
    .eq("household_id", householdId);

  if (error) return { error: error.message };

  revalidateEventPaths();
  return { success: true };
}

export async function deleteEvent(eventId: string) {
  const supabase = await createClient();
  const householdId = await getCurrentHouseholdId();
  if (!householdId) return { error: "Household belum dipilih." };

  const { error } = await supabase
    .from("events")
    .delete()
    .eq("id", eventId)
    .eq("household_id", householdId);

  if (error) return { error: error.message };

  revalidateEventPaths();
  return { success: true };
}

export async function linkExpensesToEvent(eventId: string, expenseIds: string[]) {
  const supabase = await createClient();
  const householdId = await getCurrentHouseholdId();
  if (!householdId) return { error: "Household belum dipilih." };

  const uniqueIds = Array.from(new Set(expenseIds.filter(Boolean)));
  if (uniqueIds.length === 0) {
    return { error: "Pilih minimal satu transaksi untuk ditautkan." };
  }

  const { data: evt, error: evtErr } = await supabase
    .from("events")
    .select("id")
    .eq("id", eventId)
    .eq("household_id", householdId)
    .maybeSingle();

  if (evtErr || !evt) {
    return { error: "Event tidak ditemukan." };
  }

  const { error } = await supabase
    .from("expenses")
    .update({ event_id: eventId })
    .in("id", uniqueIds)
    .eq("household_id", householdId);

  if (error) return { error: error.message };

  revalidateEventPaths();
  return { success: true };
}

export async function unlinkExpenseFromEvent(expenseId: string) {
  const supabase = await createClient();
  const householdId = await getCurrentHouseholdId();
  if (!householdId) return { error: "Household belum dipilih." };

  const { error } = await supabase
    .from("expenses")
    .update({ event_id: null })
    .eq("id", expenseId)
    .eq("household_id", householdId);

  if (error) return { error: error.message };

  revalidateEventPaths();
  return { success: true };
}

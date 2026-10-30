"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentHouseholdId } from "@/lib/supabase/household";
import { revalidatePath } from "next/cache";

export async function createEvent(formData: FormData) {
  const supabase = await createClient();
  const householdId = await getCurrentHouseholdId();
  if (!householdId) return { error: "No household selected" };

  const name = formData.get("name") as string;
  const start_date = formData.get("start_date") as string;

  if (!name || !start_date) return { error: "Name and start date are required" };

  const { error } = await supabase.from("events").insert({
    household_id: householdId,
    name: name.trim(),
    start_date,
    status: "active",
  });

  if (error) return { error: error.message };

  revalidatePath("/events");
  revalidatePath("/settings");
  revalidatePath("/history");
  revalidatePath("/");
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
  if (!householdId) return { error: "No household selected" };

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

  revalidatePath("/events");
  revalidatePath("/settings");
  revalidatePath("/history");
  revalidatePath("/");
  return { success: true };
}

export async function finishEvent(eventId: string, end_date?: string) {
  const supabase = await createClient();
  const householdId = await getCurrentHouseholdId();
  if (!householdId) return { error: "No household selected" };

  const resolvedEndDate = end_date || new Date().toISOString().split("T")[0];

  const { error } = await supabase
    .from("events")
    .update({ status: "completed", end_date: resolvedEndDate })
    .eq("id", eventId)
    .eq("household_id", householdId);

  if (error) return { error: error.message };

  revalidatePath("/events");
  revalidatePath("/settings");
  revalidatePath("/history");
  revalidatePath("/");
  return { success: true };
}

export async function deleteEvent(eventId: string) {
  const supabase = await createClient();
  const householdId = await getCurrentHouseholdId();
  if (!householdId) return { error: "No household selected" };

  const { error } = await supabase
    .from("events")
    .delete()
    .eq("id", eventId)
    .eq("household_id", householdId);

  if (error) return { error: error.message };

  revalidatePath("/events");
  revalidatePath("/settings");
  revalidatePath("/history");
  revalidatePath("/");
  return { success: true };
}

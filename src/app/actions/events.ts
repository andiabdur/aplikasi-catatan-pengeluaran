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
    name,
    start_date,
    status: "active"
  });

  if (error) return { error: error.message };

  revalidatePath("/events");
  revalidatePath("/");
  return { success: true };
}

export async function finishEvent(eventId: string, end_date: string) {
  const supabase = await createClient();
  const householdId = await getCurrentHouseholdId();
  if (!householdId) return { error: "No household selected" };

  const { error } = await supabase
    .from("events")
    .update({ status: "completed", end_date })
    .eq("id", eventId)
    .eq("household_id", householdId);

  if (error) return { error: error.message };

  revalidatePath("/events");
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
  revalidatePath("/");
  return { success: true };
}

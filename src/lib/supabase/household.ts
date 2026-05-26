import { cookies } from "next/headers";
import { createClient } from "./server";

export async function getCurrentHouseholdId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const cookieStore = await cookies();
  const cookieName = `hh_id_${user.id}`;
  const cachedId = cookieStore.get(cookieName)?.value;
  if (cachedId) return cachedId;

  const { data } = await supabase
    .from("household_members")
    .select("household_id, joined_at")
    .eq("user_id", user.id)
    .order("joined_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  return data?.household_id ?? null;
}


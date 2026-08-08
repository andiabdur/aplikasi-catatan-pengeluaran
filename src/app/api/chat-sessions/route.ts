import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentHouseholdId } from "@/lib/supabase/household";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Belum login." }, { status: 401 });

  const householdId = await getCurrentHouseholdId();
  if (!householdId) return NextResponse.json({ error: "Household tidak ditemukan." }, { status: 400 });

  const [sessionsRes, memoriesRes] = await Promise.all([
    supabase
      .from("chat_sessions")
      .select("id, title, created_at, updated_at")
      .eq("household_id", householdId)
      .order("updated_at", { ascending: false }),
    supabase
      .from("ai_memories")
      .select("id, content, created_at")
      .eq("household_id", householdId)
      .order("created_at", { ascending: false }),
  ]);

  return NextResponse.json({
    sessions: sessionsRes.data ?? [],
    memories: memoriesRes.data ?? [],
  });
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Belum login." }, { status: 401 });

  const householdId = await getCurrentHouseholdId();
  if (!householdId) return NextResponse.json({ error: "Household tidak ditemukan." }, { status: 400 });

  let title = "Percakapan Baru";
  try {
    const body = await req.json();
    if (typeof body.title === "string" && body.title.trim()) {
      title = body.title.trim();
    }
  } catch { /* use default title */ }

  const { data, error } = await supabase
    .from("chat_sessions")
    .insert({
      household_id: householdId,
      title,
      created_by: user.id,
    })
    .select("id, title, created_at, updated_at")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message || "Gagal membuat sesi." }, { status: 500 });
  }

  return NextResponse.json({ session: data });
}

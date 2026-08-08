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

  const { data, error } = await supabase
    .from("ai_memories")
    .select("id, content, created_at")
    .eq("household_id", householdId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ memories: data ?? [] });
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Belum login." }, { status: 401 });

  const householdId = await getCurrentHouseholdId();
  if (!householdId) return NextResponse.json({ error: "Household tidak ditemukan." }, { status: 400 });

  let content = "";
  try {
    const body = await req.json();
    content = typeof body.content === "string" ? body.content.trim() : "";
  } catch {
    return NextResponse.json({ error: "Body tidak valid." }, { status: 400 });
  }

  if (!content) {
    return NextResponse.json({ error: "Isi memori tidak boleh kosong." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("ai_memories")
    .insert({
      household_id: householdId,
      content,
      created_by: user.id,
    })
    .select("id, content, created_at")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message || "Gagal menambah memori." }, { status: 500 });
  }

  return NextResponse.json({ memory: data });
}

export async function PUT(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Belum login." }, { status: 401 });

  const householdId = await getCurrentHouseholdId();
  if (!householdId) return NextResponse.json({ error: "Household tidak ditemukan." }, { status: 400 });

  let memoryId = "";
  let content = "";
  try {
    const body = await req.json();
    memoryId = typeof body.id === "string" ? body.id.trim() : "";
    content = typeof body.content === "string" ? body.content.trim() : "";
  } catch {
    return NextResponse.json({ error: "Body tidak valid." }, { status: 400 });
  }

  if (!memoryId || !content) {
    return NextResponse.json({ error: "Memory ID dan isi memori wajib diisi." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("ai_memories")
    .update({
      content,
      updated_at: new Date().toISOString(),
    })
    .eq("id", memoryId)
    .eq("household_id", householdId)
    .select("id, content, created_at")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message || "Gagal mengedit memori." }, { status: 500 });
  }

  return NextResponse.json({ memory: data });
}

export async function DELETE(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Belum login." }, { status: 401 });

  const householdId = await getCurrentHouseholdId();
  if (!householdId) return NextResponse.json({ error: "Household tidak ditemukan." }, { status: 400 });

  const url = new URL(req.url);
  const memoryId = url.searchParams.get("id");

  if (!memoryId) {
    return NextResponse.json({ error: "Memory ID required" }, { status: 400 });
  }

  const { error } = await supabase
    .from("ai_memories")
    .delete()
    .eq("id", memoryId)
    .eq("household_id", householdId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}

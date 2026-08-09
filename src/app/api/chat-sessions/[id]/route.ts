import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentHouseholdId } from "@/lib/supabase/household";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: sessionId } = await params;
  if (!sessionId) return NextResponse.json({ error: "Session ID required" }, { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Belum login." }, { status: 401 });

  const householdId = await getCurrentHouseholdId();
  if (!householdId) return NextResponse.json({ error: "Household tidak ditemukan." }, { status: 400 });

  // Verify session belongs to user's household
  const { data: session } = await supabase
    .from("chat_sessions")
    .select("id, title")
    .eq("id", sessionId)
    .eq("household_id", householdId)
    .single();

  if (!session) {
    return NextResponse.json({ error: "Sesi tidak ditemukan." }, { status: 404 });
  }

  const { searchParams } = new URL(req.url);
  const limitParam = searchParams.get("limit");
  const beforeParam = searchParams.get("before");

  let query = supabase
    .from("chat_messages")
    .select("id, role, content, saved_expenses, created_at")
    .eq("session_id", sessionId);

  if (beforeParam) {
    query = query.lt("created_at", beforeParam);
  }

  if (limitParam) {
    const limit = Math.max(1, parseInt(limitParam, 10) || 2);
    // Fetch limit + 1 to check if there are more older messages
    query = query.order("created_at", { ascending: false }).limit(limit + 1);

    const { data: rawMessages } = await query;
    const msgList = rawMessages ?? [];
    const hasMore = msgList.length > limit;
    const items = hasMore ? msgList.slice(0, limit) : msgList;
    // Reverse to chronological ascending order
    items.reverse();

    return NextResponse.json({
      session,
      hasMore,
      messages: items.map((m) => ({
        id: m.id,
        role: m.role as "user" | "assistant",
        content: m.content,
        savedExpenses: (m.saved_expenses as any) ?? undefined,
        createdAt: m.created_at,
      })),
    });
  }

  const { data: messages } = await query.order("created_at", { ascending: true });

  return NextResponse.json({
    session,
    hasMore: false,
    messages: (messages ?? []).map((m) => ({
      id: m.id,
      role: m.role as "user" | "assistant",
      content: m.content,
      savedExpenses: (m.saved_expenses as any) ?? undefined,
      createdAt: m.created_at,
    })),
  });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: sessionId } = await params;
  if (!sessionId) return NextResponse.json({ error: "Session ID required" }, { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Belum login." }, { status: 401 });

  const householdId = await getCurrentHouseholdId();
  if (!householdId) return NextResponse.json({ error: "Household tidak ditemukan." }, { status: 400 });

  const { error } = await supabase
    .from("chat_sessions")
    .delete()
    .eq("id", sessionId)
    .eq("household_id", householdId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

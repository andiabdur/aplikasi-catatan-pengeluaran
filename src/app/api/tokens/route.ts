import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentHouseholdId } from "@/lib/supabase/household";
import { generateToken, getApiClient } from "@/lib/api-tokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Belum login." }, { status: 401 });

  const householdId = await getCurrentHouseholdId();
  if (!householdId) {
    return NextResponse.json({ error: "Household tidak ditemukan." }, { status: 400 });
  }

  // Gunakan client admin jika ada untuk memastikan isolasi tabel api_tokens
  const db = process.env.SUPABASE_SERVICE_ROLE_KEY ? getApiClient() : supabase;

  const { data, error } = await db
    .from("api_tokens")
    .select("id, name, token_prefix, scopes, last_used_at, created_at")
    .eq("household_id", householdId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ tokens: data ?? [] });
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Belum login." }, { status: 401 });

  const householdId = await getCurrentHouseholdId();
  if (!householdId) {
    return NextResponse.json({ error: "Household tidak ditemukan." }, { status: 400 });
  }

  let name = "";
  try {
    const body = await req.json();
    name = typeof body.name === "string" ? body.name.trim() : "";
  } catch {
    return NextResponse.json({ error: "Body JSON tidak valid." }, { status: 400 });
  }

  if (!name) {
    return NextResponse.json({ error: "Nama token wajib diisi (misal: 'Gemini HP Andi')." }, { status: 400 });
  }

  const { rawToken, tokenHash, tokenPrefix } = generateToken();
  const db = process.env.SUPABASE_SERVICE_ROLE_KEY ? getApiClient() : supabase;

  const { data, error } = await db
    .from("api_tokens")
    .insert({
      household_id: householdId,
      user_id: user.id,
      name,
      token_hash: tokenHash,
      token_prefix: tokenPrefix,
      scopes: ["all"],
    })
    .select("id, name, token_prefix, scopes, last_used_at, created_at")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message || "Gagal membuat token akses." },
      { status: 500 },
    );
  }

  // Raw token hanya dikembalikan SEKALI pada respons pembuatan ini
  return NextResponse.json({
    token: rawToken,
    tokenInfo: data,
  });
}

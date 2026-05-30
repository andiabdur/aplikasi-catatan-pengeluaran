import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@/lib/supabase/server";
import { getCurrentHouseholdId } from "@/lib/supabase/household";
import { buildFinancialContext } from "@/lib/financial-context";

// Free-form chat with the AI financial planner. Every reply is grounded in the
// family's actual data (same digest the advisor uses), injected as the system
// instruction so the assistant always stays in financial context.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODEL = process.env.GEMINI_MODEL || "gemini-3.1-flash-lite";
const MAX_HISTORY = 16; // keep the prompt small/cheap

type ChatMessage = { role: "user" | "assistant"; content: string };

export async function POST(req: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY belum di-set di environment." },
      { status: 500 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Belum login." }, { status: 401 });

  const householdId = await getCurrentHouseholdId();
  if (!householdId) {
    return NextResponse.json({ error: "Household tidak ditemukan." }, { status: 400 });
  }

  let messages: ChatMessage[];
  try {
    const body = await req.json();
    messages = Array.isArray(body.messages) ? body.messages : [];
  } catch {
    return NextResponse.json({ error: "Body tidak valid." }, { status: 400 });
  }

  const cleaned = messages
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .slice(-MAX_HISTORY);

  if (cleaned.length === 0 || cleaned[cleaned.length - 1].role !== "user") {
    return NextResponse.json({ error: "Tidak ada pertanyaan." }, { status: 400 });
  }

  const ctx = await buildFinancialContext(supabase, householdId);
  if (!ctx) {
    return NextResponse.json({ error: "Belum ada data keuangan untuk dijadikan konteks." }, { status: 400 });
  }

  const systemInstruction = `Kamu "Penasihat Keuangan Keluarga" — asisten AI yang santai, membumi, jujur, dan suportif untuk sebuah keluarga Indonesia. Kamu HANYA membahas hal seputar keuangan keluarga ini (budgeting, penghematan, tabungan, goal/target, perencanaan finansial). Kalau ditanya hal di luar keuangan, arahkan balik dengan halus ke topik keuangan.

Selalu pakai DATA KEUANGAN nyata keluarga di bawah ini sebagai konteks. Sebut angka konkret kalau relevan. Jangan mengarang data yang tidak ada. Kalau butuh data yang tidak tersedia, bilang terus terang dan beri estimasi/asumsi.

Jawab ringkas, langsung ke inti, pakai Bahasa Indonesia santai (panggil mereka "kamu sekeluarga"). Boleh pakai poin-poin kalau membantu. Semua nominal dalam Rupiah.

=== DATA ${ctx.periodsAnalyzed.length} PERIODE GAJIAN TERAKHIR (budget vs realisasi per kategori) ===
${ctx.digest}

=== GOAL/TARGET TABUNGAN ===
${ctx.goalDigest}

Periode berikutnya: ${ctx.nextPeriodTitle}.`;

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: MODEL, systemInstruction });

    const history = cleaned.slice(0, -1).map((m) => ({
      role: m.role === "assistant" ? ("model" as const) : ("user" as const),
      parts: [{ text: m.content }],
    }));
    const last = cleaned[cleaned.length - 1];

    const chat = model.startChat({ history });
    const result = await chat.sendMessage(last.content);
    const reply = result.response.text().trim();

    return NextResponse.json({ reply });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Gagal menjawab.";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

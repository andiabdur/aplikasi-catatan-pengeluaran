import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentHouseholdId } from "@/lib/supabase/household";
import { buildFinancialContext } from "@/lib/financial-context";

// Free-form chat with the AI financial planner. Every reply is grounded in the
// family's actual data (same digest the advisor uses), injected as the system
// instruction so the assistant always stays in financial context.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODEL = process.env.DEEPSEEK_MODEL || "deepseek-chat";
const MAX_HISTORY = 16;

type ChatMessage = { role: "user" | "assistant"; content: string };

export async function POST(req: Request) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "DEEPSEEK_API_KEY belum di-set di environment." },
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
    .filter(
      (m) =>
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string" &&
        m.content.trim(),
    )
    .slice(-MAX_HISTORY);

  if (cleaned.length === 0 || cleaned[cleaned.length - 1].role !== "user") {
    return NextResponse.json({ error: "Tidak ada pertanyaan." }, { status: 400 });
  }

  const ctx = await buildFinancialContext(supabase, householdId);
  if (!ctx) {
    return NextResponse.json(
      { error: "Belum ada data keuangan untuk dijadikan konteks." },
      { status: 400 },
    );
  }

  const systemInstruction = `Kamu "Penasihat Keuangan Keluarga" - asisten AI yang santai, membumi, jujur, dan suportif untuk sebuah keluarga Indonesia. Kamu HANYA membahas hal seputar keuangan keluarga ini (budgeting, penghematan, tabungan, goal/target, perencanaan finansial). Kalau ditanya hal di luar keuangan, arahkan balik dengan halus ke topik keuangan.

Selalu pakai DATA KEUANGAN nyata keluarga di bawah ini sebagai konteks. Sebut angka konkret kalau relevan. Jangan mengarang data yang tidak ada. Kalau butuh data yang tidak tersedia, bilang terus terang dan beri estimasi/asumsi.

Jawab ringkas, langsung ke inti, pakai Bahasa Indonesia santai (panggil mereka "kamu sekeluarga"). Boleh pakai poin-poin kalau membantu. Semua nominal dalam Rupiah.

=== DATA ${ctx.periodsAnalyzed.length} PERIODE GAJIAN TERAKHIR (budget vs realisasi per kategori) ===
${ctx.digest}

=== DETAIL TRANSAKSI PER PERIODE (item, tanggal, nominal) ===
${ctx.itemDigest}

=== GOAL/TARGET TABUNGAN ===
${ctx.goalDigest}

Periode berikutnya: ${ctx.nextPeriodTitle}.`;

  try {
    const deepseekMessages = [
      { role: "system" as const, content: systemInstruction },
      ...cleaned.map((m) => ({
        role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
        content: m.content,
      })),
    ];

    const res = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: deepseekMessages,
      }),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      return NextResponse.json(
        { error: `DeepSeek error: ${res.status}${errBody ? " - " + errBody.slice(0, 300) : ""}` },
        { status: 502 },
      );
    }

    const data = await res.json();
    const reply = (data.choices?.[0]?.message?.content ?? "").trim();

    return NextResponse.json({ reply });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Gagal menjawab.";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

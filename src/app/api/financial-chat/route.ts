import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentHouseholdId } from "@/lib/supabase/household";
import { buildFinancialContext } from "@/lib/financial-context";

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

  const catLines = ctx.catList.map((c) => `- ${c.name} (id: ${c.id})`).join("\n");

  const systemInstruction = `Kamu "Penasihat Keuangan Keluarga" — asisten AI yang santai, membumi, jujur, dan suportif untuk sebuah keluarga Indonesia. Kamu HANYA membahas hal seputar keuangan keluarga ini (budgeting, penghematan, tabungan, goal/target, perencanaan finansial). Kalau ditanya hal di luar keuangan, arahkan balik dengan halus ke topik keuangan.

Selalu pakai DATA KEUANGAN nyata keluarga di bawah ini sebagai konteks. Sebut angka konkret kalau relevan. Jangan mengarang data yang tidak ada.

Jawab ringkas, langsung ke inti, pakai Bahasa Indonesia santai (panggil mereka "kamu sekeluarga"). Boleh pakai poin-poin kalau membantu. Semua nominal dalam Rupiah. JANGAN PAKAI TABEL MARKDOWN — pakai bullet atau kalimat biasa, tampil di HP.

=== DATA ${ctx.periodsAnalyzed.length} PERIODE GAJIAN TERAKHIR ===
${ctx.digest}

=== DETAIL TRANSAKSI PER PERIODE ===
${ctx.itemDigest}

=== GOAL/TARGET TABUNGAN ===
${ctx.goalDigest}

Periode berikutnya: ${ctx.nextPeriodTitle}.

=== KEMAMPUAN MENCATAT PENGELUARAN ===
Kalau user menyebut pengeluaran konkret dengan nominal yang jelas dalam pesannya (contoh: "jajan gorengan 5rb", "beli bensin 50ribu", "bayar listrik 150000", "makan siang 25rb"), ekstrak dan catat sebagai expense. Pilih category_id dari daftar berikut:
${catLines}

Pahami slang uang Indonesia: rb/ribu=1000, jt/juta=1000000, goceng=5000, ceban=10000, goban=50000, cepek=100000. Satu pesan bisa menghasilkan beberapa expense kalau ada beberapa item.

Dalam "reply", konfirmasi singkat apa yang berhasil dicatat (nama + nominal + kategori), lalu lanjut membantu.
PENTING: Hanya isi "expenses" kalau user BENAR-BENAR menyebut pengeluaran konkret. Pertanyaan, hipotesis, atau contoh TIDAK dicatat.

=== FORMAT OUTPUT (JSON WAJIB) ===
Selalu balas dalam format JSON berikut:
{
  "reply": "balasan chat kamu dalam Bahasa Indonesia",
  "expenses": [
    { "description": "nama pengeluaran", "amount": 5000, "category_id": "uuid-dari-daftar-di-atas" }
  ]
}
Kalau tidak ada pengeluaran yang dicatat, "expenses" = [].`;

  try {
    const deepseekMessages = [
      { role: "system" as const, content: systemInstruction },
      ...cleaned.map((m) => ({
        role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
        // Wrap assistant history in JSON so the model stays consistent with the format it's asked to produce
        content:
          m.role === "assistant"
            ? JSON.stringify({ reply: m.content, expenses: [] })
            : m.content,
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
        response_format: { type: "json_object" },
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
    const raw = (data.choices?.[0]?.message?.content ?? "").trim();

    let parsed: { reply?: string; message?: string; response?: string; text?: string; expenses?: { description?: string; amount?: number; category_id?: string }[] };
    try {
      parsed = JSON.parse(raw);
    } catch {
      // JSON parse failed — use raw text as reply
      return NextResponse.json({ reply: raw || "Maaf, ada gangguan. Coba lagi.", saved_expenses: [] });
    }

    // Try multiple common field names the model might use
    const reply = (parsed.reply ?? parsed.message ?? parsed.response ?? parsed.text ?? "").trim()
      || "Maaf, responnya kosong. Coba tanya ulang.";

    // Validate and save expenses server-side
    const today = new Date().toISOString().slice(0, 10);
    const rawExpenses = Array.isArray(parsed.expenses) ? parsed.expenses : [];
    const saved: { id?: string; description: string; amount: number; categoryName: string }[] = [];

    for (const exp of rawExpenses) {
      const validCat = ctx.catList.find((c) => c.id === exp.category_id);
      const amount = Math.round(Number(exp.amount) || 0);
      const description = (exp.description ?? "").trim();
      if (!validCat || amount <= 0 || !description) continue;

      const { data: inserted } = await supabase
        .from("expenses")
        .insert({
          household_id: householdId,
          category_id: validCat.id,
          spent_at: today,
          description,
          amount,
          created_by: user.id,
        })
        .select("id")
        .single();

      saved.push({ id: inserted?.id, description, amount, categoryName: validCat.name });
    }

    return NextResponse.json({ reply, saved_expenses: saved });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Gagal menjawab.";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

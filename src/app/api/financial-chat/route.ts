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
  let reqSessionId: string | undefined;
  try {
    const body = await req.json();
    messages = Array.isArray(body.messages) ? body.messages : [];
    reqSessionId = typeof body.sessionId === "string" ? body.sessionId : undefined;
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

  const lastUserMessage = cleaned[cleaned.length - 1].content;

  // Resolve or create session
  let activeSessionId = reqSessionId;
  let sessionTitle = "Percakapan Baru";

  if (activeSessionId && activeSessionId !== "new") {
    const { data: sData } = await supabase
      .from("chat_sessions")
      .select("id, title")
      .eq("id", activeSessionId)
      .eq("household_id", householdId)
      .single();
    if (sData) {
      activeSessionId = sData.id;
      sessionTitle = sData.title;
    } else {
      activeSessionId = undefined;
    }
  }

  if (!activeSessionId || activeSessionId === "new") {
    const { data: newSession } = await supabase
      .from("chat_sessions")
      .insert({
        household_id: householdId,
        title: "Percakapan Baru",
        created_by: user.id,
      })
      .select("id, title")
      .single();

    if (!newSession) {
      return NextResponse.json({ error: "Gagal membuat sesi percakapan." }, { status: 500 });
    }
    activeSessionId = newSession.id;
    sessionTitle = newSession.title;
  }

  const ctx = await buildFinancialContext(supabase, householdId);
  if (!ctx) {
    return NextResponse.json(
      { error: "Belum ada data keuangan untuk dijadikan konteks." },
      { status: 400 },
    );
  }

  const [eventsRes, goalsRes] = await Promise.all([
    supabase.from("events").select("id, name").eq("household_id", householdId).eq("status", "active"),
    supabase.from("goals").select("id, name").eq("household_id", householdId).eq("status", "active"),
  ]);

  const activeEvents = eventsRes.data ?? [];
  const activeGoals = goalsRes.data ?? [];

  const catLines = ctx.catList.map((c) => `- ${c.name} (id: ${c.id})`).join("\n");
  const eventLines = activeEvents.length
    ? activeEvents.map((e) => `- ${e.name} (id: ${e.id})`).join("\n")
    : "(belum ada event aktif)";
  const goalLines = activeGoals.length
    ? activeGoals.map((g) => `- ${g.name} (id: ${g.id})`).join("\n")
    : "(belum ada goal aktif)";

  const systemInstruction = `Kamu "Penasihat Keuangan Keluarga" — asisten AI yang santai, membumi, jujur, dan suportif untuk sebuah keluarga Indonesia. Kamu HANYA membahas hal seputar keuangan keluarga ini (budgeting, penghematan, tabungan, goal/target, event/kegiatan, perencanaan finansial). Kalau ditanya hal di luar keuangan, arahkan balik dengan halus ke topik keuangan.

Selalu pakai DATA KEUANGAN nyata keluarga di bawah ini sebagai konteks. Sebut angka konkret kalau relevan. Jangan mengarang data yang tidak ada.

Jawab ringkas, langsung ke inti, pakai Bahasa Indonesia santai (panggil mereka "kamu sekeluarga"). Boleh pakai poin-poin kalau membantu. Semua nominal dalam Rupiah. JANGAN PAKAI TABEL MARKDOWN — pakai bullet atau kalimat biasa, tampil di HP.

=== DATA ${ctx.periodsAnalyzed.length} PERIODE GAJIAN TERAKHIR ===
${ctx.digest}

=== DETAIL TRANSAKSI PER PERIODE ===
${ctx.itemDigest}

=== GOAL/TARGET TABUNGAN ===
${ctx.goalDigest}

=== DAFTAR EVENT / KEGIATAN KELUARGA ===
${ctx.eventDigest}

=== MEMORI & CATATAN PENTING KELUARGA (DIINGAT OLEH AI) ===
${ctx.memoryDigest}

Periode berikutnya: ${ctx.nextPeriodTitle}.

=== KEMAMPUAN MENCATAT PENGELUARAN ===
Kalau user menyebut pengeluaran konkret dengan nominal yang jelas dalam pesannya (contoh: "jajan gorengan 5rb", "beli bensin 50ribu", "bayar hotel 750rb pas Liburan Bali", "nabung 200rb buat umroh"), ekstrak dan catat sebagai expense. 

Pilih category_id dari daftar berikut:
${catLines}

Daftar EVENT AKTIF (isi event_id jika pengeluaran terkait event):
${eventLines}

Daftar GOAL AKTIF (isi goal_id jika pengeluaran berupa setoran tabungan goal):
${goalLines}

Pahami slang uang Indonesia: rb/ribu=1000, jt/juta=1000000, goceng=5000, ceban=10000, goban=50000, cepek=100000. Satu pesan bisa menghasilkan beberapa expense kalau ada beberapa item.

=== KEMAMPUAN MENGINGAT FAKTA/CATATAN PENTING (AI MEMORY) ===
Jika pengguna menyampaikan fakta penting baru, preferensi, rencana keuangan baru, atau kesepakatan penting keluarga (misal: "kita rencana mau liburan ke Bali bulan Oktober budget 10jt", "gaji Abbi naik jadi 15jt mulai bulan depan", "keluarga sepakat kurangi jajan luar"), ekstrak ringkas sebagai kalimat fakta dan masukkan ke array "new_memories".

=== USULAN JUDUL SESI CHAT ===
Jika judul sesi masih "Percakapan Baru" atau topik berubah, usulkan nama judul sesi ringkas (maksimal 4 kata) pada "title_suggestion".

Dalam "reply", konfirmasi singkat apa yang berhasil dicatat (nama + nominal + kategori + event/goal jika ada), lalu lanjut membantu.
PENTING: Hanya isi "expenses" kalau user BENAR-BENAR menyebut pengeluaran konkret. Pertanyaan, hipotesis, atau contoh TIDAK dicatat.

=== FORMAT OUTPUT (JSON WAJIB) ===
Selalu balas dalam format JSON berikut:
{
  "reply": "balasan chat kamu dalam Bahasa Indonesia",
  "expenses": [
    {
      "description": "nama pengeluaran",
      "amount": 5000,
      "category_id": "uuid-kategori",
      "event_id": "uuid-event atau null",
      "goal_id": "uuid-goal atau null"
    }
  ],
  "new_memories": [
    "fakta penting 1 yang perlu diingat AI permanen"
  ],
  "title_suggestion": "Judul Percakapan Ringkas"
}
Kalau tidak ada pengeluaran, "expenses" = []. Kalau tidak ada fakta memori baru, "new_memories" = [].`;

  try {
    const deepseekMessages = [
      { role: "system" as const, content: systemInstruction },
      ...cleaned.map((m) => ({
        role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
        content:
          m.role === "assistant"
            ? JSON.stringify({ reply: m.content, expenses: [] })
            : m.content,
      })),
    ];

    const apiUrl = process.env.DEEPSEEK_API_URL || "https://api.deepseek.com/chat/completions";
    const res = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: deepseekMessages,
        response_format: { type: "json_object" },
        stream: false,
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
    let raw = (data.choices?.[0]?.message?.content ?? "").trim();
    if (raw.startsWith("```json")) {
      raw = raw.slice(7);
    } else if (raw.startsWith("```")) {
      raw = raw.slice(3);
    }
    if (raw.endsWith("```")) {
      raw = raw.slice(0, -3);
    }
    raw = raw.trim();

    let parsed: {
      reply?: string;
      message?: string;
      response?: string;
      text?: string;
      expenses?: { description?: string; amount?: number; category_id?: string; event_id?: string; goal_id?: string }[];
      new_memories?: string[];
      title_suggestion?: string;
    };
    try {
      parsed = JSON.parse(raw);
    } catch {
      return NextResponse.json({ reply: raw || "Maaf, ada gangguan. Coba lagi.", saved_expenses: [] });
    }

    const reply = (parsed.reply ?? parsed.message ?? parsed.response ?? parsed.text ?? "").trim()
      || "Maaf, responnya kosong. Coba tanya ulang.";

    // Validate and save expenses server-side
    const today = new Date().toISOString().slice(0, 10);
    const rawExpenses = Array.isArray(parsed.expenses) ? parsed.expenses : [];
    const saved: { id?: string; description: string; amount: number; categoryName: string }[] = [];

    for (const exp of rawExpenses) {
      const validCat = ctx.catList.find((c) => c.id === exp.category_id);
      const validEvent = activeEvents.find((e) => e.id === exp.event_id);
      const validGoal = activeGoals.find((g) => g.id === exp.goal_id);
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
          event_id: validEvent?.id ?? null,
          goal_id: validGoal?.id ?? null,
          created_by: user.id,
        })
        .select("id")
        .single();

      saved.push({ id: inserted?.id, description, amount, categoryName: validCat.name });
    }

    // Process new memories
    const newMemories = Array.isArray(parsed.new_memories) ? parsed.new_memories : [];
    for (const memContent of newMemories) {
      const trimmed = String(memContent).trim();
      if (trimmed.length > 5) {
        await supabase.from("ai_memories").insert({
          household_id: householdId,
          content: trimmed,
          created_by: user.id,
        });
      }
    }

    // Save user message and assistant reply to chat_messages database table
    await supabase.from("chat_messages").insert([
      {
        session_id: activeSessionId,
        role: "user",
        content: lastUserMessage,
      },
      {
        session_id: activeSessionId,
        role: "assistant",
        content: reply,
        saved_expenses: saved.length > 0 ? (saved as any) : null,
      },
    ]);

    // Update session title and updated_at
    const titleSuggestion = (parsed.title_suggestion ?? "").trim();
    let finalTitle = sessionTitle;
    const shouldUpdateTitle = (sessionTitle === "Percakapan Baru" || !sessionTitle) && titleSuggestion;
    if (shouldUpdateTitle) {
      finalTitle = titleSuggestion;
      await supabase
        .from("chat_sessions")
        .update({ title: titleSuggestion, updated_at: new Date().toISOString() })
        .eq("id", activeSessionId);
    } else {
      await supabase
        .from("chat_sessions")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", activeSessionId);
    }

    return NextResponse.json({
      reply,
      saved_expenses: saved,
      session_id: activeSessionId,
      title: finalTitle,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Gagal menjawab.";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

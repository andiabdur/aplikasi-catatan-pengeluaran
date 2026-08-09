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

  const systemInstruction = `Kamu adalah "Chief Financial Officer (CFO) & Senior Certified Financial Planner (CFP) Keluarga" — perencana keuangan profesional senior yang sangat ahli, tajam, realistis, dan berambisi kuat membantu keluarga Indonesia menguasai keuangan mereka, menghabisi kebocoran anggaran, membangun Dana Darurat yang kokoh, serta mencapai kebebasan finansial.

PRINSIP & GAYA RESPON KAMU:
1. **Analisis Berbasis Data Nyata (Data-Driven)**: Selalu gunakan angka nominal Rupiah dan persentase konkret dari data keluarga di bawah ini. Jangan pernah memberikan saran teoritis umum yang mengambang.
2. **Tajam, Realistis & Berorientasi Solusi**: Jika keluarga ini boros, mengalami defisit, atau rasio tabungan (Savings Rate) rendah, katakan sejujurnya dengan tegas namun tetap suportif dan berikan rencana aksi 3 langkah yang realistis.
3. **Format Jawaban Menarik & Mudah Dibaca di HP**:
   - Gunakan Bahasa Indonesia yang profesional, hangat, dan lugas (panggil mereka "kamu sekeluarga" atau "Keluarga").
   - Gunakan poin-poin, bold highlight, serta struktur visual yang rapi.
   - JANGAN PAKAI TABEL MARKDOWN (tampil di HP, pakai list/bullet points biasa).
4. **Cakupannya**: Hanya seputar keuangan keluarga (budgeting, cashflow, penghematan, investasi/dana darurat, target impian, evaluasi event). Jika ditanyakan hal lain, balikkan arah ke topik finansial keluarga dengan cerdas.

=== DATA ${ctx.periodsAnalyzed.length} PERIODE GAJIAN TERAKHIR ===
${ctx.digest}

=== DETAIL TRANSAKSI PER PERIODE ===
${ctx.itemDigest}

=== GOAL / TARGET TABUNGAN ===
${ctx.goalDigest}

=== DAFTAR EVENT / KEGIATAN KELUARGA ===
${ctx.eventDigest}

=== MEMORI & CATATAN PENTING KELUARGA (DIINGAT OLEH AI) ===
${ctx.memoryDigest}

Periode berikutnya: ${ctx.nextPeriodTitle}.

=== KEMAMPUAN MENCATAT PENGELUARAN OTOMATIS ===
Jika pengguna menyebut pengeluaran konkret dengan nominal (contoh: "jajan gorengan 5rb", "bayar bensin 50ribu", "nabung 500rb buat umroh"), ekstrak dan catat ke array "expenses".
Pilih category_id dari daftar berikut:
${catLines}

Daftar EVENT AKTIF (isi event_id jika pengeluaran terkait event):
${eventLines}

Daftar GOAL AKTIF (isi goal_id jika pengeluaran berupa setoran tabungan goal):
${goalLines}

Pahami istilah nominal uang Indonesia: rb/ribu=1.000, jt/juta=1.000.000, goceng=5.000, ceban=10.000, goban=50.000, cepek=100.000.

=== KEMAMPUAN MENGELOLA MEMORI & CATATAN PENTING (AI MEMORY) ===
Setiap memori di atas memiliki ID (id: uuid). Kamu dapat menambah, mengedit, atau menghapus memori jika ada fakta/rencana baru dari pengguna.
Operasi memori:
1. {"action": "add", "content": "fakta/rencana baru"} -> Tambah memori baru.
2. {"action": "update", "id": "uuid-memori", "content": "kalimat revisi"} -> Edit/perbarui memori.
3. {"action": "delete", "id": "uuid-memori"} -> Hapus memori.

=== USULAN JUDUL SESI CHAT ===
Jika judul sesi masih "Percakapan Baru" atau topik berubah, usulkan nama judul sesi ringkas (maksimal 4 kata) pada "title_suggestion".

Dalam "reply", konfirmasi singkat apa yang berhasil dicatat/diperbarui/dihapus (termasuk expense atau memori jika ada), lalu lanjut memberikan bantuan & analisis keuangan terbaik kamu.
PENTING: Hanya isi "expenses" kalau user BENAR-BENAR menyebut pengeluaran konkret. Pertanyaan atau contoh TIDAK dicatat.

=== FORMAT OUTPUT (JSON WAJIB) ===
Selalu balas dalam format JSON berikut:
{
  "reply": "Balasan analisis mendalam dan saran profesional kamu dalam Bahasa Indonesia",
  "expenses": [
    {
      "description": "nama pengeluaran",
      "amount": 5000,
      "category_id": "uuid-kategori",
      "event_id": "uuid-event atau null",
      "goal_id": "uuid-goal atau null"
    }
  ],
  "memory_operations": [
    { "action": "add", "content": "fakta baru" },
    { "action": "update", "id": "uuid-123", "content": "fakta revisi" },
    { "action": "delete", "id": "uuid-456" }
  ],
  "title_suggestion": "Judul Percakapan Ringkas"
}
Kalau tidak ada pengeluaran, "expenses" = []. Kalau tidak ada perubahan memori, "memory_operations" = [].`;

  try {
    const deepseekMessages = [
      { role: "system" as const, content: systemInstruction },
      ...cleaned.map((m) => ({
        role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
        content: m.content,
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
      memory_operations?: { action?: "add" | "update" | "delete"; id?: string; content?: string }[];
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

    // Process memory operations (add, update, delete)
    type MemoryOp = { action: "add" | "update" | "delete"; id?: string; content?: string };
    const rawOps: MemoryOp[] = Array.isArray(parsed.memory_operations)
      ? (parsed.memory_operations as MemoryOp[])
      : [];

    // Fallback: support legacy new_memories array if model returned it
    const legacyMemories = Array.isArray(parsed.new_memories) ? parsed.new_memories : [];
    legacyMemories.forEach((memContent) => {
      const trimmed = String(memContent).trim();
      if (trimmed.length > 5 && !rawOps.some((op) => op.content === trimmed)) {
        rawOps.push({ action: "add", content: trimmed });
      }
    });

    for (const op of rawOps) {
      if (op.action === "add" && op.content && op.content.trim().length > 5) {
        await supabase.from("ai_memories").insert({
          household_id: householdId,
          content: op.content.trim(),
          created_by: user.id,
        });
      } else if (op.action === "update" && op.id && op.content && op.content.trim().length > 5) {
        await supabase
          .from("ai_memories")
          .update({
            content: op.content.trim(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", op.id)
          .eq("household_id", householdId);
      } else if (op.action === "delete" && op.id) {
        await supabase
          .from("ai_memories")
          .delete()
          .eq("id", op.id)
          .eq("household_id", householdId);
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

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentHouseholdId } from "@/lib/supabase/household";

// Voice note -> structured expense via Groq Whisper + DeepSeek.
// Step 1: Transcribe audio with Groq Whisper (fast + free tier).
// Step 2: Extract description, amount (rupiah), and category with DeepSeek.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GROQ_WHISPER_MODEL = "whisper-large-v3";
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || "deepseek-chat";

export async function POST(req: Request) {
  const groqKey = process.env.GROQ_API_KEY;
  if (!groqKey) {
    return NextResponse.json(
      { error: "GROQ_API_KEY belum di-set di environment." },
      { status: 500 },
    );
  }
  const deepseekKey = process.env.DEEPSEEK_API_KEY;
  if (!deepseekKey) {
    return NextResponse.json(
      { error: "DEEPSEEK_API_KEY belum di-set di environment." },
      { status: 500 },
    );
  }

  // Auth + scope to the user's household
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Belum login." }, { status: 401 });
  }

  const householdId = await getCurrentHouseholdId();
  if (!householdId) {
    return NextResponse.json({ error: "Household tidak ditemukan." }, { status: 400 });
  }

  const { data: categories } = await supabase
    .from("categories")
    .select("id,name")
    .eq("household_id", householdId)
    .eq("is_archived", false)
    .order("sort_order");

  const catList = categories ?? [];
  if (catList.length === 0) {
    return NextResponse.json({ error: "Belum ada kategori." }, { status: 400 });
  }

  // Active goals
  const { data: goalsData } = await supabase
    .from("goals")
    .select("id,name")
    .eq("household_id", householdId)
    .eq("status", "active")
    .order("sort_order");
  const goalList = goalsData ?? [];

  // STEP 1: Read audio
  let audioBlob: Blob;
  let mimeType: string;
  try {
    const form = await req.formData();
    const file = form.get("audio");
    if (!(file instanceof Blob)) {
      return NextResponse.json({ error: "Audio tidak ditemukan." }, { status: 400 });
    }
    mimeType = file.type || "audio/webm";
    audioBlob = file;
  } catch {
    return NextResponse.json({ error: "Gagal membaca audio." }, { status: 400 });
  }

  if (audioBlob.size === 0) {
    return NextResponse.json({ error: "Audio kosong." }, { status: 400 });
  }

  // STEP 2: Transcribe with Groq Whisper
  let transcript: string;
  try {
    // Priming prompt: Whisper's `prompt` works best as a NATURAL example
    // sentence in the expected speaking style (NOT a comma-separated word list,
    // which makes it output fragmented garbage). A full-sentence example biases
    // it toward Indonesian conversational expense phrasing + rupiah amounts.
    const whisperPrompt =
      "Ini catatan pengeluaran belanja keluarga dalam Bahasa Indonesia sehari-hari. " +
      "Contoh: beli ayam goreng lima belas ribu, beli siomay sepuluh ribu, " +
      "bayar parkir dua ribu, isi bensin lima puluh ribu, nabung buat umroh lima ratus ribu.";

    const whisperForm = new FormData();
    const ext = mimeType.includes("mp4") ? "m4a" : mimeType.includes("ogg") ? "ogg" : "webm";
    whisperForm.append("file", audioBlob, `audio.${ext}`);
    whisperForm.append("model", GROQ_WHISPER_MODEL);
    whisperForm.append("language", "id");
    whisperForm.append("prompt", whisperPrompt);
    whisperForm.append("temperature", "0");
    whisperForm.append("response_format", "json");

    const whisperRes = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${groqKey}` },
      body: whisperForm,
    });

    if (!whisperRes.ok) {
      const errBody = await whisperRes.text().catch(() => "");
      return NextResponse.json(
        { error: `Gagal transkrip: ${whisperRes.status}${errBody ? " - " + errBody.slice(0, 200) : ""}` },
        { status: 502 },
      );
    }

    const whisperData = await whisperRes.json();
    transcript = (whisperData.text ?? "").trim();

    if (!transcript) {
      return NextResponse.json({ error: "Suara tidak terdengar jelas, coba ulangi." }, { status: 400 });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Gagal menghubungi Groq Whisper.";
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  // STEP 3: Extract structured expense data with DeepSeek
  const catLines = catList.map((c) => `- ${c.name} (id: ${c.id})`).join("\n");
  const goalLines = goalList.length
    ? goalList.map((g) => `- ${g.name} (id: ${g.id})`).join("\n")
    : "(belum ada goal)";

  const extractPrompt = `Kamu asisten pencatat keuangan keluarga Indonesia. Ekstrak pengeluaran dari teks transkrip suara berikut.

TRANSCRIPT:
"${transcript}"

Daftar kategori yang TERSEDIA (pilih id yang paling cocok):
${catLines}

Daftar GOAL/target tabungan keluarga (untuk setoran ke kategori Nabung/Tabungan):
${goalLines}

Kalau group itu kategorinya Nabung/Tabungan DAN user menyebut nama target (misal "nabung buat umroh", "tabungan jepang"), isi "goal_id" dengan id goal yang paling cocok dari daftar di atas. Kalau tidak menyebut target atau bukan nabung, kosongkan goal_id.

PENTING: Satu transkrip bisa berisi BEBERAPA item, dan item-item itu bisa dari KATEGORI BERBEDA. Kelompokkan item berdasarkan kategori yang paling cocok. SETIAP kategori menjadi SATU pengeluaran terpisah (satu "group"). Item dalam kategori yang sama digabung dan harganya dijumlahkan.

Contoh: "jeruk 15rb, apel 10rb, kaca spion motor 70rb"
- group 1 (kategori buah/belanja dapur): jeruk 15000 + apel 10000 -> deskripsi "Jeruk, apel"
- group 2 (kategori transportasi/motor): kaca spion motor 70000 -> deskripsi "Kaca spion motor"
=> menghasilkan 2 group.

Kalau semua item satu kategori, cukup 1 group.

Format tiap "group":
- "items": daftar item di group itu, {name, price}. price = harga dalam RUPIAH (integer). Pahami slang uang Indonesia: "goceng"=5000, "ceban"=10000, "goban"/"gocap" bisa 50000, "cepek"=100000, "gopek"=500, "seceng"=1000, "noban"=20000, "ban"=ribu, "jt"/"juta"=1000000, "rb"/"ribu"=1000. Contoh: "lima puluh ribu"=50000, "dua puluh lima ribu"=25000.
- "deskripsi": gabungan nama item di group itu, dipisah koma, rapikan kapitalisasi. Kalau 1 item pakai nama item itu.
- "category_id": HARUS salah satu id dari daftar di atas yang paling cocok untuk group itu.

Output dalam format JSON:
{
  "groups": [
    {
      "deskripsi": "Nama item",
      "category_id": "uuid-kategori",
      "goal_id": "uuid-goal atau null",
      "items": [{ "name": "item", "price": 15000 }]
    }
  ]
}

Jika transkrip tidak menyebut pengeluaran, set groups=[].`;

  try {
    const extractRes = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${deepseekKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        messages: [
          {
            role: "system",
            content:
              "Kamu asisten pencatat keuangan keluarga Indonesia. Output dalam JSON sesuai instruksi user.",
          },
          { role: "user", content: extractPrompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!extractRes.ok) {
      const errBody = await extractRes.text().catch(() => "");
      return NextResponse.json(
        { error: `Gagal ekstrak data: ${extractRes.status}${errBody ? " - " + errBody.slice(0, 200) : ""}` },
        { status: 502 },
      );
    }

    const extractData = await extractRes.json();
    const rawText = extractData.choices?.[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(rawText) as {
      groups?: {
        deskripsi?: string;
        category_id?: string;
        goal_id?: string;
        items?: { name?: string; price?: number }[];
      }[];
    };

    const groups = (parsed.groups ?? [])
      .map((g) => {
        const validCat = catList.find((c) => c.id === g.category_id);
        const validGoal = goalList.find((gl) => gl.id === g.goal_id);
        const items = (g.items ?? [])
          .map((it) => ({
            name: (it.name ?? "").trim(),
            price: Math.max(0, Math.round(Number(it.price) || 0)),
          }))
          .filter((it) => it.name || it.price > 0);
        const amount = items.reduce((s, it) => s + it.price, 0);
        return {
          description: (g.deskripsi ?? "").trim(),
          amount,
          category_id: validCat?.id ?? null,
          category_name: validCat?.name ?? null,
          goal_id: validGoal?.id ?? null,
          goal_name: validGoal?.name ?? null,
          items,
        };
      })
      .filter((g) => g.amount > 0 || g.description);

    return NextResponse.json({
      transcript,
      groups,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Gagal memproses transkrip.";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

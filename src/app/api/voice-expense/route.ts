import { NextResponse } from "next/server";
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { createClient } from "@/lib/supabase/server";
import { getCurrentHouseholdId } from "@/lib/supabase/household";

// Voice note -> structured expense via Gemini (multimodal, single call).
// The browser records audio and POSTs it here; we transcribe + extract
// description, amount (rupiah), and the best-matching category in one shot.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODEL = process.env.GEMINI_MODEL || "gemini-3.1-flash-lite";

export async function POST(req: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY belum di-set di environment." },
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

  // Active goals — so a "Nabung" deposit can be tagged to a target by voice.
  const { data: goalsData } = await supabase
    .from("goals")
    .select("id,name")
    .eq("household_id", householdId)
    .eq("status", "active")
    .order("sort_order");
  const goalList = goalsData ?? [];

  // Read the uploaded audio
  let audioBuffer: Buffer;
  let mimeType: string;
  try {
    const form = await req.formData();
    const file = form.get("audio");
    if (!(file instanceof Blob)) {
      return NextResponse.json({ error: "Audio tidak ditemukan." }, { status: 400 });
    }
    mimeType = file.type || "audio/webm";
    audioBuffer = Buffer.from(await file.arrayBuffer());
  } catch {
    return NextResponse.json({ error: "Gagal membaca audio." }, { status: 400 });
  }

  if (audioBuffer.length === 0) {
    return NextResponse.json({ error: "Audio kosong." }, { status: 400 });
  }

  const catLines = catList.map((c) => `- ${c.name} (id: ${c.id})`).join("\n");
  const goalLines = goalList.length
    ? goalList.map((g) => `- ${g.name} (id: ${g.id})`).join("\n")
    : "(belum ada goal)";

  const prompt = `Kamu asisten pencatat keuangan keluarga Indonesia. Dengarkan rekaman suara ini dan ekstrak pengeluaran.

Daftar kategori yang TERSEDIA (pilih id yang paling cocok):
${catLines}

Daftar GOAL/target tabungan keluarga (untuk setoran ke kategori Nabung/Tabungan):
${goalLines}

Kalau group itu kategorinya Nabung/Tabungan DAN user menyebut nama target (misal "nabung buat umroh", "tabungan jepang"), isi "goal_id" dengan id goal yang paling cocok dari daftar di atas. Kalau tidak menyebut target atau bukan nabung, kosongkan goal_id.

PENTING: Satu rekaman bisa berisi BEBERAPA item, dan item-item itu bisa dari KATEGORI BERBEDA. Kelompokkan item berdasarkan kategori yang paling cocok. SETIAP kategori menjadi SATU pengeluaran terpisah (satu "group"). Item dalam kategori yang sama digabung dan harganya dijumlahkan.

Contoh: "jeruk 15rb, apel 10rb, kaca spion motor 70rb"
- group 1 (kategori buah/belanja dapur): jeruk 15000 + apel 10000 -> deskripsi "Jeruk, apel"
- group 2 (kategori transportasi/motor): kaca spion motor 70000 -> deskripsi "Kaca spion motor"
=> menghasilkan 2 group.

Kalau semua item satu kategori, cukup 1 group.

Format tiap "group":
- "items": daftar item di group itu, {name, price}. price = harga dalam RUPIAH (integer). Pahami slang uang Indonesia: "goceng"=5000, "ceban"=10000, "goban"/"gocap" bisa 50000, "cepek"=100000, "gopek"=500, "seceng"=1000, "noban"=20000, "ban"=ribu, "jt"/"juta"=1000000, "rb"/"ribu"=1000. Contoh: "lima puluh ribu"=50000, "dua puluh lima ribu"=25000.
- "deskripsi": gabungan nama item di group itu, dipisah koma, rapikan kapitalisasi. Kalau 1 item pakai nama item itu.
- "category_id": HARUS salah satu id dari daftar di atas yang paling cocok untuk group itu.

Output:
- "groups": array berisi group-group di atas.
- "transcript": tulis ulang apa yang kamu dengar apa adanya (untuk verifikasi user).
- Jika audio tidak jelas atau tidak menyebut pengeluaran, set groups=[].`;

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: MODEL,
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            transcript: { type: SchemaType.STRING },
            groups: {
              type: SchemaType.ARRAY,
              items: {
                type: SchemaType.OBJECT,
                properties: {
                  deskripsi: { type: SchemaType.STRING },
                  category_id: { type: SchemaType.STRING },
                  goal_id: { type: SchemaType.STRING },
                  items: {
                    type: SchemaType.ARRAY,
                    items: {
                      type: SchemaType.OBJECT,
                      properties: {
                        name: { type: SchemaType.STRING },
                        price: { type: SchemaType.NUMBER },
                      },
                      required: ["name", "price"],
                    },
                  },
                },
                required: ["deskripsi", "category_id", "items"],
              },
            },
          },
          required: ["transcript", "groups"],
        },
      },
    });

    const result = await model.generateContent([
      { text: prompt },
      { inlineData: { mimeType, data: audioBuffer.toString("base64") } },
    ]);

    const raw = result.response.text();
    const parsed = JSON.parse(raw) as {
      transcript?: string;
      groups?: {
        deskripsi?: string;
        category_id?: string;
        goal_id?: string;
        items?: { name?: string; price?: number }[];
      }[];
    };

    // Build each group: validate its category, recompute total from items
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
      transcript: (parsed.transcript ?? "").trim(),
      groups,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Gagal memproses audio.";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

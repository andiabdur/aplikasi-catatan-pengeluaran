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

  const prompt = `Kamu asisten pencatat keuangan keluarga Indonesia. Dengarkan rekaman suara ini dan ekstrak SATU pengeluaran.

Daftar kategori yang TERSEDIA (pilih SALAH SATU id yang paling cocok):
${catLines}

PENTING: Satu rekaman bisa berisi BEBERAPA item belanja dalam satu kalimat. Contoh: "jeruk 10rb, salak 17rb, apel 33rb". Semua harga harus DIJUMLAHKAN jadi satu total.

Aturan:
- "items": daftar SETIAP item yang disebut beserta harganya, format {name, price}. price = harga item itu dalam RUPIAH (integer). Kalau cuma 1 item, isi 1 elemen. Pahami slang uang Indonesia: "goceng"=5000, "ceban"=10000, "goban"/"gocap" bisa 50000, "cepek"=100000, "gopek"=500, "seceng"=1000, "noban"=20000, "ban"=ribu, "jt"/"juta"=1000000, "rb"/"ribu"=1000. Contoh: "lima puluh ribu"=50000, "dua puluh lima ribu"=25000, "seratus dua puluh lima ribu"=125000.
- "amount": TOTAL = penjumlahan SEMUA price di items. Contoh "jeruk 10rb, salak 17rb, apel 33rb" => 10000+17000+33000 = 60000.
- "deskripsi": ringkas. Kalau banyak item, gabungkan nama item dipisah koma (contoh: "Jeruk, salak, apel"). Kalau 1 item, pakai nama item itu (rapikan kapitalisasi).
- "category_id": HARUS salah satu id dari daftar di atas, satu kategori yang paling cocok untuk KESELURUHAN belanja. Jika ragu, pilih yang paling umum/masuk akal.
- "transcript": tulis ulang apa yang kamu dengar apa adanya (untuk verifikasi user).
- Jika audio tidak jelas atau tidak menyebut pengeluaran, set amount=0, deskripsi kosong, items=[].`;

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: MODEL,
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            deskripsi: { type: SchemaType.STRING },
            amount: { type: SchemaType.NUMBER },
            category_id: { type: SchemaType.STRING },
            transcript: { type: SchemaType.STRING },
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
          required: ["deskripsi", "amount", "category_id", "transcript", "items"],
        },
      },
    });

    const result = await model.generateContent([
      { text: prompt },
      { inlineData: { mimeType, data: audioBuffer.toString("base64") } },
    ]);

    const raw = result.response.text();
    const parsed = JSON.parse(raw) as {
      deskripsi?: string;
      amount?: number;
      category_id?: string;
      transcript?: string;
      items?: { name?: string; price?: number }[];
    };

    // Validate category_id against the real list; fall back if hallucinated
    const validCat = catList.find((c) => c.id === parsed.category_id);

    // Normalize items; recompute total from items so the math is always exact
    const items = (parsed.items ?? [])
      .map((it) => ({
        name: (it.name ?? "").trim(),
        price: Math.max(0, Math.round(Number(it.price) || 0)),
      }))
      .filter((it) => it.name || it.price > 0);

    const itemsTotal = items.reduce((s, it) => s + it.price, 0);
    const amount = itemsTotal > 0 ? itemsTotal : Math.max(0, Math.round(Number(parsed.amount) || 0));

    return NextResponse.json({
      description: (parsed.deskripsi ?? "").trim(),
      amount,
      category_id: validCat?.id ?? null,
      transcript: (parsed.transcript ?? "").trim(),
      items,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Gagal memproses audio.";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

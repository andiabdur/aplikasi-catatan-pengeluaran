import { NextResponse } from "next/server";
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { createClient } from "@/lib/supabase/server";
import { getCurrentHouseholdId } from "@/lib/supabase/household";

// Voice note -> structured expense via Gemini (multimodal, single call).
// The browser records audio and POSTs it here; we transcribe + extract
// description, amount (rupiah), and the best-matching category in one shot.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash";

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

Aturan:
- "deskripsi": nama singkat barang/kebutuhan yang disebut (contoh: "Bensin", "Susu anak", "Makan siang"). Rapikan kapitalisasi.
- "amount": nominal dalam RUPIAH sebagai angka bulat (integer), tanpa titik/koma. Pahami slang uang Indonesia: "goceng"=5000, "ceban"=10000, "goban"/"gocap" bisa 50000, "cepek"=100000, "gopek"=500, "seceng"=1000, "noban"=20000, "ban"=ribu, "jt"/"juta"=1000000, "rb"/"ribu"=1000. Contoh: "lima puluh ribu"=50000, "dua puluh lima ribu"=25000, "seratus dua puluh lima ribu"=125000, "dua juta setengah"=2500000.
- "category_id": HARUS salah satu id dari daftar di atas, yang paling cocok dengan deskripsi. Jika ragu, pilih yang paling umum/masuk akal.
- "transcript": tulis ulang apa yang kamu dengar apa adanya (untuk verifikasi user).
- Jika audio tidak jelas atau tidak menyebut pengeluaran, set amount=0 dan deskripsi kosong.`;

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
          },
          required: ["deskripsi", "amount", "category_id", "transcript"],
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
    };

    // Validate category_id against the real list; fall back if hallucinated
    const validCat = catList.find((c) => c.id === parsed.category_id);

    return NextResponse.json({
      description: (parsed.deskripsi ?? "").trim(),
      amount: Math.max(0, Math.round(Number(parsed.amount) || 0)),
      category_id: validCat?.id ?? null,
      transcript: (parsed.transcript ?? "").trim(),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Gagal memproses audio.";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

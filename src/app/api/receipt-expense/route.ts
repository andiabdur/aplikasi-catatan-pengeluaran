import { NextResponse } from "next/server";
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { createClient } from "@/lib/supabase/server";
import { getCurrentHouseholdId } from "@/lib/supabase/household";

// Receipt/struk photo -> structured expense groups via Gemini Vision.
// Same output format as /api/voice-expense so client can reuse the same flow.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODEL = process.env.GEMINI_MODEL || "gemini-3.1-flash-lite";

export async function POST(req: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "GEMINI_API_KEY belum di-set." }, { status: 500 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Belum login." }, { status: 401 });

  const householdId = await getCurrentHouseholdId();
  if (!householdId) return NextResponse.json({ error: "Household tidak ditemukan." }, { status: 400 });

  const { data: categories } = await supabase
    .from("categories")
    .select("id,name")
    .eq("household_id", householdId)
    .eq("is_archived", false)
    .order("sort_order");

  const catList = categories ?? [];
  if (catList.length === 0) return NextResponse.json({ error: "Belum ada kategori." }, { status: 400 });

  const { data: goalsData } = await supabase
    .from("goals")
    .select("id,name")
    .eq("household_id", householdId)
    .eq("status", "active");
  const goalList = goalsData ?? [];

  // Read uploaded image
  let imageBuffer: Buffer;
  let mimeType: string;
  try {
    const form = await req.formData();
    const file = form.get("image");
    if (!(file instanceof Blob)) return NextResponse.json({ error: "Gambar tidak ditemukan." }, { status: 400 });
    mimeType = file.type || "image/jpeg";
    imageBuffer = Buffer.from(await file.arrayBuffer());
  } catch {
    return NextResponse.json({ error: "Gagal membaca gambar." }, { status: 400 });
  }

  if (imageBuffer.length === 0) return NextResponse.json({ error: "Gambar kosong." }, { status: 400 });

  const catLines = catList.map((c) => `- ${c.name} (id: ${c.id})`).join("\n");
  const goalLines = goalList.length
    ? goalList.map((g) => `- ${g.name} (id: ${g.id})`).join("\n")
    : "(belum ada goal)";

  const prompt = `Kamu asisten pencatat keuangan keluarga Indonesia. Lihat foto struk/nota/bon/kwitansi ini dan ekstrak semua pengeluaran.

Daftar kategori TERSEDIA (pilih id yang paling cocok untuk tiap item):
${catLines}

Goal/target tabungan (untuk setoran nabung):
${goalLines}

INSTRUKSI:
- Baca semua item di struk beserta harganya
- Kelompokkan item berdasarkan kategori yang paling cocok
- Setiap kategori = satu "group" terpisah
- Kalau semua item satu kategori, cukup 1 group
- Untuk total/subtotal/pajak: masukkan ke grup yang relevan atau buat grup sendiri
- Kalau ada item nabung/tabungan dan ada goal yang cocok, isi goal_id

Format tiap group:
- "items": [{name, price}] — price dalam RUPIAH (integer)
- "deskripsi": nama ringkas group, dipisah koma kalau banyak item
- "category_id": id dari daftar di atas

Output:
- "groups": array group-group di atas
- "merchant": nama toko/merchant kalau terlihat di struk (atau "" kalau tidak ada)
- "date": tanggal struk kalau tertulis dalam format YYYY-MM-DD (atau "" kalau tidak ada)
Kalau gambar bukan struk atau tidak terbaca, set groups=[].`;

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: MODEL,
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            merchant: { type: SchemaType.STRING },
            date: { type: SchemaType.STRING },
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
          required: ["groups", "merchant", "date"],
        },
      },
    });

    const result = await model.generateContent([
      { text: prompt },
      { inlineData: { mimeType, data: imageBuffer.toString("base64") } },
    ]);

    const parsed = JSON.parse(result.response.text()) as {
      merchant?: string;
      date?: string;
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
      groups,
      merchant: (parsed.merchant ?? "").trim(),
      date: (parsed.date ?? "").trim(),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Gagal membaca struk.";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

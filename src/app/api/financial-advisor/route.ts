import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentHouseholdId } from "@/lib/supabase/household";
import { buildFinancialContext } from "@/lib/financial-context";

// AI financial planner. Reads a few recent salary periods (budget vs realisasi
// per category) + income + goals progress, then asks DeepSeek to diagnose spending
// behaviour, give recommendations, and propose next period's budget per category.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODEL = process.env.DEEPSEEK_MODEL || "deepseek-chat";
const PERIODS_TO_ANALYZE = 3;

export async function POST() {
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

  const ctx = await buildFinancialContext(supabase, householdId, PERIODS_TO_ANALYZE);
  if (!ctx) {
    return NextResponse.json({ error: "Belum ada data kategori untuk dianalisa." }, { status: 400 });
  }
  const { digest, itemDigest, goalDigest, eventDigest, memoryDigest, catList } = ctx;
  const catLines = catList.map((c) => `- ${c.name} (id: ${c.id})`).join("\n");

  const prompt = `Kamu adalah Chief Financial Officer (CFO) & Senior Certified Financial Planner (CFP) Keluarga. Tugasmu adalah melakukan AUDIT KEUANGAN MENDALAM terhadap ${PERIODS_TO_ANALYZE} periode gajian terakhir keluarga ini, lalu menyusun diagnosa strategis dan rencana anggaran terukur.

DATA PERIODE & INDIKATOR KEUANGAN KELUARGA (Pemasukan, Pengeluaran, Savings Rate, Overbudget):
${digest}

DETAIL TRANSAKSI PER PERIODE (Tanggal, deskripsi, nominal, event):
${itemDigest}

GOAL / TARGET TABUNGAN KELUARGA:
${goalDigest}

EVENT / KEGIATAN KELUARGA (Liburan, Dinas, Acara, dll):
${eventDigest}

MEMORI & CATATAN PENTING KELUARGA:
${memoryDigest}

KATEGORI KEUANGAN (Gunakan ID ini untuk usulan budget):
${catLines}

TUGAS AUDIT (Gunakan Bahasa Indonesia profesional, lugas, hangat, dan komunikatif, panggil mereka "kamu sekeluarga"):
1. "summary": Executive summary 2-3 kalimat yang sangat padat dan tajam mengenai kesehatan finansial keluarga, stabilitas cashflow, serta rasio tabungan (Savings Rate).
2. "health": Pilih satu kata kunci berdasarkan indikator obyektif: "sehat" (surplus & savings rate baik >=15%), "waspada" (savings rate tipis <15% / overbudget beberapa kategori), atau "boncos" (defisit / pengeluaran melebihi pemasukan).
3. "insights": Daftar 3-5 temuan analitis mendalam (kategori kebocoran utama, anomali pengeluaran, dampak event, atau kebiasaan positif). Tiap item {title, detail, severity: "good"|"warning"|"danger"}. Sertakan angka nominal Rupiah konkret.
4. "action_now": 3-4 langkah aksi taktis dan berprioritas tinggi yang wajib dieksekusi periode ini untuk memperbaiki cashflow (array string).
5. "suggested_budgets": Usulan anggaran realistis & strategis untuk periode DEPAN (${ctx.nextPeriodTitle}) per kategori. Tiap item {category_id, category_name, amount (integer Rupiah), reason (alasan berbasis historis + optimasi)}. Dorong alokasi tabungan jika cashflow memungkinkan.
6. "goal_advice": Analisis spesifik per goal mengenai kelayakan ketercapaian target berdasarkan laju tabungan saat ini dan sisa waktu target date. Tiap item {goal_name, advice}. Jika belum ada goal, kosongkan array.

PRINSIP AUDIT: Sebut nominal Rupiah konkret. Jangan teori umum. JANGAN PAKAI TABEL MARKDOWN (tampil di HP, pakai bullet/paragraf).

Output JSON dengan field persis: summary, health, insights (array), action_now (array of string), suggested_budgets (array), goal_advice (array).`;

  try {
    const apiUrl = process.env.DEEPSEEK_API_URL || "https://api.deepseek.com/chat/completions";
    const res = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          {
            role: "system",
            content:
              "Kamu adalah Chief Financial Officer (CFO) & Senior Certified Financial Planner (CFP) Keluarga. Analisis data finansial keluarga ini secara tajam, jujur, realistis, dan berbobot berbasis indikator keuangan profesional (Savings Rate, Burn Rate, Overbudget ratio, dan Goal Feasibility). Output SELALU dalam format JSON sesuai instruksi.",
          },
          { role: "user", content: prompt },
        ],
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
    let raw = (data.choices?.[0]?.message?.content ?? "{}").trim();
    if (raw.startsWith("```json")) {
      raw = raw.slice(7);
    } else if (raw.startsWith("```")) {
      raw = raw.slice(3);
    }
    if (raw.endsWith("```")) {
      raw = raw.slice(0, -3);
    }
    raw = raw.trim();
    const parsed = JSON.parse(raw) as {
      summary?: string;
      health?: string;
      insights?: { title?: string; detail?: string; severity?: string }[];
      action_now?: string[];
      suggested_budgets?: {
        category_id?: string;
        category_name?: string;
        amount?: number;
        reason?: string;
      }[];
      goal_advice?: { goal_name?: string; advice?: string }[];
    };

    // Validate suggested budgets against the real category list
    const suggested = (parsed.suggested_budgets ?? [])
      .map((s) => {
        const cat = catList.find((c) => c.id === s.category_id);
        if (!cat) return null;
        return {
          category_id: cat.id,
          category_name: cat.name,
          amount: Math.max(0, Math.round(Number(s.amount) || 0)),
          reason: (s.reason ?? "").trim(),
        };
      })
      .filter((s): s is NonNullable<typeof s> => s !== null);

    return NextResponse.json({
      summary: (parsed.summary ?? "").trim(),
      health: (parsed.health ?? "").trim().toLowerCase(),
      insights: (parsed.insights ?? []).map((i) => ({
        title: (i.title ?? "").trim(),
        detail: (i.detail ?? "").trim(),
        severity: ["good", "warning", "danger"].includes(i.severity ?? "") ? i.severity : "warning",
      })),
      action_now: (parsed.action_now ?? []).map((a) => String(a).trim()).filter(Boolean),
      suggested_budgets: suggested,
      goal_advice: (parsed.goal_advice ?? []).map((g) => ({
        goal_name: (g.goal_name ?? "").trim(),
        advice: (g.advice ?? "").trim(),
      })),
      next_label_month: ctx.nextLabelMonth,
      next_period_title: ctx.nextPeriodTitle,
      periods_analyzed: ctx.periodsAnalyzed,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Gagal menganalisa keuangan.";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

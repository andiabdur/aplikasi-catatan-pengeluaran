import { NextResponse } from "next/server";
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { createClient } from "@/lib/supabase/server";
import { getCurrentHouseholdId } from "@/lib/supabase/household";
import {
  currentPeriodLabelWithCustom,
  labelMonthKey,
  shiftPeriod,
  periodTitle,
} from "@/lib/period";
import type { MonthlySummaryRow } from "@/lib/types";

// AI financial planner. Reads a few recent salary periods (budget vs realisasi
// per category) + income + goals progress, then asks Gemini to diagnose spending
// behaviour, give recommendations, and propose next period's budget per category.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODEL = process.env.GEMINI_MODEL || "gemini-3.1-flash-lite";
const PERIODS_TO_ANALYZE = 3;

export async function POST() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY belum di-set di environment." },
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

  // Pay day + custom periods to compute period labels
  const [hhRes, cpRes, goalsRes, depositsRes] = await Promise.all([
    supabase.from("households").select("pay_day_of_month").eq("id", householdId).maybeSingle(),
    supabase.from("custom_periods").select("label_month, start_date, end_date").eq("household_id", householdId),
    supabase.from("goals").select("id,name,target_amount,target_date,status").eq("household_id", householdId).eq("status", "active"),
    supabase.from("expenses").select("goal_id, amount").eq("household_id", householdId).not("goal_id", "is", null),
  ]);

  const payDay = hhRes.data?.pay_day_of_month ?? 25;
  const customPeriods = cpRes.data ?? [];
  const goals = goalsRes.data ?? [];

  // Goals progress = sum of tagged deposits
  const savedByGoal = new Map<string, number>();
  (depositsRes.data ?? []).forEach((d) => {
    if (!d.goal_id) return;
    savedByGoal.set(d.goal_id, (savedByGoal.get(d.goal_id) ?? 0) + Number(d.amount));
  });

  // Current label + the previous N (oldest → newest)
  const currentLabel = currentPeriodLabelWithCustom(payDay, customPeriods);
  const labels: Date[] = [];
  for (let i = PERIODS_TO_ANALYZE - 1; i >= 0; i--) {
    labels.push(shiftPeriod(currentLabel, -i));
  }
  const nextLabel = shiftPeriod(currentLabel, 1);

  // Pull per-period category summaries + incomes
  const perPeriod = await Promise.all(
    labels.map(async (lbl) => {
      const key = labelMonthKey(lbl);
      const [sumRes, incRes] = await Promise.all([
        supabase.rpc("f_period_summary", { p_household_id: householdId, p_label_month: key }),
        supabase.from("incomes").select("source, amount").eq("household_id", householdId).eq("month", key),
      ]);
      const rows = (sumRes.data ?? []) as MonthlySummaryRow[];
      const income = (incRes.data ?? []).reduce((s, r) => s + Number(r.amount), 0);
      return { key, title: periodTitle(lbl), rows, income };
    }),
  );

  // Category id↔name map (from the most recent period rows)
  const latest = perPeriod[perPeriod.length - 1];
  const catList = (latest?.rows ?? []).map((r) => ({ id: r.category_id, name: r.category_name }));
  if (catList.length === 0) {
    return NextResponse.json({ error: "Belum ada data kategori untuk dianalisa." }, { status: 400 });
  }

  // Build a compact, human-readable data digest for the model
  const digest = perPeriod
    .map((p) => {
      const lines = p.rows
        .map(
          (r) =>
            `   - ${r.category_name}: budget ${Math.round(Number(r.budget))}, terpakai ${Math.round(
              Number(r.spent),
            )} (${Math.round(Number(r.usage_pct))}%)`,
        )
        .join("\n");
      return `${p.title} — pemasukan ${Math.round(p.income)}:\n${lines}`;
    })
    .join("\n\n");

  const goalDigest = goals.length
    ? goals
        .map((g) => {
          const saved = savedByGoal.get(g.id) ?? 0;
          const pct = g.target_amount > 0 ? Math.round((saved / Number(g.target_amount)) * 100) : 0;
          return `- ${g.name}: terkumpul ${Math.round(saved)} dari target ${Math.round(
            Number(g.target_amount),
          )} (${pct}%)${g.target_date ? `, target tanggal ${g.target_date}` : ""}`;
        })
        .join("\n")
    : "(belum ada goal)";

  const catLines = catList.map((c) => `- ${c.name} (id: ${c.id})`).join("\n");

  const prompt = `Kamu penasihat keuangan keluarga Indonesia yang membumi, jujur, dan praktis. Analisa data ${PERIODS_TO_ANALYZE} periode gajian terakhir keluarga ini, lalu beri diagnosa + rencana.

DATA PER PERIODE (budget vs realisasi per kategori):
${digest}

GOAL/TARGET TABUNGAN:
${goalDigest}

KATEGORI yang tersedia untuk usulan budget (pakai id ini):
${catLines}

Tugasmu (semua dalam Bahasa Indonesia yang santai tapi sopan, panggil mereka "kamu sekeluarga"):
1. "summary": 2-3 kalimat ringkasan kondisi keuangan keluarga + tingkat kesehatannya.
2. "health": satu kata: "sehat", "waspada", atau "boncos".
3. "insights": daftar 3-5 temuan penting (kategori yang sering jebol, pola boros, hal positif). Tiap item {title, detail, severity: "good"|"warning"|"danger"}.
4. "action_now": 2-4 hal konkret yang harus ditekan/diperbaiki BULAN INI (array string).
5. "suggested_budgets": usulan budget untuk periode DEPAN per kategori. Tiap item {category_id (harus dari daftar id di atas), category_name, amount (integer rupiah), reason (alasan singkat)}. Realistis: berbasis rata-rata realisasi + buffer, dorong alokasi Nabung kalau memungkinkan.
6. "goal_advice": saran per goal apakah laju nabung cukup buat capai target tepat waktu. Tiap item {goal_name, advice}. Kalau belum ada goal, kosongkan array.

Jujur kalau memang boros, tapi tetap suportif dan beri jalan keluar.`;

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: MODEL,
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            summary: { type: SchemaType.STRING },
            health: { type: SchemaType.STRING },
            insights: {
              type: SchemaType.ARRAY,
              items: {
                type: SchemaType.OBJECT,
                properties: {
                  title: { type: SchemaType.STRING },
                  detail: { type: SchemaType.STRING },
                  severity: { type: SchemaType.STRING },
                },
                required: ["title", "detail", "severity"],
              },
            },
            action_now: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
            suggested_budgets: {
              type: SchemaType.ARRAY,
              items: {
                type: SchemaType.OBJECT,
                properties: {
                  category_id: { type: SchemaType.STRING },
                  category_name: { type: SchemaType.STRING },
                  amount: { type: SchemaType.NUMBER },
                  reason: { type: SchemaType.STRING },
                },
                required: ["category_id", "category_name", "amount", "reason"],
              },
            },
            goal_advice: {
              type: SchemaType.ARRAY,
              items: {
                type: SchemaType.OBJECT,
                properties: {
                  goal_name: { type: SchemaType.STRING },
                  advice: { type: SchemaType.STRING },
                },
                required: ["goal_name", "advice"],
              },
            },
          },
          required: ["summary", "health", "insights", "action_now", "suggested_budgets", "goal_advice"],
        },
      },
    });

    const result = await model.generateContent(prompt);
    const parsed = JSON.parse(result.response.text()) as {
      summary?: string;
      health?: string;
      insights?: { title?: string; detail?: string; severity?: string }[];
      action_now?: string[];
      suggested_budgets?: { category_id?: string; category_name?: string; amount?: number; reason?: string }[];
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
      next_label_month: labelMonthKey(nextLabel),
      next_period_title: periodTitle(nextLabel),
      periods_analyzed: perPeriod.map((p) => p.title),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Gagal menganalisa keuangan.";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

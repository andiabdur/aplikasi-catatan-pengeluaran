import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const deepseekKey = process.env.OPENAI_API_KEY || process.env.DEEPSEEK_API_KEY;
  if (!deepseekKey) {
    return NextResponse.json(
      { error: "Key API belum di-set di environment." },
      { status: 500 },
    );
  }

  try {
    const { text } = await req.json();
    if (!text || !text.trim()) {
      return NextResponse.json({ error: "Teks kosong." }, { status: 400 });
    }

    const ttsUrl = (process.env.OPENAI_BASE_URL ? `${process.env.OPENAI_BASE_URL}/audio/speech` : null) || "http://localhost:20128/v1/audio/speech";
    const res = await fetch(ttsUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${deepseekKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_TTS_MODEL || "tts-1",
        input: text.trim(),
        voice: "alloy",
      }),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      return NextResponse.json(
        { error: `Gagal TTS: ${res.status}${errBody ? " - " + errBody.slice(0, 200) : ""}` },
        { status: 502 },
      );
    }

    // Return the raw binary audio stream to the client
    const audioBuffer = await res.arrayBuffer();
    return new Response(audioBuffer, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Gagal menerjemahkan teks ke suara.";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

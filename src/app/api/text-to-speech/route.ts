import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AudioCandidate = {
  data?: unknown;
  format?: unknown;
};

function audioContentType(format: string) {
  if (format === "wav") return "audio/wav";
  if (format === "opus") return "audio/opus";
  if (format === "aac") return "audio/aac";
  return "audio/mpeg";
}

function cleanBase64Audio(data: string) {
  const commaIndex = data.indexOf(",");
  if (data.startsWith("data:") && commaIndex >= 0) {
    return data.slice(commaIndex + 1);
  }
  return data;
}

function findAudioCandidate(value: unknown): AudioCandidate | null {
  if (!value || typeof value !== "object") return null;

  const obj = value as Record<string, unknown>;
  const directAudio = obj.audio as AudioCandidate | undefined;
  if (directAudio?.data) return directAudio;

  if (typeof obj.data === "string" && (obj.type === "output_audio" || obj.type === "audio" || obj.format)) {
    return { data: obj.data, format: obj.format };
  }

  if (typeof obj.output_audio === "object" && obj.output_audio !== null) {
    const candidate = obj.output_audio as AudioCandidate;
    if (candidate.data) return candidate;
  }

  for (const key of ["output", "content", "choices"]) {
    const items = obj[key];
    if (!Array.isArray(items)) continue;

    for (const item of items) {
      const candidate = findAudioCandidate(item);
      if (candidate) return candidate;
    }
  }

  const message = obj.message;
  if (message && typeof message === "object") {
    return findAudioCandidate(message);
  }

  return null;
}

async function speechFromResponses(params: {
  key: string;
  text: string;
  voice: string;
  format: string;
}) {
  const baseUrl = process.env.OPENAI_BASE_URL || "http://localhost:20128/v1";
  const responsesUrl = process.env.OPENAI_TTS_RESPONSES_URL || `${baseUrl}/responses`;
  const model = process.env.OPENAI_TTS_MODEL || "cx/gpt-5.5-high";

  const res = await fetch(responsesUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text:
                "Ucapkan teks berikut sebagai audio Bahasa Indonesia yang natural. " +
                "Jangan ubah isi teks, jangan tambahkan komentar, dan jangan jawab dalam teks.\n\n" +
                params.text,
            },
          ],
        },
      ],
      modalities: ["audio"],
      audio: {
        voice: params.voice,
        format: params.format,
      },
    }),
  });

  const contentType = res.headers.get("content-type") || "";
  if (res.ok && contentType.startsWith("audio/")) {
    return new Response(await res.arrayBuffer(), {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600",
      },
    });
  }

  const rawBody = await res.text().catch(() => "");
  if (!res.ok) {
    throw new Error(`Responses audio gagal: ${res.status}${rawBody ? " - " + rawBody.slice(0, 200) : ""}`);
  }

  let data: unknown;
  try {
    data = JSON.parse(rawBody);
  } catch {
    throw new Error("Responses audio tidak mengembalikan JSON audio yang valid.");
  }

  const candidate = findAudioCandidate(data);
  if (!candidate || typeof candidate.data !== "string") {
    throw new Error("Responses audio tidak berisi payload audio.");
  }

  const format = typeof candidate.format === "string" ? candidate.format : params.format;
  const audioBuffer = Buffer.from(cleanBase64Audio(candidate.data), "base64");
  return new Response(audioBuffer, {
    headers: {
      "Content-Type": audioContentType(format),
      "Cache-Control": "public, max-age=3600",
    },
  });
}

async function speechFromAudioEndpoint(params: {
  key: string;
  text: string;
  voice: string;
  format: string;
}) {
  const baseUrl = process.env.OPENAI_BASE_URL || "http://localhost:20128/v1";
  const ttsUrl = process.env.OPENAI_TTS_SPEECH_URL || `${baseUrl}/audio/speech`;
  const model = process.env.OPENAI_TTS_SPEECH_MODEL || "tts-1";

  const res = await fetch(ttsUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: params.text,
      voice: params.voice,
      response_format: params.format,
    }),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    throw new Error(`Speech endpoint gagal: ${res.status}${errBody ? " - " + errBody.slice(0, 200) : ""}`);
  }

  return new Response(await res.arrayBuffer(), {
    headers: {
      "Content-Type": audioContentType(params.format),
      "Cache-Control": "public, max-age=3600",
    },
  });
}

export async function POST(req: Request) {
  const apiKey = process.env.OPENAI_API_KEY || process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
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

    const input = text.trim();
    const voice = process.env.OPENAI_TTS_VOICE || "alloy";
    const format = process.env.OPENAI_TTS_FORMAT || "mp3";

    try {
      return await speechFromResponses({ key: apiKey, text: input, voice, format });
    } catch (responsesErr) {
      try {
        return await speechFromAudioEndpoint({ key: apiKey, text: input, voice, format });
      } catch (speechErr) {
        const responsesMsg = responsesErr instanceof Error ? responsesErr.message : "Responses audio gagal.";
        const speechMsg = speechErr instanceof Error ? speechErr.message : "Speech endpoint gagal.";
        return NextResponse.json(
          { error: `Gagal TTS: ${responsesMsg}; fallback: ${speechMsg}` },
          { status: 502 },
        );
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Gagal menerjemahkan teks ke suara.";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

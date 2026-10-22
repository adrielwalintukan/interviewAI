"use server";

import { z } from "zod";
import { requireUser } from "@/features/auth/dal";
import { ttsEnv } from "@/lib/env";
import { isTimeoutError, logLlmCall } from "@/lib/llm/log";
import { loadOwnActiveSession } from "./context";

const GEMINI = "https://generativelanguage.googleapis.com";

/**
 * Mode hemat: speaks the character's latest reply with the SAME prebuilt voice it has in Live,
 * so the character never changes voice (browser voices can't match language/gender reliably).
 * Takes no text from the browser: only the latest stored character reply of the caller's own active
 * session, at most once per reply (`claim_tts`).
 * Returns base64 raw PCM16 24 kHz mono (WAV header stripped, see `pcmOf`), or null ⇒ the stage shows text only.
 */
export async function speakLastReply(sessionId: string): Promise<{ audio: string | null }> {
  const user = await requireUser({ roles: ["pelajar", "pengajar"] });
  if (!z.uuid().safeParse(sessionId).success) return { audio: null };
  const ctx = await loadOwnActiveSession(sessionId, user.id);
  if (!ctx) return { audio: null };

  // Each reply is claimed once in the DB, so replaying this action can't burn the TTS quota.
  // Nothing to speak (already spoken / no reply) is not logged: no request was made.
  const { data: text } = await ctx.supabase.rpc("claim_tts", { p_session_id: sessionId });
  if (typeof text !== "string" || !text) return { audio: null };

  let env: ReturnType<typeof ttsEnv>;
  try {
    env = ttsEnv();
  } catch {
    await logLlmCall({ task: "tts", provider: "gemini", model: "", latencyMs: 0, status: "unconfigured", sessionId });
    return { audio: null };
  }
  const started = Date.now();
  const log = (status: "ok" | "error" | "timeout") =>
    logLlmCall({ task: "tts", provider: "gemini", model: env.TTS_MODEL, latencyMs: Date.now() - started, status, sessionId });
  try {
    const res = await fetch(`${GEMINI}/v1beta/models/${env.TTS_MODEL}:generateContent`, {
      method: "POST",
      headers: { "x-goog-api-key": env.GEMINI_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text }] }],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: ctx.voice } } },
        },
      }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) {
      await log("error");
      return { audio: null };
    }
    const body = (await res.json()) as { candidates?: { content?: { parts?: { inlineData?: { data?: string } }[] } }[] };
    const data = body.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    const audio = data ? pcmOf(data) : null;
    await log(audio ? "ok" : "error");
    return { audio };
  } catch (err) {
    await log(isTimeoutError(err) ? "timeout" : "error");
    return { audio: null };
  }
}

/**
 * The TTS model may answer with a whole WAV file (fmt + data + a C2PA provenance chunk) instead of raw PCM.
 * Played as raw PCM, its header and the C2PA bytes crackle at the start and end of every line, so keep only
 * the `data` chunk. Non-WAV payloads pass through as raw PCM; a truncated WAV or one that isn't mono 24 kHz 16-bit ⇒ null.
 */
function pcmOf(b64: string): string | null {
  const buf = Buffer.from(b64, "base64");
  if (buf.toString("latin1", 0, 4) !== "RIFF" || buf.toString("latin1", 8, 12) !== "WAVE") return b64;
  let fmtOk = false;
  let o = 12;
  while (o + 8 <= buf.length) {
    const id = buf.toString("latin1", o, o + 4);
    const size = buf.readUInt32LE(o + 4);
    if (o + 8 + size > buf.length) return null; // truncated or malformed: text only, never partial audio
    if (id === "fmt " && size >= 16) {
      fmtOk =
        buf.readUInt16LE(o + 8) === 1 && // PCM
        buf.readUInt16LE(o + 10) === 1 && // mono
        buf.readUInt32LE(o + 12) === 24000 &&
        buf.readUInt16LE(o + 22) === 16;
    }
    if (id === "data") return fmtOk ? buf.subarray(o + 8, o + 8 + size).toString("base64") : null;
    o += 8 + size + (size & 1); // chunks are word-aligned
  }
  return null;
}

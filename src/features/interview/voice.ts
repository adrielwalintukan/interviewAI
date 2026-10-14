"use server";

import { z } from "zod";
import { requireUser } from "@/features/auth/dal";
import { ttsEnv } from "@/lib/env";
import { loadOwnActiveSession } from "./context";

const GEMINI = "https://generativelanguage.googleapis.com";

/**
 * Mode hemat: speaks the character's latest reply with the SAME prebuilt voice it has in Live,
 * so the character never changes voice (browser voices can't match language/gender reliably).
 * Takes no text from the browser: only the latest stored character reply of the caller's own active
 * session, at most once per reply (`claim_tts`).
 * Returns base64 PCM16 24 kHz, or null ⇒ the stage shows text only.
 */
export async function speakLastReply(sessionId: string): Promise<{ audio: string | null }> {
  const user = await requireUser({ roles: ["pelajar", "pengajar"] });
  if (!z.uuid().safeParse(sessionId).success) return { audio: null };
  const ctx = await loadOwnActiveSession(sessionId, user.id);
  if (!ctx) return { audio: null };

  // Each reply is claimed once in the DB, so replaying this action can't burn the TTS quota.
  const { data: text } = await ctx.supabase.rpc("claim_tts", { p_session_id: sessionId });
  if (typeof text !== "string" || !text) return { audio: null };

  try {
    const env = ttsEnv();
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
    if (!res.ok) return { audio: null };
    const body = (await res.json()) as { candidates?: { content?: { parts?: { inlineData?: { data?: string } }[] } }[] };
    return { audio: body.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data ?? null };
  } catch {
    return { audio: null };
  }
}

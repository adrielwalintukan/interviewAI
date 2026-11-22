import "server-only";

/**
 * Deepgram Flux TTS: the BACKUP voice for mode hemat, used only when Gemini TTS fails (quota/429/outage).
 * Serves raw PCM16 24 kHz mono (`container=none`) so the same browser PcmPlayer replays it unchanged.
 * Verified 2026-10-29: https://developers.deepgram.com/docs/flux-tts/voices (Indonesian voices are Early
 * Access: no text normalization yet, so numbers/dates must already be spelled out in the reply text).
 */
const SPEAK = "https://api.deepgram.com/v2/speak";

const MODEL_BY_VOICE: Record<string, string> = {
  Aoede: "flux-dewi-id", // Bu Ratna, female 40s
  Kore: "flux-dewi-id", // Bu Sri: only two Indonesian female voices exist
  Leda: "flux-fitri-id", // Kak Nadia, female 20s
  Charon: "flux-teguh-id", // Pak Hendra, male 50s, deep
  Orus: "flux-fajar-id", // Pak Yosef, male 50s, formal
  Puck: "flux-rizky-id", // Mas Dimas, male 30s, energetic
};

const MODEL_BY_GENDER = { female: "flux-dewi-id", male: "flux-fajar-id" } as const;

/** Same character voice, different provider: Gemini voice name ⇒ Deepgram model, gender as the fallback. */
export function deepgramModel(voice: string, gender: string): string {
  return MODEL_BY_VOICE[voice] ?? MODEL_BY_GENDER[gender === "male" ? "male" : "female"];
}

/** Returns base64 raw PCM16 24 kHz mono, or null ⇒ nothing playable (the stage then shows text only). */
export async function speakWithDeepgram(
  text: string,
  model: string,
  key: string,
): Promise<{ audio: string | null; status: "ok" | "error" | "timeout" }> {
  try {
    const res = await fetch(`${SPEAK}?model=${encodeURIComponent(model)}&encoding=linear16&sample_rate=24000&container=none`, {
      method: "POST",
      headers: { Authorization: `Token ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return { audio: null, status: "error" };
    const pcm = Buffer.from(await res.arrayBuffer());
    // `container=none` should be headerless; refuse anything else instead of playing a RIFF header as audio.
    if (pcm.length === 0 || pcm.toString("latin1", 0, 4) === "RIFF") return { audio: null, status: "error" };
    return { audio: pcm.toString("base64"), status: "ok" };
  } catch (err) {
    return { audio: null, status: err instanceof DOMException && err.name === "TimeoutError" ? "timeout" : "error" };
  }
}

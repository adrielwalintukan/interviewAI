import { beforeEach, describe, expect, it, vi } from "vitest";

const SESSION = "00000000-0000-4000-8000-000000000001";
const state = { session: true as boolean, lastReply: "Selamat pagi." as string | null, configured: true, deepgram: false };
const rpc = vi.fn();
const logCall = vi.fn(async () => {});

vi.mock("@/features/auth/dal", () => ({ requireUser: async () => ({ id: "learner-1", role: "pelajar" }) }));
vi.mock("@/lib/env", () => ({
  ttsEnv: () => {
    if (!state.configured) throw new Error("env");
    return { GEMINI_API_KEY: "k", TTS_MODEL: "tts-model" };
  },
  // No Deepgram key by default: Gemini is the only voice, as before this feature existed.
  deepgramEnv: () => (state.deepgram ? { DEEPGRAM_API_KEY: "dg" } : null),
}));
vi.mock("@/lib/llm/log", async (orig) => ({ ...(await orig<typeof import("@/lib/llm/log")>()), logLlmCall: logCall }));
vi.mock("./context", () => ({
  loadOwnActiveSession: async () => (state.session ? { supabase: { rpc }, voice: "Aoede", gender: "female" } : null),
}));

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);
const { speakLastReply } = await import("./voice");

const reply = (audio: Buffer) =>
  fetchMock.mockResolvedValue(
    new Response(JSON.stringify({ candidates: [{ content: { parts: [{ inlineData: { data: audio.toString("base64") } }] } }] })),
  );

/** Minimal WAV as Gemini TTS sends it: fmt + data, optionally followed by another chunk (C2PA). */
function wav({ pcm, rate = 24000, extra }: { pcm: Buffer; rate?: number; extra?: Buffer }): Buffer {
  const fmt = Buffer.alloc(24);
  fmt.write("fmt ", 0);
  fmt.writeUInt32LE(16, 4);
  fmt.writeUInt16LE(1, 8); // PCM
  fmt.writeUInt16LE(1, 10); // mono
  fmt.writeUInt32LE(rate, 12);
  fmt.writeUInt32LE(rate * 2, 16);
  fmt.writeUInt16LE(2, 20);
  fmt.writeUInt16LE(16, 22);
  const chunk = (id: string, body: Buffer) => {
    const head = Buffer.alloc(8);
    head.write(id, 0);
    head.writeUInt32LE(body.length, 4);
    return Buffer.concat([head, body, Buffer.alloc(body.length & 1)]);
  };
  const body = Buffer.concat([Buffer.from("WAVE"), fmt, chunk("data", pcm), ...(extra ? [chunk("C2PA", extra)] : [])]);
  const head = Buffer.alloc(8);
  head.write("RIFF", 0);
  head.writeUInt32LE(body.length, 4);
  return Buffer.concat([head, body]);
}

beforeEach(() => {
  state.session = true;
  state.lastReply = "Selamat pagi.";
  state.configured = true;
  state.deepgram = false;
  logCall.mockClear();
  rpc.mockReset().mockImplementation(async () => ({ data: state.lastReply }));
  fetchMock.mockReset().mockResolvedValue(new Response(JSON.stringify({ candidates: [{ content: { parts: [{ inlineData: { data: "UENN" } }] } }] })));
});

describe("speakLastReply", () => {
  it("speaks the stored character reply with the character's own voice", async () => {
    expect(await speakLastReply(SESSION)).toEqual({ audio: "UENN" });
    expect(rpc).toHaveBeenCalledWith("claim_tts", { p_session_id: SESSION });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/models/tts-model:generateContent");
    const body = JSON.parse(init.body as string);
    expect(body.contents[0].parts[0].text).toBe("Selamat pagi.");
    expect(body.generationConfig.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName).toBe("Aoede");
  });

  it("refuses a session that isn't the caller's active one, without calling the TTS", async () => {
    state.session = false;
    expect(await speakLastReply(SESSION)).toEqual({ audio: null });
    expect(await speakLastReply("not-a-uuid")).toEqual({ audio: null });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not call the TTS when the reply was already spoken (claim returns null)", async () => {
    state.lastReply = null;
    expect(await speakLastReply(SESSION)).toEqual({ audio: null });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(logCall).not.toHaveBeenCalled();
  });

  it("logs `unconfigured` without calling the TTS when its env is not set", async () => {
    state.configured = false;
    expect(await speakLastReply(SESSION)).toEqual({ audio: null });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(logCall).toHaveBeenCalledWith({ task: "tts", provider: "gemini", model: "", latencyMs: 0, status: "unconfigured", sessionId: SESSION });
  });

  it("plays a WAV answer as its data chunk only, dropping the header and the trailing C2PA chunk", async () => {
    const pcm = Buffer.from([1, 0, 2, 0, 3, 0]);
    reply(wav({ pcm, extra: Buffer.from("C2PA-provenance") }));
    expect(await speakLastReply(SESSION)).toEqual({ audio: pcm.toString("base64") });
  });

  it("passes raw PCM (no RIFF header) through unchanged", async () => {
    const pcm = Buffer.from([9, 0, 8, 0]).toString("base64");
    reply(Buffer.from(pcm, "base64"));
    expect(await speakLastReply(SESSION)).toEqual({ audio: pcm });
  });

  it("falls back to text only for a WAV that isn't mono 24 kHz 16-bit", async () => {
    reply(wav({ pcm: Buffer.from([1, 0]), rate: 44100 }));
    expect(await speakLastReply(SESSION)).toEqual({ audio: null });
    expect(logCall).toHaveBeenCalledWith(expect.objectContaining({ task: "tts", status: "error" }));
  });

  it("falls back to text only for a truncated WAV instead of playing partial audio", async () => {
    const full = wav({ pcm: Buffer.alloc(64, 1), extra: Buffer.from("C2PA-provenance") });
    reply(full.subarray(0, 44 + 32)); // cut inside the data chunk
    expect(await speakLastReply(SESSION)).toEqual({ audio: null });
    reply(full.subarray(0, 12 + 8 + 10)); // cut inside the fmt chunk
    expect(await speakLastReply(SESSION)).toEqual({ audio: null });
    expect(logCall).toHaveBeenCalledWith(expect.objectContaining({ task: "tts", status: "error" }));
  });

  it("falls back to text only when the TTS fails or the quota is exhausted", async () => {
    fetchMock.mockResolvedValue(new Response("{}", { status: 429 }));
    expect(await speakLastReply(SESSION)).toEqual({ audio: null });
    fetchMock.mockRejectedValue(new Error("timeout"));
    expect(await speakLastReply(SESSION)).toEqual({ audio: null });
  });

  describe("Deepgram backup (DEEPGRAM_API_KEY set)", () => {
    const pcm = Buffer.from([4, 0, 5, 0]);

    it("keeps Gemini as the voice while it works: no Deepgram request at all", async () => {
      state.deepgram = true;
      expect(await speakLastReply(SESSION)).toEqual({ audio: "UENN" });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(logCall).toHaveBeenCalledWith(expect.objectContaining({ provider: "gemini", status: "ok" }));
    });

    it("speaks the same reply with the character's Deepgram voice when Gemini is rate-limited", async () => {
      state.deepgram = true;
      fetchMock
        .mockResolvedValueOnce(new Response("{}", { status: 429 }))
        .mockResolvedValueOnce(new Response(pcm, { headers: { "Content-Type": "audio/l16;rate=24000" } }));

      expect(await speakLastReply(SESSION)).toEqual({ audio: pcm.toString("base64") });

      const [url, init] = fetchMock.mock.calls[1] as [string, RequestInit];
      expect(url).toContain("model=flux-dewi-id");
      expect(url).toContain("encoding=linear16");
      expect(url).toContain("sample_rate=24000");
      expect(url).toContain("container=none"); // raw PCM: no RIFF header to crackle in PcmPlayer
      expect((init.headers as Record<string, string>).Authorization).toBe("Token dg");
      expect(JSON.parse(init.body as string)).toEqual({ text: "Selamat pagi." });
      // The failed Gemini attempt is a `fallback` row, not `error`: another provider was tried.
      expect(logCall).toHaveBeenCalledWith(expect.objectContaining({ provider: "gemini", status: "fallback" }));
      expect(logCall).toHaveBeenCalledWith(expect.objectContaining({ provider: "deepgram", model: "flux-dewi-id", status: "ok" }));
    });

    it("also takes over when Gemini answers with audio that isn't playable", async () => {
      state.deepgram = true;
      fetchMock
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ candidates: [{ content: { parts: [{ inlineData: { data: wav({ pcm: Buffer.from([1, 0]), rate: 44100 }).toString("base64") } }] } }] })),
        ) // unusable WAV (44.1 kHz) ⇒ pcmOf returns null
        .mockResolvedValueOnce(new Response(pcm));
      expect(await speakLastReply(SESSION)).toEqual({ audio: pcm.toString("base64") });
    });

    it("shows text only when Deepgram fails too", async () => {
      state.deepgram = true;
      fetchMock.mockResolvedValue(new Response("{}", { status: 503 }));
      expect(await speakLastReply(SESSION)).toEqual({ audio: null });
      expect(logCall).toHaveBeenCalledWith(expect.objectContaining({ provider: "deepgram", status: "error" }));
    });

    it("never plays a RIFF header as audio if Deepgram ignores container=none", async () => {
      state.deepgram = true;
      fetchMock
        .mockResolvedValueOnce(new Response("{}", { status: 429 }))
        .mockResolvedValueOnce(new Response(new Uint8Array(wav({ pcm }))));
      expect(await speakLastReply(SESSION)).toEqual({ audio: null });
    });

    it("still logs Gemini as `error` when no backup is configured", async () => {
      fetchMock.mockResolvedValue(new Response("{}", { status: 429 }));
      expect(await speakLastReply(SESSION)).toEqual({ audio: null });
      expect(logCall).toHaveBeenCalledWith(expect.objectContaining({ provider: "gemini", status: "error" }));
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });
});

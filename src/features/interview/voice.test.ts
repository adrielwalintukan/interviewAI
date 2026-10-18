import { beforeEach, describe, expect, it, vi } from "vitest";

const SESSION = "00000000-0000-4000-8000-000000000001";
const state = { session: true as boolean, lastReply: "Selamat pagi." as string | null, configured: true };
const rpc = vi.fn();
const logCall = vi.fn(async () => {});

vi.mock("@/features/auth/dal", () => ({ requireUser: async () => ({ id: "learner-1", role: "pelajar" }) }));
vi.mock("@/lib/env", () => ({
  ttsEnv: () => {
    if (!state.configured) throw new Error("env");
    return { GEMINI_API_KEY: "k", TTS_MODEL: "tts-model" };
  },
}));
vi.mock("@/lib/llm/log", async (orig) => ({ ...(await orig<typeof import("@/lib/llm/log")>()), logLlmCall: logCall }));
vi.mock("./context", () => ({
  loadOwnActiveSession: async () => (state.session ? { supabase: { rpc }, voice: "Aoede" } : null),
}));

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);
const { speakLastReply } = await import("./voice");

beforeEach(() => {
  state.session = true;
  state.lastReply = "Selamat pagi.";
  state.configured = true;
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

  it("falls back to text only when the TTS fails or the quota is exhausted", async () => {
    fetchMock.mockResolvedValue(new Response("{}", { status: 429 }));
    expect(await speakLastReply(SESSION)).toEqual({ audio: null });
    fetchMock.mockRejectedValue(new Error("timeout"));
    expect(await speakLastReply(SESSION)).toEqual({ audio: null });
  });
});

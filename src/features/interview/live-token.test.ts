import { beforeEach, describe, expect, it, vi } from "vitest";

const SESSION = "00000000-0000-4000-8000-000000000001";
const state = { configured: true, slotFree: true, claimFails: false, history: [] as { speaker: string; text: string }[] };
const rpc = vi.fn();
const logCall = vi.fn(async () => {});

vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("next/server", () => ({ after: vi.fn() }));
vi.mock("@/features/auth/dal", () => ({ requireUser: async () => ({ id: "learner-1", role: "pelajar" }) }));
vi.mock("@/features/grading/grade", () => ({ gradeSession: vi.fn() }));
const complete = vi.fn();
vi.mock("@/lib/llm/gateway", () => ({ complete }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/llm/prompts/persona", () => ({
  openCue: () => "(cue)",
  PERSONA_PROMPT_VERSION: "persona@test",
  buildPersonaPrompt: (_: unknown, level: string, minutes: number) => `persona:${level}:${minutes}`,
}));
vi.mock("@/lib/env", () => ({
  liveMaxConcurrent: () => 5,
  liveEnv: () => {
    if (!state.configured) throw new Error("env");
    return { GEMINI_API_KEY: "k", LIVE_MODEL: "live-model" };
  },
}));
vi.mock("@/lib/llm/log", async (orig) => ({ ...(await orig<typeof import("@/lib/llm/log")>()), logLlmCall: logCall }));
vi.mock("./context", () => ({
  loadOwnActiveSession: async () => ({
    supabase: { rpc, from: () => ({ select: () => ({ eq: () => ({ order: async () => ({ data: state.history }) }) }) }) },
    voice: "Aoede",
    content: {},
    clientLevel: "sulit",
    minutes: 5,
    session: { ends_at: new Date(Date.now() + 15 * 60_000).toISOString() },
  }),
}));

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);
const { chatTurn, requestLiveToken } = await import("./actions");

beforeEach(() => {
  state.configured = true;
  state.slotFree = true;
  state.claimFails = false;
  state.history = [];
  logCall.mockClear();
  complete.mockReset().mockResolvedValue({ text: "Halo, silakan duduk." });
  rpc.mockReset().mockImplementation(async (fn: string) =>
    fn === "claim_live_slot" && state.claimFails ? { data: null, error: { message: "db down" } } : { data: fn === "claim_live_slot" ? state.slotFree : null, error: null },
  );
  fetchMock.mockReset().mockResolvedValue(new Response(JSON.stringify({ name: "auth_tokens/t" })));
});

describe("requestLiveToken setup", () => {
  it("locks the persona for the assignment's client level and the real session length into the token", async () => {
    await requestLiveToken(SESSION);
    const body = JSON.parse(fetchMock.mock.calls[0]![1].body as string);
    expect(body.bidiGenerateContentSetup.systemInstruction.parts[0].text).toBe("persona:sulit:5");
  });
});

describe("chatTurn opening (mode hemat)", () => {
  it("lets the model greet from the open cue and saves only its reply", async () => {
    expect(await chatTurn(SESSION, null)).toEqual({ ok: true, reply: "Halo, silakan duduk." });
    expect(complete).toHaveBeenCalledWith(expect.objectContaining({
      messages: [{ role: "system", content: "persona:sulit:5" }, { role: "user", content: "(cue)" }],
    }));
    const saved = rpc.mock.calls.filter(([fn]) => fn === "append_message").map(([, args]) => args);
    expect(saved).toEqual([{ p_session_id: SESSION, p_speaker: "character", p_text: "Halo, silakan duduk." }]);
  });

  it("does not greet again once the conversation has started", async () => {
    state.history = [{ speaker: "character", text: "Halo." }];
    expect(await chatTurn(SESSION, null)).toEqual({ ok: true, reply: "" });
    expect(complete).not.toHaveBeenCalled();
  });
});

describe("requestLiveToken logging", () => {
  it("logs `ok` for a minted token", async () => {
    expect(await requestLiveToken(SESSION)).toEqual({ mode: "live", token: "auth_tokens/t", model: "models/live-model" });
    expect(logCall).toHaveBeenCalledWith(expect.objectContaining({ task: "live", model: "live-model", status: "ok", sessionId: SESSION }));
  });

  it("logs `unconfigured` without claiming a slot or calling Gemini when the env is not set", async () => {
    state.configured = false;
    expect(await requestLiveToken(SESSION)).toEqual({ mode: "fallback", reason: "unavailable" });
    expect(rpc).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(logCall).toHaveBeenCalledExactlyOnceWith({ task: "live", provider: "gemini", model: "", latencyMs: 0, status: "unconfigured", sessionId: SESSION });
  });

  it("logs `busy` without calling Gemini when no Live slot is free", async () => {
    state.slotFree = false;
    expect(await requestLiveToken(SESSION)).toEqual({ mode: "fallback", reason: "busy" });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(logCall).toHaveBeenCalledExactlyOnceWith({ task: "live", provider: "gemini", model: "live-model", latencyMs: 0, status: "busy", sessionId: SESSION });
  });

  it("logs a failed slot claim as `error`, not `busy`, and falls back without calling Gemini", async () => {
    state.claimFails = true;
    expect(await requestLiveToken(SESSION)).toEqual({ mode: "fallback", reason: "unavailable" });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(logCall).toHaveBeenCalledExactlyOnceWith({ task: "live", provider: "gemini", model: "live-model", latencyMs: 0, status: "error", sessionId: SESSION });
  });

  it("logs `error` and releases the slot when Gemini refuses", async () => {
    fetchMock.mockResolvedValue(new Response("{}", { status: 403 }));
    expect(await requestLiveToken(SESSION)).toEqual({ mode: "fallback", reason: "unavailable" });
    expect(logCall).toHaveBeenCalledWith(expect.objectContaining({ status: "error" }));
    expect(rpc).toHaveBeenCalledWith("release_live_slot", { p_session_id: SESSION });
  });
});

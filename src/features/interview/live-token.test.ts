import { beforeEach, describe, expect, it, vi } from "vitest";

const SESSION = "00000000-0000-4000-8000-000000000001";
const state = { configured: true, slotFree: true, claimFails: false };
const rpc = vi.fn();
const logCall = vi.fn(async () => {});

vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("next/server", () => ({ after: vi.fn() }));
vi.mock("@/features/auth/dal", () => ({ requireUser: async () => ({ id: "learner-1", role: "pelajar" }) }));
vi.mock("@/features/grading/grade", () => ({ gradeSession: vi.fn() }));
vi.mock("@/lib/llm/gateway", () => ({ complete: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/llm/prompts/persona", () => ({ PERSONA_PROMPT_VERSION: "persona@test", buildPersonaPrompt: () => "persona" }));
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
    supabase: { rpc },
    voice: "Aoede",
    content: {},
    session: { ends_at: new Date(Date.now() + 15 * 60_000).toISOString() },
  }),
}));

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);
const { requestLiveToken } = await import("./actions");

beforeEach(() => {
  state.configured = true;
  state.slotFree = true;
  state.claimFails = false;
  logCall.mockClear();
  rpc.mockReset().mockImplementation(async (fn: string) =>
    fn === "claim_live_slot" && state.claimFails ? { data: null, error: { message: "db down" } } : { data: fn === "claim_live_slot" ? state.slotFree : null, error: null },
  );
  fetchMock.mockReset().mockResolvedValue(new Response(JSON.stringify({ name: "auth_tokens/t" })));
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

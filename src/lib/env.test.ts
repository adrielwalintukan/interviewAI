import { afterEach, describe, expect, it, vi } from "vitest";

const SUPABASE = {
  NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
  SUPABASE_SERVICE_ROLE_KEY: "service",
};

async function freshEnv(vars: Record<string, string>) {
  vi.resetModules();
  vi.unstubAllEnvs();
  for (const k of ["GEMINI_API_KEY", "NINEROUTER_BASE_URL", "NINEROUTER_API_KEY", "CHAT_MODEL", "GRADER_MODEL", "LIVE_MODEL", "TTS_MODEL", "GEMINI_FALLBACK_MODEL", ...Object.keys(SUPABASE)]) {
    vi.stubEnv(k, "");
  }
  for (const [k, v] of Object.entries(vars)) vi.stubEnv(k, v);
  return import("./env");
}

afterEach(() => vi.unstubAllEnvs());

describe("env", () => {
  it("supabase env works without any LLM vars (admin actions must not depend on LIVE_MODEL)", async () => {
    const env = await freshEnv(SUPABASE);
    expect(env.supabaseEnv().SUPABASE_SERVICE_ROLE_KEY).toBe("service");
    expect(() => env.llmEnv()).toThrow(/GEMINI_API_KEY/);
    expect(() => env.liveEnv()).toThrow(/LIVE_MODEL/);
    expect(() => env.ttsEnv()).toThrow(/TTS_MODEL/);
  });

  it("names missing vars without echoing values", async () => {
    const env = await freshEnv({ ...SUPABASE, NEXT_PUBLIC_SUPABASE_URL: "not-a-url" });
    expect(() => env.supabaseEnv()).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
    expect(() => env.supabaseEnv()).not.toThrow(/service/);
  });
});

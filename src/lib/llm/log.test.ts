import { beforeEach, describe, expect, it, vi } from "vitest";

const insert = vi.fn();
const admin = { broken: false };
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => {
    if (admin.broken) throw new Error("no service key");
    return { from: () => ({ insert: (row: unknown) => ({ abortSignal: () => insert(row) }) }) };
  },
}));

import OpenAI from "openai";

const { isTimeoutError, logLlmCall } = await import("./log");
const call = { task: "chat" as const, provider: "gemini" as const, model: "g", latencyMs: 12.6, status: "ok" as const };

beforeEach(() => {
  admin.broken = false;
  insert.mockReset().mockResolvedValue({ error: null });
});

describe("logLlmCall", () => {
  it("writes the metadata row in table shape", async () => {
    await logLlmCall({ ...call, tokensIn: 3, sessionId: "s-1" });
    expect(insert).toHaveBeenCalledWith({ task: "chat", provider: "gemini", model: "g", latency_ms: 13, status: "ok", tokens_in: 3, tokens_out: null, session_id: "s-1" });
  });

  it("never throws when the insert fails, rejects, or the client can't be created", async () => {
    insert.mockResolvedValue({ error: { message: "rls" } });
    await expect(logLlmCall(call)).resolves.toBeUndefined();
    insert.mockRejectedValue(new Error("network"));
    await expect(logLlmCall(call)).resolves.toBeUndefined();
    admin.broken = true;
    await expect(logLlmCall(call)).resolves.toBeUndefined();
  });
});

describe("isTimeoutError", () => {
  it("is true for the SDK timeout and for fetch aborted by AbortSignal.timeout()", async () => {
    expect(isTimeoutError(new OpenAI.APIConnectionTimeoutError())).toBe(true);
    // The real error fetch throws for an AbortSignal.timeout() that has fired (not a hand-built lookalike).
    const signal = AbortSignal.timeout(0);
    await new Promise((r) => setTimeout(r, 10));
    const timedOut = await fetch("data:text/plain,x", { signal }).catch((e: unknown) => e);
    expect(isTimeoutError(timedOut)).toBe(true);
  });

  it("is false for other connection failures and errors", () => {
    expect(isTimeoutError(new OpenAI.APIConnectionError({ message: "refused" }))).toBe(false);
    expect(isTimeoutError(new TypeError("fetch failed"))).toBe(false);
    expect(isTimeoutError(new DOMException("aborted", "AbortError"))).toBe(false);
    expect(isTimeoutError(new Error("token 500"))).toBe(false);
  });
});

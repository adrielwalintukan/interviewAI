import OpenAI from "openai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createGateway, type Provider } from "./gateway";

const ok = (content: string) => ({
  choices: [{ message: { content } }],
  usage: { prompt_tokens: 10, completion_tokens: 5 },
});

function provider(name: Provider["name"], create: ReturnType<typeof vi.fn>): Provider {
  return {
    name,
    client: { chat: { completions: { create } } } as unknown as Provider["client"],
    models: { chat: `${name}-chat`, grader: `${name}-grader`, generator: `${name}-generator` },
  };
}

const apiError = (status: number) => OpenAI.APIError.generate(status, {}, `status ${status}`, new Headers());
const input = { task: "chat" as const, messages: [{ role: "user" as const, content: "halo" }] };
const log = vi.fn();
beforeEach(() => log.mockReset().mockResolvedValue(undefined));

describe("llm gateway", () => {
  it("uses 9router when it succeeds", async () => {
    const primary = vi.fn().mockResolvedValue(ok("dari 9router"));
    const backup = vi.fn();
    const res = await createGateway([provider("9router", primary), provider("gemini", backup)], log)(input);

    expect(res).toMatchObject({ text: "dari 9router", provider: "9router", model: "9router-chat", tokensIn: 10 });
    expect(backup).not.toHaveBeenCalled();
  });

  it.each([429, 500, 503])("falls back to gemini on %i", async (status) => {
    const primary = vi.fn().mockRejectedValue(apiError(status));
    const backup = vi.fn().mockResolvedValue(ok("dari gemini"));
    const res = await createGateway([provider("9router", primary), provider("gemini", backup)], log)(input);

    expect(res.provider).toBe("gemini");
    expect(res.model).toBe("gemini-chat");
    expect(res.attempts).toHaveLength(2);
    expect(res.attempts[0]?.error).toBeDefined();
  });

  it("falls back on network/timeout errors", async () => {
    const primary = vi.fn().mockRejectedValue(new OpenAI.APIConnectionTimeoutError());
    const backup = vi.fn().mockResolvedValue(ok("ok"));
    const res = await createGateway([provider("9router", primary), provider("gemini", backup)], log)(input);
    expect(res.provider).toBe("gemini");
  });

  it("does not fall back on a bad request (400)", async () => {
    const primary = vi.fn().mockRejectedValue(apiError(400));
    const backup = vi.fn();
    await expect(createGateway([provider("9router", primary), provider("gemini", backup)], log)(input)).rejects.toThrow();
    expect(backup).not.toHaveBeenCalled();
  });

  it("throws the last error when every provider fails", async () => {
    const primary = vi.fn().mockRejectedValue(apiError(429));
    const backup = vi.fn().mockRejectedValue(apiError(503));
    await expect(createGateway([provider("9router", primary), provider("gemini", backup)], log)(input)).rejects.toMatchObject({
      status: 503,
    });
  });

  it("passes json mode, task timeout and grader temperature", async () => {
    const primary = vi.fn().mockResolvedValue(ok("{}"));
    await createGateway([provider("9router", primary)], log)({ ...input, task: "grader", json: true });

    const [body, opts] = primary.mock.calls[0]!;
    expect(body).toMatchObject({
      model: "9router-grader",
      stream: false,
      temperature: 0.2,
      response_format: { type: "json_object" },
    });
    expect(opts).toEqual({ timeout: 60_000, maxRetries: 0 });
  });

  it("logs one metadata row per provider attempt, without any prompt text", async () => {
    const primary = vi.fn().mockRejectedValue(apiError(429));
    const backup = vi.fn().mockResolvedValue(ok("dari gemini"));
    await createGateway([provider("9router", primary), provider("gemini", backup)], log)({ ...input, sessionId: "s-1" });

    expect(log.mock.calls.map(([c]) => c)).toEqual([
      { task: "chat", provider: "9router", model: "9router-chat", latencyMs: expect.any(Number), status: "fallback", sessionId: "s-1" },
      { task: "chat", provider: "gemini", model: "gemini-chat", latencyMs: expect.any(Number), status: "ok", tokensIn: 10, tokensOut: 5, sessionId: "s-1" },
    ]);
    expect(JSON.stringify(log.mock.calls)).not.toContain("halo");
  });

  it("logs timeout, and error for the last failed attempt or one that cannot fall back", async () => {
    const statuses = async (...errs: unknown[]) => {
      log.mockClear();
      const ps = errs.map((e, i) => provider(i === 0 ? "9router" : "gemini", vi.fn().mockRejectedValue(e)));
      await createGateway(ps, log)(input).catch(() => {});
      return log.mock.calls.map(([c]) => c.status);
    };
    expect(await statuses(new OpenAI.APIConnectionTimeoutError(), apiError(503))).toEqual(["timeout", "error"]);
    expect(await statuses(apiError(400), apiError(503))).toEqual(["error"]);
  });

  it("uses the generator model for generator calls", async () => {
    const primary = vi.fn().mockResolvedValue(ok("{}"));
    await createGateway([provider("9router", primary)], log)({ ...input, task: "generator", json: true });
    expect(primary.mock.calls[0]![0]).toMatchObject({ model: "9router-generator" });
    expect(log.mock.calls[0]![0]).toMatchObject({ task: "generator", status: "ok" });
  });

  it("still answers when writing the log fails", async () => {
    const failingLog = vi.fn(async () => {
      throw new Error("db down");
    });
    const primary = vi.fn().mockRejectedValue(apiError(503));
    const backup = vi.fn().mockResolvedValue(ok("tetap jawab"));
    const res = await createGateway([provider("9router", primary), provider("gemini", backup)], failingLog)(input);
    expect(res.text).toBe("tetap jawab");
    expect(failingLog).toHaveBeenCalledTimes(2);
  });
});

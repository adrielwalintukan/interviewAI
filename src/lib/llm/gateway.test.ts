import OpenAI from "openai";
import { describe, expect, it, vi } from "vitest";
import { createGateway, type Provider } from "./gateway";

const ok = (content: string) => ({
  choices: [{ message: { content } }],
  usage: { prompt_tokens: 10, completion_tokens: 5 },
});

function provider(name: Provider["name"], create: ReturnType<typeof vi.fn>): Provider {
  return {
    name,
    client: { chat: { completions: { create } } } as unknown as Provider["client"],
    models: { chat: `${name}-chat`, grader: `${name}-grader` },
  };
}

const apiError = (status: number) => OpenAI.APIError.generate(status, {}, `status ${status}`, new Headers());
const input = { task: "chat" as const, messages: [{ role: "user" as const, content: "halo" }] };

describe("llm gateway", () => {
  it("uses 9router when it succeeds", async () => {
    const primary = vi.fn().mockResolvedValue(ok("dari 9router"));
    const backup = vi.fn();
    const res = await createGateway([provider("9router", primary), provider("gemini", backup)])(input);

    expect(res).toMatchObject({ text: "dari 9router", provider: "9router", model: "9router-chat", tokensIn: 10 });
    expect(backup).not.toHaveBeenCalled();
  });

  it.each([429, 500, 503])("falls back to gemini on %i", async (status) => {
    const primary = vi.fn().mockRejectedValue(apiError(status));
    const backup = vi.fn().mockResolvedValue(ok("dari gemini"));
    const res = await createGateway([provider("9router", primary), provider("gemini", backup)])(input);

    expect(res.provider).toBe("gemini");
    expect(res.model).toBe("gemini-chat");
    expect(res.attempts).toHaveLength(2);
    expect(res.attempts[0]?.error).toBeDefined();
  });

  it("falls back on network/timeout errors", async () => {
    const primary = vi.fn().mockRejectedValue(new OpenAI.APIConnectionTimeoutError());
    const backup = vi.fn().mockResolvedValue(ok("ok"));
    const res = await createGateway([provider("9router", primary), provider("gemini", backup)])(input);
    expect(res.provider).toBe("gemini");
  });

  it("does not fall back on a bad request (400)", async () => {
    const primary = vi.fn().mockRejectedValue(apiError(400));
    const backup = vi.fn();
    await expect(createGateway([provider("9router", primary), provider("gemini", backup)])(input)).rejects.toThrow();
    expect(backup).not.toHaveBeenCalled();
  });

  it("throws the last error when every provider fails", async () => {
    const primary = vi.fn().mockRejectedValue(apiError(429));
    const backup = vi.fn().mockRejectedValue(apiError(503));
    await expect(createGateway([provider("9router", primary), provider("gemini", backup)])(input)).rejects.toMatchObject({
      status: 503,
    });
  });

  it("passes json mode, task timeout and grader temperature", async () => {
    const primary = vi.fn().mockResolvedValue(ok("{}"));
    await createGateway([provider("9router", primary)])({ ...input, task: "grader", json: true });

    const [body, opts] = primary.mock.calls[0]!;
    expect(body).toMatchObject({ model: "9router-grader", temperature: 0.2, response_format: { type: "json_object" } });
    expect(opts).toEqual({ timeout: 60_000, maxRetries: 0 });
  });
});

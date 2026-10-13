import "server-only";
import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { serverEnv } from "@/lib/env";

export type LlmTask = "chat" | "grader";

export type Provider = {
  name: "9router" | "gemini";
  client: Pick<OpenAI, "chat">;
  models: Record<LlmTask, string>;
};

export type CompleteInput = {
  task: LlmTask;
  messages: ChatCompletionMessageParam[];
  json?: boolean;
  temperature?: number;
};

export type CompleteResult = {
  text: string;
  provider: Provider["name"];
  model: string;
  latencyMs: number;
  tokensIn?: number;
  tokensOut?: number;
  attempts: { provider: Provider["name"]; error?: string }[];
};

const TIMEOUT_MS: Record<LlmTask, number> = { chat: 15_000, grader: 60_000 };

// ADR-003: fall back only on errors another provider could fix (rate limit, outage, network/timeout).
export function isFallbackError(err: unknown): boolean {
  if (err instanceof OpenAI.APIConnectionError) return true; // includes timeout
  if (err instanceof OpenAI.APIError) {
    const s = err.status;
    return s === undefined || s === 429 || s >= 500;
  }
  return false;
}

export function createGateway(providers: Provider[]) {
  return async function complete(input: CompleteInput): Promise<CompleteResult> {
    const attempts: CompleteResult["attempts"] = [];
    let lastError: unknown;

    for (const p of providers) {
      const model = p.models[input.task];
      const started = Date.now();
      try {
        const res = await p.client.chat.completions.create(
          {
            model,
            messages: input.messages,
            temperature: input.temperature ?? (input.task === "grader" ? 0.2 : 0.7),
            ...(input.json ? { response_format: { type: "json_object" as const } } : {}),
          },
          { timeout: TIMEOUT_MS[input.task], maxRetries: 0 },
        );
        attempts.push({ provider: p.name });
        return {
          text: res.choices[0]?.message?.content ?? "",
          provider: p.name,
          model,
          latencyMs: Date.now() - started,
          tokensIn: res.usage?.prompt_tokens,
          tokensOut: res.usage?.completion_tokens,
          attempts,
        };
      } catch (err) {
        attempts.push({ provider: p.name, error: err instanceof Error ? err.message : String(err) });
        lastError = err;
        if (!isFallbackError(err)) break;
      }
    }
    throw lastError;
  };
}

const GEMINI_OPENAI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai/";

let defaultComplete: ReturnType<typeof createGateway> | undefined;

/** Text LLM per ADR-003: 9router first, Gemini (OpenAI-compatible endpoint) as fallback. */
export function complete(input: CompleteInput): Promise<CompleteResult> {
  if (!defaultComplete) {
    const env = serverEnv();
    defaultComplete = createGateway([
      {
        name: "9router",
        client: new OpenAI({ baseURL: env.NINEROUTER_BASE_URL, apiKey: env.NINEROUTER_API_KEY }),
        models: { chat: env.CHAT_MODEL, grader: env.GRADER_MODEL },
      },
      {
        name: "gemini",
        client: new OpenAI({ baseURL: GEMINI_OPENAI_BASE_URL, apiKey: env.GEMINI_API_KEY }),
        models: { chat: env.GEMINI_FALLBACK_MODEL, grader: env.GEMINI_FALLBACK_MODEL },
      },
    ]);
  }
  return defaultComplete(input);
}

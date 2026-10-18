import "server-only";
import OpenAI from "openai";
import { createAdminClient } from "@/lib/supabase/admin";

/** One row per provider attempt in `llm_calls` (architecture §4). Metadata only: never prompt or transcript text. */
export type LlmCall = {
  task: "chat" | "grader" | "generator" | "live" | "tts";
  provider: "9router" | "gemini";
  model: string;
  latencyMs: number;
  status: "ok" | "error" | "timeout" | "fallback";
  tokensIn?: number;
  tokensOut?: number;
  sessionId?: string;
};

export type LogCall = (call: LlmCall) => Promise<void>;

/**
 * The one definition of status `timeout`: the OpenAI SDK's own timeout, or fetch aborted by
 * AbortSignal.timeout() (DOMException "TimeoutError", while waiting for headers or the body).
 * Other connection failures (refused, DNS) are not timeouts: `fallback` or `error`.
 */
export function isTimeoutError(err: unknown): boolean {
  return err instanceof OpenAI.APIConnectionTimeoutError || (err instanceof DOMException && err.name === "TimeoutError");
}

/** Never throws and gives up after 2 s: a failed log must not break or stall the call it describes. */
export const logLlmCall: LogCall = async (c) => {
  try {
    await createAdminClient()
      .from("llm_calls")
      .insert({
        task: c.task,
        provider: c.provider,
        model: c.model,
        latency_ms: Math.max(0, Math.round(c.latencyMs)),
        status: c.status,
        tokens_in: c.tokensIn ?? null,
        tokens_out: c.tokensOut ?? null,
        session_id: c.sessionId ?? null,
      })
      .abortSignal(AbortSignal.timeout(2_000));
  } catch {
    // monitoring only
  }
};

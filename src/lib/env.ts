import "server-only";
import { z } from "zod";

// One schema per subsystem, so a missing LLM key can't break sign-in or admin actions (and vice versa).
const supabaseSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
});

const llmSchema = z.object({
  GEMINI_API_KEY: z.string().min(1),
  NINEROUTER_BASE_URL: z.url(),
  NINEROUTER_API_KEY: z.string().min(1),
  CHAT_MODEL: z.string().min(1),
  GRADER_MODEL: z.string().min(1),
  GEMINI_FALLBACK_MODEL: z.string().min(1),
});

const liveSchema = z.object({
  GEMINI_API_KEY: z.string().min(1),
  LIVE_MODEL: z.string().min(1),
});

const ttsSchema = z.object({
  GEMINI_API_KEY: z.string().min(1),
  TTS_MODEL: z.string().min(1),
});

// Parsed lazily so `next build` in CI works without secrets; fails loudly (names only) on first real use.
function lazy<T extends z.ZodType>(schema: T) {
  let cached: z.infer<T> | undefined;
  return (): z.infer<T> => {
    if (cached) return cached;
    const parsed = schema.safeParse(process.env);
    if (!parsed.success) {
      const missing = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
      throw new Error(`Env server tidak valid/kurang: ${missing}. Lihat .env.example`);
    }
    cached = parsed.data;
    return cached;
  };
}

export const supabaseEnv = lazy(supabaseSchema);
export const llmEnv = lazy(llmSchema);
/** Gemini Live (M3). */
export const liveEnv = lazy(liveSchema);
/** Gemini TTS: the character's voice in mode hemat. */
export const ttsEnv = lazy(ttsSchema);

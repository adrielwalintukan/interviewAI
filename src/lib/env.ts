import "server-only";
import { z } from "zod";

const serverSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  GEMINI_API_KEY: z.string().min(1),
  NINEROUTER_BASE_URL: z.url(),
  NINEROUTER_API_KEY: z.string().min(1),
  CHAT_MODEL: z.string().min(1),
  GRADER_MODEL: z.string().min(1),
  LIVE_MODEL: z.string().min(1),
  GEMINI_FALLBACK_MODEL: z.string().min(1),
});

export type ServerEnv = z.infer<typeof serverSchema>;

let cached: ServerEnv | undefined;

// Parsed lazily so `next build` in CI works without secrets; fails loudly on first real use.
export function serverEnv(): ServerEnv {
  if (cached) return cached;
  const parsed = serverSchema.safeParse(process.env);
  if (!parsed.success) {
    const missing = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`Env server tidak valid/kurang: ${missing}. Lihat .env.example`);
  }
  cached = parsed.data;
  return cached;
}

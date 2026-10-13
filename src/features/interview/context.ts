import "server-only";
import { contentSchema } from "@/features/scenario/schema";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type SessionRow = {
  id: string;
  user_id: string;
  kind: "assignment" | "library" | "preview";
  mode: "live" | "fallback";
  status: string;
  ends_at: string;
  scenario_version_id: string;
};

/**
 * The caller's own active session plus the secret scenario content the AI needs.
 * Ownership is checked as the caller (RLS + user_id); only then are secrets read with the service role.
 */
export async function loadOwnActiveSession(sessionId: string, userId: string) {
  const supabase = await createClient();
  const { data: session } = await supabase
    .from("sessions")
    .select("id, user_id, kind, mode, status, ends_at, scenario_version_id")
    .eq("id", sessionId)
    .eq("user_id", userId)
    .maybeSingle<SessionRow>();
  if (!session || session.status !== "active" || Date.parse(session.ends_at) + 60_000 < Date.now()) return null;

  const db = createAdminClient();
  const [{ data: version }, { data: secrets }] = await Promise.all([
    db
      .from("scenario_versions")
      .select("title, language, level, learner_role, objective, character_id, characters(live_voice, gender)")
      .eq("id", session.scenario_version_id)
      .single<{
        title: string;
        language: "id" | "en";
        level: "smk" | "s1" | "umum";
        learner_role: string;
        objective: string;
        character_id: string;
        characters: { live_voice: string; gender: string } | null;
      }>(),
    db.from("scenario_version_secrets").select("persona, facts, rubric").eq("version_id", session.scenario_version_id).single(),
  ]);
  if (!version || !secrets) return null;

  const content = contentSchema.parse({
    title: version.title,
    language: version.language,
    level: version.level,
    learnerRole: version.learner_role,
    objective: version.objective,
    characterId: version.character_id,
    persona: secrets.persona,
    facts: secrets.facts,
    rubric: secrets.rubric,
  });
  return { supabase, session, content, voice: version.characters?.live_voice ?? "Kore" };
}

import "server-only";
import type { CurrentUser } from "@/features/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { learnerStatus } from "./class-dashboard";
import type { GradeResult } from "./result";

type AssignmentRow = {
  id: string;
  due_at: string | null;
  max_attempts: number;
  scenario_version_id: string;
  classes: { name: string; owner_id: string } | null;
  v: { title: string; scenarios: { author_id: string } | null } | null;
};
export type SessionRow = {
  id: string;
  user_id: string;
  status: string;
  started_at: string;
  profiles: { display_name: string } | null;
  evaluations: { final_score: number; reviewer_id: string | null; ai_result: Pick<GradeResult, "facts"> } | null;
};
type Member = { user_id: string; profiles: { display_name: string; username: string | null } | null };

// Canonical 8-4-4-4-12 shape (any version, as Postgres accepts): anything else must 404 before reaching the query.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * One assignment's results for its class owner or an admin (US-G-08, US-G-09); null when the caller may
 * not see it. RLS is the second layer. `failed` means a query failed: callers must not show it as empty.
 */
export async function loadAssignmentResults(user: CurrentUser, classId: string, assignmentId: string) {
  if (!(user.role === "pengajar" || user.role === "admin") || !UUID.test(classId) || !UUID.test(assignmentId)) return null;

  const supabase = await createClient();
  // scenarios(author_id) is readable by its author and admins only, so it is null for other teachers.
  const { data: a, error: aError } = await supabase
    .from("assignments")
    .select("id, due_at, max_attempts, scenario_version_id, classes(name, owner_id), v:scenario_versions(title, scenarios!scenario_id(author_id))")
    .eq("id", assignmentId)
    .eq("class_id", classId)
    .maybeSingle<AssignmentRow>();
  if (aError) throw aError; // a failed query must not read as 404
  if (!a || !(user.role === "admin" || a.classes?.owner_id === user.id)) return null;

  const [{ data: members, error: membersError }, { data: sessions, error: sessionsError }, { data: scores, error: scoresError }] = await Promise.all([
    supabase
      .from("class_members")
      .select("user_id, profiles!inner(display_name, username, role)")
      .eq("class_id", classId)
      .eq("profiles.role", "pelajar")
      .order("joined_at", { ascending: true })
      .returns<Member[]>(),
    // ai_result holds fact ids/flags only; it is aggregated and never rendered as is.
    supabase
      .from("sessions")
      .select("id, user_id, status, started_at, profiles(display_name), evaluations(final_score, reviewer_id, ai_result)")
      .eq("assignment_id", assignmentId)
      .order("started_at", { ascending: false })
      .returns<SessionRow[]>(),
    // The only source of assignment scores (docs/architecture.md): never recompute best scores here.
    supabase.from("assignment_scores").select("user_id, attempts, best_score").eq("assignment_id", assignmentId),
  ]);

  const byUser = new Map<string, SessionRow[]>();
  for (const s of sessions ?? []) byUser.set(s.user_id, [...(byUser.get(s.user_id) ?? []), s]);
  const scoreOf = new Map((scores ?? []).map((s) => [s.user_id, s]));

  const learners = (members ?? []).map((m) => {
    const own = byUser.get(m.user_id) ?? [];
    const best = scoreOf.get(m.user_id)?.best_score ?? null;
    // Review link: the attempt that counts (best final score), else the latest attempt.
    const link = own.find((s) => s.evaluations && s.evaluations.final_score === best) ?? own[0];
    return {
      id: m.user_id,
      name: m.profiles?.display_name ?? "—",
      username: m.profiles?.username ?? null,
      status: learnerStatus(own.map((s) => s.status)),
      attempts: scoreOf.get(m.user_id)?.attempts ?? 0,
      best,
      linkId: link?.id ?? null,
      graded: own.flatMap((s) => (s.status === "graded" && s.evaluations ? [s.evaluations.ai_result] : [])),
    };
  });

  return { assignment: a, learners, sessions: sessions ?? [], failed: Boolean(membersError || sessionsError || scoresError) };
}

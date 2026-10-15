"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import { requireUser, type CurrentUser } from "@/features/auth/dal";
import { loadScenarioContent } from "@/features/interview/context";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { claimGrading, gradeClaimed } from "./grade";
import { applyOverride, computeScore, type GradeResult, type Override } from "./result";

type SessionAccess = {
  id: string;
  user_id: string;
  kind: "assignment" | "library" | "preview";
  status: string;
  scenario_version_id: string;
  assignment: { classes: { owner_id: string } | null } | null;
};

/** The session as the caller sees it (RLS), plus whether they may grade it (class owner or admin). */
async function loadForReview(sessionId: string, user: CurrentUser) {
  const supabase = await createClient();
  const { data: s } = await supabase
    .from("sessions")
    .select("id, user_id, kind, status, scenario_version_id, assignment:assignments(classes(owner_id))")
    .eq("id", sessionId)
    .maybeSingle<SessionAccess>();
  if (!s) return null;
  const isReviewer = user.role === "admin" || (user.role === "pengajar" && s.assignment?.classes?.owner_id === user.id);
  return { session: s, isReviewer };
}

const reviewInput = z.object({
  sessionId: z.uuid(),
  levels: z.array(z.coerce.number().int().min(1).max(4)).min(1).max(8),
  comment: z.string().trim().max(2000),
});

export type ReviewState = { ok?: boolean; error?: string };

/** US-G-07: teacher sets the final level per rubric criterion + a comment; the final score is recomputed here. */
export async function reviewEvaluation(_: ReviewState, form: FormData): Promise<ReviewState> {
  const user = await requireUser({ roles: ["pengajar", "admin"] });
  const parsed = reviewInput.safeParse({ sessionId: form.get("sessionId"), levels: form.getAll("level"), comment: form.get("comment") ?? "" });
  if (!parsed.success) return { error: "Isian tidak valid." };
  const { sessionId, levels, comment } = parsed.data;

  const access = await loadForReview(sessionId, user);
  if (!access?.isReviewer || access.session.status !== "graded") return { error: "Kamu tidak bisa menilai sesi ini." };

  const db = createAdminClient();
  const [{ data: ev }, scenario] = await Promise.all([
    db.from("evaluations").select("ai_result").eq("session_id", sessionId).single(),
    loadScenarioContent(access.session.scenario_version_id),
  ]);
  if (!ev || !scenario) return { error: "Penilaian tidak ditemukan." };
  const { rubric } = scenario.content;
  if (levels.length !== rubric.length) return { error: "Isi level untuk setiap kriteria." };

  const override: Override = { criteria: Object.fromEntries(rubric.map((c, i) => [c.criterion, levels[i] as 1 | 2 | 3 | 4])) };
  const result = ev.ai_result as GradeResult;
  const finalScore = computeScore({ facts: result.facts, criteria: applyOverride(result, override) }, scenario.content);

  const { error } = await db.rpc("review_evaluation", {
    p_session_id: sessionId,
    p_reviewer: user.id,
    p_override: override,
    p_final_score: finalScore,
    p_comment: comment,
  });
  if (error) return { error: "Gagal menyimpan. Coba lagi." };
  refresh(); // re-render the summary with the new final score
  return { ok: true };
}

/**
 * Re-runs a failed grading (docs/workflow.md §4): the class teacher/admin for assignments; the learner
 * themself for practice and preview sessions, which have no teacher to ask.
 */
export async function regradeSession(form: FormData): Promise<void> {
  const user = await requireUser();
  const sessionId = z.uuid().safeParse(form.get("sessionId"));
  if (!sessionId.success) redirect("/dashboard");

  const access = await loadForReview(sessionId.data, user);
  const s = access?.session;
  const allowed = s && s.status === "grading_failed" && (access.isReviewer || (s.kind !== "assignment" && s.user_id === user.id));
  // Claim now so the page we redirect to already says "diproses"; the slow LLM run happens after the response.
  if (allowed && (await claimGrading(s.id))) after(() => gradeClaimed(s.id));
  redirect(`/sesi/${sessionId.data}/selesai`);
}

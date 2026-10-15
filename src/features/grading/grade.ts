import "server-only";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { loadScenarioContent } from "@/features/interview/context";
import type { ScenarioContent } from "@/features/scenario/schema";
import { extractJson } from "@/lib/llm/extract-json";
import { complete } from "@/lib/llm/gateway";
import { GRADER_PROMPT_VERSION, buildGraderMessages } from "@/lib/llm/prompts/grader";
import { createAdminClient } from "@/lib/supabase/admin";
import { computeScore, normalizeGrade, type GradeResult, type Turn } from "./result";

const ATTEMPTS = 3; // first try + 2 retries (docs/workflow.md §4); provider fallback happens inside the gateway
const BACKOFF_MS = [0, 2_000, 6_000];

export type GraderRun = { result: GradeResult; score: number; model: string };

/** Asks the grader LLM, validates and scores. null after every attempt failed. No database access (used by `npm run eval`). */
export async function runGrader(content: ScenarioContent, transcript: Turn[]): Promise<GraderRun | null> {
  const messages: ChatCompletionMessageParam[] = buildGraderMessages({
    learnerRole: content.learnerRole,
    objective: content.objective,
    clientName: content.persona.name,
    facts: content.facts,
    rubric: content.rubric,
    transcript,
  });

  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    await new Promise((r) => setTimeout(r, BACKOFF_MS[attempt]));
    let reply: string;
    let model: string;
    try {
      ({ text: reply, model } = await complete({ task: "grader", json: true, messages }));
    } catch {
      continue; // both providers failed this round; back off and try again
    }
    const graded = normalizeGrade(extractJson(reply), content, transcript);
    if (graded.ok) return { result: graded.result, score: computeScore(graded.result, content), model };
    messages.push(
      { role: "assistant", content: reply.slice(0, 6000) },
      { role: "user", content: `${graded.error} Balas ulang HANYA objek JSON lengkap sesuai skema.` },
    );
  }
  return null;
}

/**
 * Grades one finished session end to end. Safe to call more than once: `claim_grading` lets only one
 * run through, and returns false for sessions that are still running, already graded or have no questions.
 * Callers MUST have checked that the user may end/view this session; everything here runs as service role.
 */
export async function gradeSession(sessionId: string): Promise<void> {
  if (await claimGrading(sessionId)) await gradeClaimed(sessionId);
}

/** Moves the session to 'grading' (see claim_grading). Lets a caller show "diproses" before the run starts. */
export async function claimGrading(sessionId: string): Promise<boolean> {
  const { data } = await createAdminClient().rpc("claim_grading", { p_session_id: sessionId });
  return data === true;
}

/** Grades a session this caller has just claimed; always ends in 'graded' or 'grading_failed'. */
export async function gradeClaimed(sessionId: string): Promise<void> {
  const db = createAdminClient();
  let run: GraderRun | null = null;
  try {
    const [{ data: session }, { data: rows }] = await Promise.all([
      db.from("sessions").select("scenario_version_id").eq("id", sessionId).single(),
      db.from("messages").select("seq, speaker, text").eq("session_id", sessionId).order("seq"),
    ]);
    const scenario = session && (await loadScenarioContent(session.scenario_version_id as string));
    if (scenario) run = await runGrader(scenario.content, (rows ?? []) as Turn[]);
  } catch {
    // run stays null: marked failed below so a teacher can re-run it (docs/workflow.md §4)
  }
  await db.rpc("finish_grading", {
    p_session_id: sessionId,
    p_result: run?.result ?? null,
    p_score: run?.score ?? 0,
    p_model: run?.model ?? "",
    p_prompt_version: GRADER_PROMPT_VERSION,
  });
}

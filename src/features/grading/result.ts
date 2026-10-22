import { z } from "zod";
import type { ScenarioContent } from "@/features/scenario/schema";

// docs/ai-design.md §3. What the grader LLM must return; everything is re-checked in code below.
export const gradeResultSchema = z.object({
  facts: z.array(z.object({ factId: z.string(), found: z.boolean(), evidenceSeq: z.array(z.number().int()).max(20) })).max(40),
  criteria: z.array(z.object({ criterion: z.string(), level: z.number().int().min(1).max(4), rationale: z.string().trim().max(600) })).max(16),
  questionQuality: z.object({
    open: z.number().int().min(0),
    closed: z.number().int().min(0),
    leading: z.number().int().min(0),
    followUps: z.number().int().min(0),
  }),
  betterQuestions: z.array(z.string().trim().min(1).max(300)).min(3),
  anomalies: z.array(z.string().trim().max(300)).max(10).default([]),
  summary: z.string().trim().min(1).max(800),
});

/** Stored in evaluations.ai_result: fact ids/flags only, in scenario order, evidence already validated. */
export type GradeResult = {
  facts: { factId: string; found: boolean; evidenceSeq: number[] }[];
  criteria: { criterion: string; level: 1 | 2 | 3 | 4; rationale: string }[];
  questionQuality: { open: number; closed: number; leading: number; followUps: number };
  betterQuestions: string[];
  anomalies: string[];
  summary: string;
};

export type Turn = { seq: number; speaker: "learner" | "character"; text: string };

type Grading = Pick<ScenarioContent, "facts" | "rubric">;

const key = (s: string) => s.trim().toLowerCase();

/**
 * Validates raw grader JSON against the scenario and transcript. Evidence must point to a character
 * turn preceded by a learner turn; a fact without valid evidence is not found. Returns an error
 * message (fed back to the LLM on retry) when the output can't be used.
 */
export function normalizeGrade(raw: unknown, scenario: Grading, transcript: Turn[]): { ok: true; result: GradeResult } | { ok: false; error: string } {
  const parsed = gradeResultSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, error: `Skema tidak valid di ${issue?.path.join(".") || "root"}: ${issue?.message}` };
  }
  const g = parsed.data;

  const criteria: GradeResult["criteria"] = [];
  for (const c of scenario.rubric) {
    const hit = g.criteria.find((x) => key(x.criterion) === key(c.criterion));
    if (!hit) return { ok: false, error: `Kriteria "${c.criterion}" tidak dinilai.` };
    criteria.push({ criterion: c.criterion, level: hit.level as 1 | 2 | 3 | 4, rationale: hit.rationale });
  }

  const bySeq = new Map(transcript.map((t) => [t.seq, t]));
  const firstLearner = Math.min(...transcript.filter((t) => t.speaker === "learner").map((t) => t.seq));
  const facts = scenario.facts.map((f) => {
    const hit = g.facts.find((x) => key(x.factId) === key(f.id));
    const evidenceSeq = [...new Set(hit?.evidenceSeq ?? [])]
      .filter((seq) => bySeq.get(seq)?.speaker === "character" && seq > firstLearner)
      .sort((a, b) => a - b);
    return { factId: f.id, found: Boolean(hit?.found) && evidenceSeq.length > 0, evidenceSeq };
  });

  return {
    ok: true,
    result: { facts, criteria, questionQuality: g.questionQuality, betterQuestions: g.betterQuestions.slice(0, 3), anomalies: g.anomalies, summary: g.summary },
  };
}

/** Score is computed in code, never by the LLM (docs/ai-design.md §3). 0..100. */
export function computeScore(result: Pick<GradeResult, "facts" | "criteria">, scenario: Grading): number {
  const found = new Set(result.facts.filter((f) => f.found).map((f) => f.factId));
  const factWeight = scenario.facts.reduce((s, f) => s + f.weight, 0);
  const coverage = scenario.facts.reduce((s, f) => s + (found.has(f.id) ? f.weight : 0), 0) / factWeight;

  const levels = new Map(result.criteria.map((c) => [key(c.criterion), c.level]));
  const rubricWeight = scenario.rubric.reduce((s, c) => s + c.weight, 0);
  const rubric = scenario.rubric.reduce((s, c) => s + ((levels.get(key(c.criterion)) ?? 1) / 4) * c.weight, 0) / rubricWeight;

  return Math.round(100 * (0.6 * coverage + 0.4 * rubric));
}

/** The learner question that opened a fact: the last learner turn before the first evidence turn. */
export function triggerQuestion(evidenceSeq: number[], transcript: Turn[]): Turn | undefined {
  if (evidenceSeq.length === 0) return undefined;
  const first = Math.min(...evidenceSeq);
  return transcript.filter((t) => t.speaker === "learner" && t.seq < first).at(-1);
}

/**
 * Missed-fact details stay hidden while an assignment is still open (US-P-08); practice and preview
 * reveal them at once (US-P-09). An assignment without a deadline never closes, so it stays hidden.
 */
export function revealMissed(kind: "assignment" | "library" | "preview", duePassed: boolean): boolean {
  return kind !== "assignment" || duePassed;
}

/** Teacher override stored in evaluations.override (US-G-07): final level per rubric criterion. */
export type Override = { criteria: Record<string, 1 | 2 | 3 | 4> };

/** AI criteria with the teacher's levels applied; `ai` keeps the grader's level for display. */
export function applyOverride(result: Pick<GradeResult, "criteria">, override: Override | null) {
  return result.criteria.map((c) => ({ ...c, ai: c.level, level: override?.criteria[c.criterion] ?? c.level }));
}

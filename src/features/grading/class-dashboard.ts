import type { ScenarioContent } from "@/features/scenario/schema";
import type { GradeResult } from "./result";

type Fact = ScenarioContent["facts"][number];

// US-G-08: per-assignment aggregates, computed on the server; only the returned shapes reach the page.

export type LearnerStatus = "belum" | "berjalan" | "selesai" | "dinilai";

export const LEARNER_STATUS_LABEL: Record<LearnerStatus, string> = {
  belum: "Belum mulai",
  berjalan: "Berjalan",
  selesai: "Selesai, belum dinilai",
  dinilai: "Dinilai",
};

/** A learner's status for one assignment from the statuses of all their attempts. */
export function learnerStatus(sessionStatuses: string[]): LearnerStatus {
  if (sessionStatuses.length === 0) return "belum";
  if (sessionStatuses.includes("graded")) return "dinilai";
  if (sessionStatuses.includes("active")) return "berjalan";
  return "selesai";
}

/** Counts per 10-point range: [0–9, 10–19, …, 90–100]. */
export function scoreHistogram(scores: number[]): number[] {
  const bins = Array<number>(10).fill(0);
  for (const s of scores) bins[Math.min(9, Math.max(0, Math.floor(s / 10)))]! += 1;
  return bins;
}

/**
 * Fact content is shown to the scenario's author acting as a teacher only. Admins and teachers using
 * someone else's library scenario get categories (docs/security-privacy.md §4), even an admin who once wrote it.
 */
export function canSeeFactContent(user: { id: string; role: string }, authorId: string | null | undefined): boolean {
  return user.role === "pengajar" && authorId === user.id;
}

export type MissedFact = { factId: string; category: Fact["category"]; content: string | null; missed: number; of: number };

/**
 * Facts missed by the most learners. A learner missed a fact when none of their graded attempts found it.
 * `content` is only filled for the scenario's author: other teachers get the category (scenario secret,
 * docs/security-privacy.md §4).
 */
export function missedFacts(
  gradedByLearner: Pick<GradeResult, "facts">[][],
  facts: Pick<Fact, "id" | "category" | "content">[],
  showContent: boolean,
): MissedFact[] {
  const of = gradedByLearner.filter((attempts) => attempts.length > 0).length;
  return facts
    .map((f) => ({
      factId: f.id,
      category: f.category,
      content: showContent ? f.content : null,
      missed: gradedByLearner.filter((attempts) => attempts.length > 0 && !attempts.some((a) => a.facts.some((x) => x.factId === f.id && x.found))).length,
      of,
    }))
    .filter((f) => f.missed > 0)
    .sort((a, b) => b.missed - a.missed);
}

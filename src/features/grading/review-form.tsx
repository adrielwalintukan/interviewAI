"use client";

import { useActionState } from "react";
import { Notice, SubmitButton } from "@/components/ui/form";
import { reviewEvaluation, type ReviewState } from "./actions";

const LEVELS = [1, 2, 3, 4] as const;

export type ReviewCriterion = { criterion: string; level: number; ai: number };

/** US-G-07: per-criterion final level (defaults to the current one) + comment. Score is recomputed on the server. */
export function ReviewForm({ sessionId, criteria, comment }: { sessionId: string; criteria: ReviewCriterion[]; comment: string | null }) {
  const [state, action] = useActionState<ReviewState, FormData>(reviewEvaluation, {});
  return (
    // Keyed on the saved values: React resets a form after its action and <select defaultValue> ignores later
    // prop changes, so remount the fields (the action state above, and its "tersimpan" notice, survive).
    <form key={`${criteria.map((c) => c.level).join("")}|${comment ?? ""}`} action={action} className="flex flex-col gap-5">
      <input type="hidden" name="sessionId" value={sessionId} />
      {criteria.map((c, i) => (
        <div key={c.criterion} className="flex flex-col gap-1.5">
          <label htmlFor={`level-${i}`} className="text-sm font-medium">
            {c.criterion}
          </label>
          <select
            id={`level-${i}`}
            name="level"
            defaultValue={c.level}
            aria-describedby={`level-${i}-ai`}
            className="min-h-11 rounded-sm border border-rule bg-paper px-3 text-base text-ink focus:border-ink"
          >
            {LEVELS.map((l) => (
              <option key={l} value={l}>
                Level {l}
              </option>
            ))}
          </select>
          <p id={`level-${i}-ai`} className="font-mono text-label uppercase text-ink-2">
            AI: level {c.ai}
          </p>
        </div>
      ))}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="review-comment" className="font-mono text-label uppercase text-ink-2">
          Komentar untuk pelajar
        </label>
        <textarea
          id="review-comment"
          name="comment"
          maxLength={2000}
          rows={4}
          defaultValue={comment ?? ""}
          className="rounded-sm border border-rule bg-paper px-3 py-2 text-base text-ink focus:border-ink"
        />
      </div>
      {state.error && <Notice>{state.error}</Notice>}
      {state.ok && <Notice tone="ok">Nilai final tersimpan.</Notice>}
      <SubmitButton pending="Menyimpan…">Simpan nilai final</SubmitButton>
    </form>
  );
}

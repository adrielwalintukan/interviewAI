// `npm run eval` — runs the real grader (9router → Gemini) on the transcript fixtures and checks score ranges
// (docs/ai-design.md §5). Uses provider quota: run it when the grader prompt or model changes, not in CI.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { runGrader } from "@/features/grading/grade";
import type { Turn } from "@/features/grading/result";
import { contentSchema } from "@/features/scenario/schema";

process.loadEnvFile(".env.local"); // same server env the app uses; never printed

type Fixture = { scenario: unknown; cases: { name: string; expect: { min: number; max: number }; transcript: Turn[] }[] };

for (const file of ["laundry"]) {
  const fixture = JSON.parse(readFileSync(`tests/fixtures/transcripts/${file}.json`, "utf8")) as Fixture;
  const scenario = contentSchema.parse(fixture.scenario);
  const hardFacts = new Set(scenario.facts.filter((f) => f.difficulty === 3).map((f) => f.id));

  describe(file, () => {
    for (const c of fixture.cases) {
      it(`${c.name}: score in ${c.expect.min}..${c.expect.max}`, { timeout: 240_000 }, async () => {
        const run = await runGrader(scenario, c.transcript);
        expect(run, "grader failed after all attempts").not.toBeNull();
        const found = run!.result.facts.filter((f) => f.found).map((f) => f.factId);
        console.log(`[eval] ${file}/${c.name}: score ${run!.score}, found ${found.join(",") || "-"}, model ${run!.model}`);
        expect(run!.score).toBeGreaterThanOrEqual(c.expect.min);
        expect(run!.score).toBeLessThanOrEqual(c.expect.max);
        if (c.name === "injection") expect(found.filter((id) => hardFacts.has(id))).toEqual([]);
      });
    }
  });
}

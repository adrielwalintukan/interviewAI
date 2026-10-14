import { describe, expect, it } from "vitest";
import { computeScore, normalizeGrade, revealMissed, triggerQuestion, type Turn } from "./result";

const descriptors = { 1: "a", 2: "b", 3: "c", 4: "d" };
const scenario = {
  facts: [
    { id: "F1", category: "kendala" as const, content: "Kurir hanya 2 orang", weight: 3, difficulty: 3, triggerHint: "SDM" },
    { id: "F2", category: "bisnis" as const, content: "40 transaksi per hari", weight: 1, difficulty: 1, triggerHint: "volume" },
  ],
  rubric: [
    { criterion: "Pembukaan", weight: 1, descriptors },
    { criterion: "Teknik bertanya", weight: 3, descriptors },
  ],
};

const transcript: Turn[] = [
  { seq: 1, speaker: "character", text: "Halo, ada 40 transaksi per hari di sini." },
  { seq: 2, speaker: "learner", text: "Berapa kurir Ibu?" },
  { seq: 3, speaker: "character", text: "Cuma dua orang." },
  { seq: 4, speaker: "learner", text: "Ada lagi?" },
  { seq: 5, speaker: "character", text: "Sekitar 40 transaksi sehari." },
];

const raw = (over: object = {}) => ({
  facts: [
    { factId: "F1", found: true, evidenceSeq: [3] },
    { factId: "F2", found: true, evidenceSeq: [5] },
  ],
  criteria: [
    { criterion: "Pembukaan", level: 2, rationale: "Singkat." },
    { criterion: "teknik bertanya ", level: 4, rationale: "Terbuka." },
  ],
  questionQuality: { open: 1, closed: 1, leading: 0, followUps: 1 },
  betterQuestions: ["Q1", "Q2", "Q3", "Q4"],
  anomalies: [],
  summary: "Bagus.",
  ...over,
});

describe("normalizeGrade", () => {
  it("accepts valid output, matches criteria case-insensitively and keeps 3 questions", () => {
    const r = normalizeGrade(raw(), scenario, transcript);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.result.facts).toEqual([
      { factId: "F1", found: true, evidenceSeq: [3] },
      { factId: "F2", found: true, evidenceSeq: [5] },
    ]);
    expect(r.result.criteria.map((c) => c.criterion)).toEqual(["Pembukaan", "Teknik bertanya"]);
    expect(r.result.betterQuestions).toHaveLength(3);
  });

  it("drops evidence that points to learner turns, unknown turns, or turns before any question", () => {
    const r = normalizeGrade(
      raw({ facts: [{ factId: "F1", found: true, evidenceSeq: [2, 99] }, { factId: "F2", found: true, evidenceSeq: [1] }] }),
      scenario,
      transcript,
    );
    expect(r.ok && r.result.facts).toEqual([
      { factId: "F1", found: false, evidenceSeq: [] },
      { factId: "F2", found: false, evidenceSeq: [] },
    ]);
  });

  it("treats facts the grader skipped as not found and ignores unknown fact ids", () => {
    const r = normalizeGrade(raw({ facts: [{ factId: "F9", found: true, evidenceSeq: [3] }] }), scenario, transcript);
    expect(r.ok && r.result.facts.every((f) => !f.found)).toBe(true);
  });

  it("rejects output that misses a rubric criterion or breaks the schema", () => {
    expect(normalizeGrade(raw({ criteria: [{ criterion: "Pembukaan", level: 2, rationale: "x" }] }), scenario, transcript)).toMatchObject({ ok: false });
    expect(normalizeGrade(raw({ betterQuestions: ["satu"] }), scenario, transcript)).toMatchObject({ ok: false });
    expect(normalizeGrade(null, scenario, transcript)).toMatchObject({ ok: false });
  });
});

describe("computeScore", () => {
  it("weights coverage 0.6 and rubric 0.4 (docs/ai-design.md §3)", () => {
    // coverage = 3/4; rubric = (2/4·1 + 4/4·3)/4 = 0.875 → 100·(0.45 + 0.35) = 80
    const result = {
      facts: [
        { factId: "F1", found: true, evidenceSeq: [3] },
        { factId: "F2", found: false, evidenceSeq: [] },
      ],
      criteria: [
        { criterion: "Pembukaan", level: 2 as const, rationale: "" },
        { criterion: "Teknik bertanya", level: 4 as const, rationale: "" },
      ],
    };
    expect(computeScore(result, scenario)).toBe(80);
  });

  it("scores 10 when nothing is found and every criterion is level 1", () => {
    const result = {
      facts: [],
      criteria: [
        { criterion: "Pembukaan", level: 1 as const, rationale: "" },
        { criterion: "Teknik bertanya", level: 1 as const, rationale: "" },
      ],
    };
    expect(computeScore(result, scenario)).toBe(10);
  });
});

describe("triggerQuestion", () => {
  it("returns the last learner turn before the first evidence turn", () => {
    expect(triggerQuestion([5, 3], transcript)?.seq).toBe(2);
    expect(triggerQuestion([3], transcript)?.text).toBe("Berapa kurir Ibu?");
    expect(triggerQuestion([], transcript)).toBeUndefined();
  });
});

describe("revealMissed", () => {
  it("hides missed facts of an open assignment, reveals practice and passed deadlines", () => {
    expect(revealMissed("assignment", false)).toBe(false);
    expect(revealMissed("assignment", true)).toBe(true);
    expect(revealMissed("library", false)).toBe(true);
    expect(revealMissed("preview", false)).toBe(true);
  });
});

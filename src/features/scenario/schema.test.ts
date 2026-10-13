import { describe, expect, it } from "vitest";
import { contentSchema, draftSchema, publishProblems, renumberFacts, type ScenarioDraft } from "./schema";

const descriptors = { 1: "Kurang", 2: "Cukup", 3: "Baik", 4: "Sangat baik" };

const validDraft: ScenarioDraft = {
  title: "Laundry Antar-Jemput",
  language: "id",
  level: "smk",
  learnerRole: "Analis sistem dari software house",
  objective: "Gali kebutuhan aplikasi antar-jemput laundry",
  characterId: "ratna",
  persona: {
    name: "Bu Ratna",
    age: 45,
    occupation: "Pemilik laundry",
    background: "Membuka laundry sejak 2015 di Manado.",
    speakingStyle: "Santai, suka bercerita",
    attitude: "Sibuk, agak skeptis",
    openingLine: "Silakan, tapi saya cuma punya 15 menit ya.",
  },
  facts: [1, 2, 3].map((n) => ({
    id: `F${n}`,
    category: "fungsional" as const,
    content: `Fakta ${n}`,
    weight: 2,
    difficulty: 2,
    triggerHint: "ditanya soal operasional",
  })),
  rubric: [{ criterion: "Teknik bertanya", weight: 2, descriptors }],
};

describe("scenario schema", () => {
  it("accepts a complete scenario for publishing", () => {
    expect(contentSchema.safeParse(validDraft).success).toBe(true);
    expect(publishProblems(validDraft, ["ratna"])).toEqual([]);
  });

  it("accepts an empty draft for autosave", () => {
    expect(draftSchema.safeParse({}).success).toBe(true);
  });

  it("lists readable publish blockers", () => {
    const problems = publishProblems({ ...validDraft, facts: validDraft.facts!.slice(0, 2), title: "" }, ["ratna"]);
    expect(problems).toContain("title: Judul wajib diisi");
    expect(problems).toContain("facts: Minimal 3 fakta tersembunyi");
  });

  it("rejects unknown characters", () => {
    expect(publishProblems({ ...validDraft, characterId: "hantu" }, ["ratna"])).toContain("characterId: karakter tidak tersedia");
  });

  it("rejects oversized drafts", () => {
    expect(draftSchema.safeParse({ title: "x".repeat(121) }).success).toBe(false);
    expect(draftSchema.safeParse({ facts: Array.from({ length: 21 }, () => ({})) }).success).toBe(false);
  });

  it("renumbers fact ids sequentially", () => {
    expect(renumberFacts([{ id: "F9" }, {}, { id: "x" }]).map((f) => f.id)).toEqual(["F1", "F2", "F3"]);
  });
});

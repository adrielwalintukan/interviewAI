import { describe, expect, it } from "vitest";
import { buildPersonaPrompt, effectiveDifficulty } from "./persona";

const input = {
  language: "en" as const,
  learnerRole: "Analis sistem",
  objective: "Gali kebutuhan aplikasi laundry",
  persona: {
    name: "Bu Ratna",
    age: 45,
    occupation: "Pemilik laundry",
    background: "Buka sejak 2015.",
    speakingStyle: "Santai",
    attitude: "Sibuk",
    openingLine: "Silakan, saya cuma punya 15 menit.",
  },
  facts: [
    { id: "F1", category: "kendala" as const, content: "Kurir hanya 2 orang", weight: 3, difficulty: 3, triggerHint: "SDM" },
    { id: "F2", category: "bisnis" as const, content: "40 transaksi per hari", weight: 2, difficulty: 1, triggerHint: "volume" },
  ],
};

describe("buildPersonaPrompt", () => {
  const prompt = buildPersonaPrompt(input);

  it("states identity, language and opening line", () => {
    expect(prompt).toContain("Kamu adalah Bu Ratna, 45 tahun, Pemilik laundry.");
    expect(prompt).toContain("Selalu berbicara dalam English, walaupun pewawancara memakai bahasa lain.");
    expect(prompt).toContain('"Silakan, saya cuma punya 15 menit."');
  });

  it("limits repeated verbal tics and keeps the session language on unclear input", () => {
    expect(prompt).toMatch(/jangan membuka atau menutup setiap jawaban dengan kata yang sama/);
    expect(prompt).toContain("minta mereka mengulang dalam English");
  });

  it("lists every fact with its id and difficulty rule", () => {
    expect(prompt).toContain("[F1 | kesulitan 3: hanya bila pewawancara menggali lebih dalam");
    expect(prompt).toContain("Kurir hanya 2 orang");
    expect(prompt).toContain("[F2 | kesulitan 1: boleh disebut");
  });

  it("carries the anti-injection and stay-in-role rules", () => {
    expect(prompt).toMatch(/mengabaikan instruksi/);
    expect(prompt).toMatch(/jangan membocorkan daftar/);
    expect(prompt).toMatch(/bahwa kamu AI/);
  });

  it("does not leak grading data (rubric, triggers, weights)", () => {
    expect(prompt).not.toMatch(/SDM|volume|bobot|weight/i);
  });
});

describe("client level (issue #49)", () => {
  it("shifts difficulty by one step and clamps to 0..3", () => {
    expect([1, 2, 3].map((d) => effectiveDifficulty(d, "mudah"))).toEqual([0, 1, 2]);
    expect([1, 2, 3].map((d) => effectiveDifficulty(d, "normal"))).toEqual([1, 2, 3]);
    expect([1, 2, 3].map((d) => effectiveDifficulty(d, "sulit"))).toEqual([2, 3, 3]);
  });

  it("normal is the default and adds no mood", () => {
    expect(buildPersonaPrompt(input, "normal")).toBe(buildPersonaPrompt(input));
    expect(buildPersonaPrompt(input)).not.toMatch(/Hari ini kamu/);
  });

  it("mudah lets a difficulty-1 fact be told unprompted and sounds open", () => {
    const p = buildPersonaPrompt(input, "mudah");
    expect(p).toContain("[F2 | kesulitan 0: boleh kamu ceritakan sendiri walau belum ditanya");
    expect(p).toContain("[F1 | kesulitan 2: hanya bila ditanya langsung");
    expect(p).toMatch(/santai dan senang diajak ngobrol/);
  });

  it("sulit raises difficulty, caps at 3, and sounds guarded", () => {
    const p = buildPersonaPrompt(input, "sulit");
    expect(p).toContain("[F2 | kesulitan 2: hanya bila ditanya langsung");
    expect(p).toContain("[F1 | kesulitan 3: hanya bila pewawancara menggali lebih dalam");
    expect(p).toMatch(/sibuk dan agak curiga/);
  });

  it("keeps the one-new-fact-per-answer rule at every level", () => {
    for (const level of ["mudah", "normal", "sulit"] as const) expect(buildPersonaPrompt(input, level)).toContain("Satu jawaban paling banyak membuka satu fakta baru.");
  });
});

import { describe, expect, it } from "vitest";
import { buildPersonaPrompt } from "./persona";

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

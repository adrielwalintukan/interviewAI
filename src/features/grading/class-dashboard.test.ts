import { describe, expect, it } from "vitest";
import { canSeeFactContent, learnerStatus, missedFacts, scoreHistogram, scoresCsv, scoresFileName } from "./class-dashboard";

describe("learnerStatus", () => {
  it("covers 0, 1 and several attempts", () => {
    expect(learnerStatus([])).toBe("belum");
    expect(learnerStatus(["active"])).toBe("berjalan");
    expect(learnerStatus(["ended"])).toBe("selesai");
    expect(learnerStatus(["grading_failed", "grading"])).toBe("selesai");
    expect(learnerStatus(["graded", "active"])).toBe("dinilai");
  });
});

describe("scoreHistogram", () => {
  it("bins by 10 and puts 100 in the last range", () => {
    expect(scoreHistogram([0, 9, 10, 55, 99, 100])).toEqual([2, 1, 0, 0, 0, 1, 0, 0, 0, 2]);
    expect(scoreHistogram([])).toEqual(Array(10).fill(0));
  });
});

describe("missedFacts", () => {
  const facts = [
    { id: "F1", category: "kendala" as const, content: "Kurir hanya 2 orang" },
    { id: "F2", category: "bisnis" as const, content: "40 transaksi per hari" },
    { id: "F3", category: "fungsional" as const, content: "Foto timbangan" },
  ];
  const r = (...found: string[]) => ({ facts: facts.map((f) => ({ factId: f.id, found: found.includes(f.id), evidenceSeq: [] })) });

  it("counts a fact as missed only when none of a learner's graded attempts found it; ignores ungraded learners", () => {
    const out = missedFacts([[r("F1"), r("F2")], [r()], []], facts, true);
    expect(out).toEqual([
      { factId: "F3", category: "fungsional", content: "Foto timbangan", missed: 2, of: 2 },
      { factId: "F1", category: "kendala", content: "Kurir hanya 2 orang", missed: 1, of: 2 },
      { factId: "F2", category: "bisnis", content: "40 transaksi per hari", missed: 1, of: 2 },
    ]);
  });

  it("never returns fact content to a teacher who is not the scenario author", () => {
    const out = missedFacts([[r()]], facts, false);
    expect(out).toHaveLength(3);
    expect(out.every((f) => f.content === null)).toBe(true);
    expect(JSON.stringify(out)).not.toContain("Kurir");
  });
});

describe("canSeeFactContent", () => {
  it("is true only for the author acting as a teacher", () => {
    expect(canSeeFactContent({ id: "u1", role: "pengajar" }, "u1")).toBe(true);
    expect(canSeeFactContent({ id: "u1", role: "pengajar" }, "u2")).toBe(false);
    expect(canSeeFactContent({ id: "u1", role: "pengajar" }, null)).toBe(false);
    expect(canSeeFactContent({ id: "u1", role: "admin" }, "u1")).toBe(false);
    expect(canSeeFactContent({ id: "u1", role: "admin" }, "u2")).toBe(false);
  });
});

describe("scoresCsv", () => {
  it("lists every learner, leaves the score empty when not started, and neutralises formulas", () => {
    const csv = scoresCsv([
      { name: "Budi, S.", username: "budi", attempts: 2, best: 87, status: "dinilai" },
      { name: "=HYPERLINK(\"x\")", username: null, attempts: 0, best: null, status: "belum" },
      { name: "@ani", username: "-ani", attempts: 1, best: null, status: "selesai" },
    ], "sulit");
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv.slice(1).startsWith("nama,username,percobaan,nilai_final_terbaik,status,sikap_klien\r\n")).toBe(true);
    const rows = csv.slice(1).trimEnd().split("\r\n");
    expect(rows).toEqual([
      "nama,username,percobaan,nilai_final_terbaik,status,sikap_klien",
      "\"Budi, S.\",budi,2,87,Dinilai,Sulit",
      "\"'=HYPERLINK(\"\"x\"\")\",,0,,Belum mulai,Sulit",
      "'@ani,'-ani,1,,\"Selesai, belum dinilai\",Sulit",
    ]);
  });
});

describe("scoresFileName", () => {
  it("slugs the title and appends the date", () => {
    expect(scoresFileName("Elisitasi Kebutuhan: Laundry & Kurir", new Date("2026-10-18T05:00:00Z"))).toBe("nilai-elisitasi-kebutuhan-laundry-kurir-2026-10-18.csv");
    expect(scoresFileName("???", new Date("2026-10-18T05:00:00Z"))).toBe("nilai-tugas-2026-10-18.csv");
  });
});

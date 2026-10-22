import { describe, expect, it } from "vitest";
import { MAX_BULK_ROWS, generateInitialPassword, parseStudentCsv } from "./bulk-students";
import { csvCell } from "./csv-cell";

describe("parseStudentCsv", () => {
  it("parses rows, skips header/blank lines, lowercases usernames", () => {
    const { rows, rejected } = parseStudentCsv("nama,username\nBudi Santoso,Budi.S\n\n\"Siti, S.Pd\",siti_01\r\n");
    expect(rejected).toEqual([]);
    expect(rows).toEqual([
      { line: 2, name: "Budi Santoso", username: "budi.s" },
      { line: 4, name: "Siti, S.Pd", username: "siti_01" },
    ]);
  });

  it("accepts semicolon CSV from Excel (Indonesian locale) and a BOM", () => {
    const { rows } = parseStudentCsv("﻿Ani;ani99");
    expect(rows).toEqual([{ line: 1, name: "Ani", username: "ani99" }]);
  });

  it("rejects bad rows but keeps good ones", () => {
    const { rows, rejected } = parseStudentCsv(
      ["Ani,ani", ",kosong", "Budi,bu", "Cici,ani", "Dedi,dedi sp", "Eko,eko"].join("\n"),
      new Set(["eko"]),
    );
    expect(rows.map((r) => r.username)).toEqual(["ani"]);
    expect(rejected.map((r) => [r.line, r.reason])).toEqual([
      [2, "Nama wajib diisi (maks. 80 karakter)"],
      [3, "Username 3–32 karakter: huruf kecil, angka, titik, atau garis bawah"],
      [4, "Username ganda di file ini"],
      [5, "Username 3–32 karakter: huruf kecil, angka, titik, atau garis bawah"],
      [6, "Username sudah dipakai"],
    ]);
  });

  it(`caps at ${MAX_BULK_ROWS} rows`, () => {
    const text = Array.from({ length: MAX_BULK_ROWS + 2 }, (_, i) => `Siswa ${i},siswa${i}`).join("\n");
    const { rows, rejected } = parseStudentCsv(text);
    expect(rows).toHaveLength(MAX_BULK_ROWS);
    expect(rejected).toHaveLength(2);
  });
});

describe("generateInitialPassword", () => {
  it("is 12 unambiguous chars and varies", () => {
    const a = generateInitialPassword();
    expect(a).toMatch(/^[a-km-zA-HJ-NP-Z2-9]{12}$/);
    expect(new Set(Array.from({ length: 20 }, () => generateInitialPassword())).size).toBe(20);
  });
});

describe("csvCell", () => {
  it("neutralises formulas and quotes separators", () => {
    expect(csvCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvCell("Siti, S.Pd")).toBe('"Siti, S.Pd"');
    expect(csvCell("budi")).toBe("budi");
  });
});

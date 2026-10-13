import { describe, expect, it } from "vitest";
import { loginIdentifierToEmail, safeNextPath, usernameToEmail } from "./identifier";

describe("loginIdentifierToEmail", () => {
  it("keeps emails, lowercased and trimmed", () => {
    expect(loginIdentifierToEmail("  Guru@Sekolah.ID ")).toBe("guru@sekolah.id");
  });

  it("maps a valid username to the synthetic domain", () => {
    expect(loginIdentifierToEmail("Budi.S")).toBe(usernameToEmail("budi.s"));
    expect(usernameToEmail("budi.s")).toBe("budi.s@pelajar.interview-ai.invalid");
  });

  it.each(["ab", "budi santoso", "budi!", "x".repeat(33), ""])("rejects invalid username %j", (raw) => {
    expect(loginIdentifierToEmail(raw)).toBeNull();
  });
});

describe("safeNextPath", () => {
  it("allows internal paths", () => {
    expect(safeNextPath("/kelas/123")).toBe("/kelas/123");
  });

  it.each(["https://evil.test", "//evil.test", "/\\evil.test", undefined, 42])("falls back for %j", (next) => {
    expect(safeNextPath(next)).toBe("/dashboard");
  });
});

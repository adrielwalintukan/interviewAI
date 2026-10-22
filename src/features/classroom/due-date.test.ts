import { describe, expect, it } from "vitest";
import { toDueInstant } from "./due-date";

describe("toDueInstant", () => {
  it.each([
    ["WIB (UTC+7)", -420, "2026-10-20T16:59:00.000Z"],
    ["WITA (UTC+8)", -480, "2026-10-20T15:59:00.000Z"],
    ["WIT (UTC+9)", -540, "2026-10-20T14:59:00.000Z"],
  ])("converts 23:59 local in %s", (_, offset, expected) => {
    expect(toDueInstant("2026-10-20T23:59", offset)).toBe(expected);
  });

  it("returns null for no deadline or garbage", () => {
    expect(toDueInstant("", -480)).toBeNull();
    expect(toDueInstant("bukan-tanggal", -480)).toBeNull();
  });
});

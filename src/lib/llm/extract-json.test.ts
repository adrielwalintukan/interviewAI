import { describe, expect, it } from "vitest";
import { extractJson } from "./extract-json";

describe("extractJson", () => {
  it("parses plain JSON", () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 });
  });

  it("parses fenced JSON with trailing prose (seen from 9router)", () => {
    expect(extractJson('```json\n{"status":"siap"}\n```\nsk')).toEqual({ status: "siap" });
  });

  it("parses JSON surrounded by prose", () => {
    expect(extractJson('Berikut hasilnya: {"a":{"b":[1,2]}} semoga membantu')).toEqual({ a: { b: [1, 2] } });
  });

  it.each(["", "tidak ada json", "{rusak", "```json\n{bad}\n```"])("returns null for %j", (reply) => {
    expect(extractJson(reply)).toBeNull();
  });
});

import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { deepgramModel } = await import("./deepgram");

describe("deepgramModel", () => {
  it("maps each seeded character's Gemini voice to a distinct Indonesian Deepgram voice", () => {
    expect(deepgramModel("Aoede", "female")).toBe("flux-dewi-id"); // Bu Ratna
    expect(deepgramModel("Leda", "female")).toBe("flux-fitri-id"); // Kak Nadia
    expect(deepgramModel("Charon", "male")).toBe("flux-teguh-id"); // Pak Hendra
    expect(deepgramModel("Orus", "male")).toBe("flux-fajar-id"); // Pak Yosef
    expect(deepgramModel("Puck", "male")).toBe("flux-rizky-id"); // Mas Dimas
  });

  it("keeps Bu Sri on a female voice: only two Indonesian female voices exist", () => {
    expect(deepgramModel("Kore", "female")).toBe("flux-dewi-id");
  });

  it("falls back to the character's gender for a voice it doesn't know", () => {
    expect(deepgramModel("Sulafat", "female")).toBe("flux-dewi-id");
    expect(deepgramModel("Sulafat", "male")).toBe("flux-fajar-id");
  });

  it("never returns an empty model for an unexpected gender value", () => {
    expect(deepgramModel("Sulafat", "other")).toBe("flux-dewi-id");
  });
});

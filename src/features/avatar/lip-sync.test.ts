import { describe, expect, it } from "vitest";
import { VOWELS, ease, mouthShape } from "./lip-sync";

const top = (m: ReturnType<typeof mouthShape>) => VOWELS.reduce((a, b) => (m[b] > m[a] ? b : a));
const total = (m: ReturnType<typeof mouthShape>) => VOWELS.reduce((s, v) => s + m[v], 0);

describe("mouthShape", () => {
  it("keeps the mouth closed below the speech gate", () => {
    expect(total(mouthShape(0, 1300))).toBe(0);
    expect(total(mouthShape(0.03, 1300))).toBe(0);
  });

  it("picks the vowel from the centroid, dark to bright", () => {
    expect(top(mouthShape(0.5, 500))).toBe("ou");
    expect(top(mouthShape(0.5, 900))).toBe("oh");
    expect(top(mouthShape(0.5, 1300))).toBe("aa");
    expect(top(mouthShape(0.5, 1900))).toBe("ee");
    expect(top(mouthShape(0.5, 4000))).toBe("ih");
  });

  it("opens wider when louder and never past 1", () => {
    expect(total(mouthShape(0.2, 1300))).toBeLessThan(total(mouthShape(0.4, 1300)));
    expect(total(mouthShape(1, 1100))).toBeCloseTo(1);
  });
});

describe("ease", () => {
  it("moves toward the target by the same amount per second at any frame rate", () => {
    let fast = 0;
    for (let i = 0; i < 60; i++) fast = ease(fast, 1, 1 / 60);
    let slow = 0;
    for (let i = 0; i < 30; i++) slow = ease(slow, 1, 1 / 30);
    expect(fast).toBeCloseTo(slow, 6);
    expect(ease(0.5, 0.5, 0.016)).toBe(0.5);
  });
});

import { describe, expect, it, vi } from "vitest";
import { stepAvatarFrame, type AvatarFrameState } from "./vrm-avatar";

describe("VRM Avatar Runtime Reduced Motion (docs/design-system.md §4)", () => {
  function createMockVrm() {
    const expressions: Record<string, number> = {};
    const setValue = vi.fn((name: string, val: number) => {
      expressions[name] = val;
    });

    const headRotation = { x: 0, y: 0, z: 0 };
    const headRotationSet = vi.fn((x: number, y: number, z: number) => {
      headRotation.x = x;
      headRotation.y = y;
      headRotation.z = z;
    });

    const chestRotation = { x: 0, y: 0, z: 0 };
    const chestRotationSet = vi.fn((x: number, y: number, z: number) => {
      chestRotation.x = x;
      chestRotation.y = y;
      chestRotation.z = z;
    });

    const vrm = {
      expressionManager: { setValue },
      humanoid: {
        getNormalizedBoneNode: (name: string) => {
          if (name === "head") return { rotation: { set: headRotationSet } };
          if (name === "chest") return { rotation: { set: chestRotationSet } };
          return null;
        },
      },
      update: vi.fn(),
    };

    return { vrm, setValue, expressions, headRotationSet, chestRotationSet };
  }

  it("actively drives lip-sync and blink while halting head/chest rotations when still === true", () => {
    const { vrm, setValue, headRotationSet, chestRotationSet } = createMockVrm();

    const state: AvatarFrameState = {
      mouth: { aa: 0, ih: 0, ou: 0, ee: 0, oh: 0 },
      blink: { next: 2.0, t: -1 },
      nod: { x: 0, y: 0, z: 0, chest: 0 },
    };

    // Voice speaking with moderate volume and bright centroid
    const voice = () => ({ level: 0.6, centroid: 1300 });

    // Step at t = 2.05s (triggering blink condition: t >= blink.next)
    stepAvatarFrame({
      vrm,
      dt: 0.05,
      t: 2.05,
      voice,
      pose: "speaking",
      still: true,
      state,
    });

    // 1. Lip-sync must be actively applied to expressionManager
    const vowelCalls = setValue.mock.calls.filter(([name]) => ["aa", "ih", "ou", "ee", "oh"].includes(name as string));
    expect(vowelCalls.length).toBeGreaterThan(0);
    const hasActiveMouthOpening = vowelCalls.some(([, val]) => (val as number) > 0);
    expect(hasActiveMouthOpening).toBe(true);

    // 2. Blink must be actively applied
    const blinkCalls = setValue.mock.calls.filter(([name]) => name === "blink");
    expect(blinkCalls.length).toBeGreaterThan(0);
    const hasBlinkValue = blinkCalls.some(([, val]) => (val as number) > 0);
    expect(hasBlinkValue).toBe(true);

    // 3. Bone rotations (head, nod, idle sway, chest breathing) must NOT be called at all
    expect(headRotationSet).not.toHaveBeenCalled();
    expect(chestRotationSet).not.toHaveBeenCalled();
  });

  it("actively drives head, sway, and chest breathing bone rotations when still === false", () => {
    const { vrm, headRotationSet, chestRotationSet } = createMockVrm();

    const state: AvatarFrameState = {
      mouth: { aa: 0, ih: 0, ou: 0, ee: 0, oh: 0 },
      blink: { next: 5.0, t: -1 },
      nod: { x: 0, y: 0, z: 0, chest: 0 },
    };

    stepAvatarFrame({
      vrm,
      dt: 0.05,
      t: 1.0,
      pose: "listening",
      still: false,
      state,
    });

    // When still is false, head and chest bones MUST be rotated according to pose/idle animation
    expect(headRotationSet).toHaveBeenCalled();
    expect(chestRotationSet).toHaveBeenCalled();
  });
});

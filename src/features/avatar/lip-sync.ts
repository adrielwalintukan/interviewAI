// Analyser-driven lip-sync (architecture §5): loudness opens the mouth, the spectral centroid of the voice picks
// the vowel. A rough cue, not phoneme alignment: it only has to look in time with the voice.

export const VOWELS = ["aa", "ih", "ou", "ee", "oh"] as const;
export type Vowel = (typeof VOWELS)[number];
export type Mouth = Record<Vowel, number>;

// Centroid (Hz) where each vowel peaks, dark to bright: rounded vowels sit low, spread vowels high.
const PEAKS: [Vowel, number][] = [
  ["ou", 600],
  ["oh", 900],
  ["aa", 1300],
  ["ee", 1900],
  ["ih", 2500],
];

const clamp = (v: number) => Math.min(1, Math.max(0, v));

/** Target mouth for one frame. `level` is analyserLevel (0..1), `centroid` is analyserCentroid in Hz. */
export function mouthShape(level: number, centroid: number): Mouth {
  const open = clamp((level - 0.04) / 0.45); // below the gate is breath/noise, not speech
  const mouth: Mouth = { aa: 0, ih: 0, ou: 0, ee: 0, oh: 0 };
  if (open === 0) return mouth;
  // Blend the two vowels whose peaks bracket the centroid.
  const hz = Math.min(Math.max(centroid, PEAKS[0]![1]), PEAKS[PEAKS.length - 1]![1]);
  for (let i = 0; i < PEAKS.length - 1; i++) {
    const [a, at] = PEAKS[i]!;
    const [b, bt] = PEAKS[i + 1]!;
    if (hz <= bt) {
      const t = (hz - at) / (bt - at);
      mouth[a] = open * (1 - t);
      mouth[b] = open * t;
      break;
    }
  }
  return mouth;
}

/** Frame-rate independent ease toward the target (time constant in seconds). */
export function ease(current: number, target: number, dt: number, tau = 0.07): number {
  return current + (target - current) * (1 - Math.exp(-dt / tau));
}

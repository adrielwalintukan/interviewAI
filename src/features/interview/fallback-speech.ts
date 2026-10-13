// Free "mode hemat" voice: Web Speech API (STT) + speechSynthesis (TTS). Client-only.

type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
};

function RecognitionCtor(): (new () => Recognition) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export const sttSupported = () => RecognitionCtor() !== null;
export const ttsSupported = () => typeof window !== "undefined" && "speechSynthesis" in window;

const LOCALE = { id: "id-ID", en: "en-US" } as const;

/** One utterance: resolves with the final transcript ("" if nothing heard); interim text via onInterim. */
export function listenOnce(lang: "id" | "en", onInterim: (t: string) => void): { done: Promise<string>; stop: () => void } {
  const Ctor = RecognitionCtor();
  if (!Ctor) return { done: Promise.resolve(""), stop: () => {} };
  const rec = new Ctor();
  rec.lang = LOCALE[lang];
  rec.interimResults = true;
  rec.continuous = false;
  let finalText = "";
  const done = new Promise<string>((resolve) => {
    rec.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i]!;
        if (r.isFinal) finalText += r[0].transcript;
        else interim += r[0].transcript;
      }
      onInterim((finalText + interim).trim());
    };
    rec.onend = () => resolve(finalText.trim());
    rec.onerror = () => resolve(finalText.trim());
  });
  rec.start();
  return { done, stop: () => rec.stop() };
}

function pickVoice(lang: "id" | "en", gender: string): SpeechSynthesisVoice | undefined {
  const voices = speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith(lang));
  // Voice gender isn't exposed; names often hint it (e.g. "Gadis"/"Ardi" on Windows/Android).
  const hint = gender === "female" ? /female|wanita|gadis|damayanti|siti/i : /male|pria|ardi|rizwan/i;
  return voices.find((v) => hint.test(v.name)) ?? voices[0];
}

/**
 * Speaks a reply. speechSynthesis exposes no audio stream, so `onLevel` gets a rough mouth level
 * from word-boundary events instead (architecture §5, fallback lip-sync).
 */
export function speak(text: string, lang: "id" | "en", gender: string, onLevel: (l: number) => void): { done: Promise<void>; cancel: () => void } {
  if (!ttsSupported() || !text) return { done: Promise.resolve(), cancel: () => {} };
  const u = new SpeechSynthesisUtterance(text);
  u.lang = LOCALE[lang];
  const voice = pickVoice(lang, gender);
  if (voice) u.voice = voice;
  u.rate = 1.02;
  let decay: ReturnType<typeof setInterval> | undefined;
  let level = 0;
  const done = new Promise<void>((resolve) => {
    u.onstart = () => {
      decay = setInterval(() => {
        level *= 0.82;
        onLevel(level);
      }, 50);
    };
    u.onboundary = (e) => {
      // Open vowels → wider mouth; a cheap proxy for visemes in the free path.
      const word = text.slice(e.charIndex, e.charIndex + (e.charLength || 6));
      level = Math.min(1, 0.35 + (word.match(/[aeiouAEIOU]/g)?.length ?? 1) * 0.12);
    };
    const finish = () => {
      clearInterval(decay);
      onLevel(0);
      resolve();
    };
    u.onend = finish;
    u.onerror = finish;
  });
  speechSynthesis.cancel();
  speechSynthesis.speak(u);
  return { done, cancel: () => speechSynthesis.cancel() };
}

// "Mode hemat" listening: Web Speech API (STT). Client-only. The character's voice comes from the server (voice.ts).

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

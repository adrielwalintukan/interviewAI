"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { CharacterPortrait } from "@/features/scenario/character-portrait";
import { chatTurn, endSession, logTurn, releaseLive, requestLiveToken } from "./actions";
import { PcmPlayer, bytesToBase64, startMic, type Mic } from "./audio";
import { listenOnce, sttSupported } from "./fallback-speech";
import { LiveConnection } from "./live-client";
import { speakLastReply } from "./voice";

type Speaker = "learner" | "character";
type Turn = { speaker: Speaker; text: string };
type Phase = "ready" | "connecting" | "live" | "fallback" | "ending";
type Activity = "idle" | "listening" | "thinking" | "speaking";

export type StageProps = {
  sessionId: string;
  endsAt: string;
  title: string;
  language: "id" | "en";
  character: { name: string; hue: number };
  initialTurns: Turn[];
};

const noSubscribe = () => () => {};

const OPEN_CUE = "(Pewawancara masuk ruangan. Sapa dengan kalimat pembukamu.)";

function fmt(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export function Stage({ sessionId, endsAt, title, language, character, initialTurns }: StageProps) {
  const [phase, setPhase] = useState<Phase>("ready");
  const [activity, setActivity] = useState<Activity>("idle");
  const [turns, setTurns] = useState<Turn[]>(initialTurns);
  const [partial, setPartial] = useState<{ learner: string; character: string }>({ learner: "", character: "" });
  const [notice, setNotice] = useState<string>();
  const [muted, setMuted] = useState(false);
  const [draft, setDraft] = useState("");
  // Clock and speech support exist only in the browser: null/false on the server avoids hydration mismatches.
  const [remaining, setRemaining] = useState<number | null>(null);
  const stt = useSyncExternalStore(noSubscribe, sttSupported, () => false);

  const live = useRef<LiveConnection | null>(null);
  const mic = useRef<Mic | null>(null);
  const player = useRef<PcmPlayer | null>(null);
  // Bumped on every hush/new turn so a late TTS reply never plays over a newer one.
  const speakId = useRef(0);
  const stopListening = useRef<() => void>(() => {});
  const pending = useRef({ learner: "", character: "" });
  const ringRef = useRef<HTMLDivElement>(null);
  const transcriptEnd = useRef<HTMLDivElement>(null);
  const endDialog = useRef<HTMLDialogElement>(null);
  const phaseRef = useRef<Phase>("ready");
  const turnCount = useRef(initialTurns.length);

  const setPhaseBoth = (p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
  };
  const pushTurn = useCallback((t: Turn) => {
    turnCount.current += 1;
    setTurns((all) => [...all, t]);
  }, []);

  const teardownLive = useCallback(() => {
    live.current?.close();
    live.current = null;
    mic.current?.stop();
    mic.current = null;
    player.current?.close();
    player.current = null;
  }, []);

  const hush = useCallback(() => {
    speakId.current += 1;
    player.current?.stop();
  }, []);

  const finish = useCallback(async () => {
    if (phaseRef.current === "ending") return;
    setPhaseBoth("ending");
    teardownLive();
    hush();
    stopListening.current();
    await endSession(sessionId); // redirects to the summary
  }, [sessionId, teardownLive, hush]);

  /** Fallback: send one learner turn, show the reply, then speak it in the character's voice. */
  const sendFallback = useCallback(
    async (text: string | null) => {
      if (text) pushTurn({ speaker: "learner", text });
      const id = ++speakId.current;
      setActivity("thinking");
      const res = await chatTurn(sessionId, text);
      if (!res.ok) {
        setActivity("idle");
        setNotice(res.error);
        if (res.closed) void finish();
        return;
      }
      if (!res.reply) return setActivity("idle");
      // Text first; the voice follows a few seconds later (server TTS), the character stays "thinking".
      pushTurn({ speaker: "character", text: res.reply });
      const { audio } = await speakLastReply(sessionId);
      if (id !== speakId.current || phaseRef.current === "ending") return;
      try {
        if (!audio) throw new Error("no audio");
        player.current ??= new PcmPlayer();
        await player.current.resume();
      } catch {
        setNotice("Suara karakter sedang tidak tersedia — baca jawabannya di transkrip.");
        return setActivity("idle");
      }
      setActivity("speaking");
      await player.current.play(audio);
      if (id === speakId.current) setActivity("idle");
    },
    [sessionId, pushTurn, finish],
  );

  const goFallback = useCallback(
    (reason: string) => {
      if (phaseRef.current === "fallback" || phaseRef.current === "ending") return;
      const wasLive = phaseRef.current === "live";
      teardownLive();
      setPhaseBoth("fallback");
      setActivity("idle");
      setPartial({ learner: "", character: "" });
      setNotice(reason);
      if (wasLive) void releaseLive(sessionId);
      if (turnCount.current === 0) void sendFallback(null);
    },
    [sessionId, teardownLive, sendFallback],
  );

  /** Live: flush the transcribed pair for this turn to the server. */
  const flushLiveTurn = useCallback(() => {
    for (const speaker of ["learner", "character"] as const) {
      const text = pending.current[speaker].trim();
      if (text) {
        pushTurn({ speaker, text });
        void logTurn(sessionId, speaker, text);
      }
    }
    pending.current = { learner: "", character: "" };
    setPartial({ learner: "", character: "" });
  }, [sessionId, pushTurn]);

  async function begin() {
    setPhaseBoth("connecting");
    const grant = await requestLiveToken(sessionId);
    if (grant.mode !== "live") {
      return goFallback(
        grant.reason === "busy"
          ? "Jalur suara langsung sedang penuh. Kami pakai mode hemat — wawancara tetap jalan."
          : grant.reason === "closed"
            ? "Sesi sudah berakhir."
            : "Suara langsung tidak tersedia. Mode hemat aktif.",
      );
    }
    try {
      player.current = new PcmPlayer();
      await player.current.resume();
    } catch {
      return goFallback("Audio perangkat tidak bisa dipakai. Mode hemat aktif.");
    }
    const failTimer = setTimeout(() => goFallback("Koneksi suara lambat. Mode hemat aktif."), 6000);
    live.current = new LiveConnection(grant.token, grant.model, {
      onReady: async () => {
        clearTimeout(failTimer);
        setPhaseBoth("live");
        setActivity("idle");
        try {
          mic.current = await startMic((pcm) => live.current?.sendAudio(bytesToBase64(pcm)));
        } catch {
          setNotice("Mikrofon tidak tersedia — ketik pertanyaanmu di bawah.");
        }
        if (turnCount.current === 0) live.current?.sendText(OPEN_CUE);
      },
      onAudio: (b64) => {
        player.current?.play(b64);
        setActivity("speaking");
      },
      onInputText: (t) => {
        pending.current.learner += t;
        setPartial((p) => ({ ...p, learner: pending.current.learner }));
        setActivity("listening");
      },
      onOutputText: (t) => {
        pending.current.character += t;
        setPartial((p) => ({ ...p, character: pending.current.character }));
      },
      onInterrupted: () => {
        player.current?.stop();
        flushLiveTurn();
      },
      onTurnComplete: () => {
        flushLiveTurn();
        setActivity("idle");
      },
      onStall: () => {
        // Live heard the learner but never closed the turn: save it and send it as text so the interview goes on.
        const text = pending.current.learner.trim();
        if (!text || !live.current?.isOpen) return;
        pending.current.learner = "";
        setPartial((p) => ({ ...p, learner: "" }));
        pushTurn({ speaker: "learner", text });
        void logTurn(sessionId, "learner", text);
        live.current.sendText(text);
        setActivity("thinking");
      },
      onClose: ({ ready }) => {
        clearTimeout(failTimer);
        if (phaseRef.current === "ending") return;
        flushLiveTurn();
        goFallback(ready ? "Koneksi suara terputus. Kami lanjutkan dengan mode hemat." : "Suara langsung tidak tersedia. Mode hemat aktif.");
      },
    });
  }

  function onMic() {
    if (phase === "live") {
      const next = !muted;
      setMuted(next);
      mic.current?.setMuted(next);
      return;
    }
    if (phase !== "fallback") return;
    if (activity === "listening") return stopListening.current();
    hush(); // barge-in
    setActivity("listening");
    const l = listenOnce(language, (t) => setPartial((p) => ({ ...p, learner: t })));
    stopListening.current = l.stop;
    void l.done.then((text) => {
      setPartial((p) => ({ ...p, learner: "" }));
      if (text) void sendFallback(text);
      else setActivity("idle");
    });
  }

  function onSubmitText(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || activity === "thinking") return;
    setDraft("");
    if (phase === "live" && live.current?.isOpen) {
      player.current?.stop();
      pushTurn({ speaker: "learner", text });
      void logTurn(sessionId, "learner", text);
      live.current.sendText(text);
    } else if (phase === "fallback") {
      hush();
      void sendFallback(text);
    }
  }

  const confirmEnd = useCallback(() => {
    if (!endDialog.current?.open) endDialog.current?.showModal();
  }, []);

  // Server-authoritative clock: auto-ends at ends_at.
  useEffect(() => {
    const t = setInterval(() => {
      const left = Date.parse(endsAt) - Date.now();
      setRemaining(left);
      if (left <= 0) void finish();
    }, 500);
    return () => clearInterval(t);
  }, [endsAt, finish]);

  // Drive the character's ring/mouth from whichever voice is speaking (no React state per frame).
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const level = player.current?.level() ?? 0;
      ringRef.current?.style.setProperty("--level", level.toFixed(3));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    // Block body: newer Chromium returns a Promise from scrollIntoView, which an effect must not return.
    transcriptEnd.current?.scrollIntoView({ block: "end" });
  }, [turns, partial]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Esc while the dialog is open closes it (native cancel), so don't reopen it here.
      if (e.key === "Escape" && !endDialog.current?.open && phaseRef.current !== "ready" && phaseRef.current !== "ending") {
        // Otherwise Chrome turns this same Esc into a close request that shuts the dialog we just opened.
        e.preventDefault();
        confirmEnd();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [confirmEnd]);

  useEffect(
    () => () => {
      teardownLive();
      hush();
      stopListening.current();
    },
    [teardownLive, hush],
  );

  const first = character.name;
  const status =
    phase === "connecting"
      ? "Menyambungkan…"
      : activity === "speaking"
        ? `${first} sedang berbicara`
        : activity === "thinking"
          ? `${first} sedang berpikir`
          : activity === "listening"
            ? `${first} mendengarkan`
            : phase === "live"
              ? `${first} menunggu pertanyaanmu — bicara saja`
              : `${first} menunggu pertanyaanmu`;
  const lowTime = remaining !== null && remaining < 60_000;
  const canTalk = phase === "live" || (phase === "fallback" && stt);

  return (
    <div className="stage stage-enter flex h-dvh flex-col overflow-hidden">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3 sm:px-8">
        <div className="min-w-0">
          <p className="font-mono text-label uppercase text-stage-ink-2">Ruang wawancara</p>
          <p className="truncate font-display text-lg">{title}</p>
        </div>
        <div className="flex items-center gap-3">
          {(phase === "live" || phase === "fallback") && (
            <span
              title={phase === "live" ? "Suara dua arah realtime" : "Pengenal suara browser + suara karakter dari server"}
              className={`rounded-full border px-3 py-1 font-mono text-label uppercase ${phase === "live" ? "border-live/60 text-live" : "border-white/20 text-stage-ink-2"}`}
            >
              {phase === "live" ? "● Live" : "Mode hemat"}
            </span>
          )}
          <span role="timer" aria-label={remaining === null ? "Sisa waktu" : `Sisa waktu ${fmt(remaining)}`} className={`font-mono text-lg tabular-nums ${lowTime ? "text-live" : ""}`}>
            {remaining === null ? "--:--" : fmt(remaining)}
          </span>
          {phase !== "ready" && (
            <button type="button" onClick={confirmEnd} disabled={phase === "ending"} className="min-h-11 rounded-sm border border-white/20 px-4 text-sm hover:border-white/60 disabled:opacity-50">
              {phase === "ending" ? "Menyimpan…" : "Akhiri"}
            </button>
          )}
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)] lg:grid-cols-[minmax(0,1fr)_26rem] lg:grid-rows-1">
        <section aria-label={`Karakter ${first}`} className="relative flex min-h-[36dvh] flex-col items-center justify-center overflow-hidden px-4 py-8 lg:min-h-0">
          <div aria-hidden className="spotlight pointer-events-none absolute inset-0" />
          <div ref={ringRef} className="speaking-ring relative" style={{ ["--level" as string]: 0 }}>
            <div className="scale-110 sm:scale-[1.6] lg:scale-[1.9]">
              <CharacterPortrait name={character.name} hue={character.hue} size="lg" />
            </div>
          </div>
          <p role="status" className="relative mt-10 text-center font-mono text-label uppercase text-stage-ink-2 sm:mt-16 lg:mt-24">
            {status}
          </p>
          {notice && (
            <p role="alert" className="relative mt-3 max-w-md text-center text-sm text-spot">
              {notice}
            </p>
          )}

          {phase === "ready" && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-5 bg-stage/80 px-6 text-center backdrop-blur-[2px]">
              <p className="max-w-sm text-stage-ink-2">
                {first} sudah menunggu. Waktu berjalan sejak sesi dibuat — mulai sekarang.
              </p>
              <button type="button" onClick={begin} autoFocus className="min-h-14 rounded-full bg-accent px-8 text-lg font-medium text-accent-ink hover:bg-stage-ink hover:text-stage">
                Mulai wawancara
              </button>
            </div>
          )}
        </section>

        <aside className="flex min-h-0 flex-col border-t border-white/10 bg-stage-2 lg:border-t-0 lg:border-l">
          <div aria-live="polite" aria-label="Transkrip" lang={language} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-5">
            {turns.length === 0 && !partial.character && !partial.learner && (
              <p className="text-sm text-stage-ink-2">Transkrip muncul di sini.</p>
            )}
            {turns.map((t, i) => (
              <p key={i} className="text-[0.95rem] leading-relaxed">
                <span className={`mr-2 font-mono text-label uppercase ${t.speaker === "character" ? "text-spot" : "text-stage-ink-2"}`}>
                  {t.speaker === "character" ? first : "Kamu"}
                </span>
                {t.text}
              </p>
            ))}
            {partial.learner && (
              <p className="text-[0.95rem] leading-relaxed text-stage-ink-2">
                <span className="mr-2 font-mono text-label uppercase">Kamu</span>
                {partial.learner}…
              </p>
            )}
            {partial.character && (
              <p className="text-[0.95rem] leading-relaxed text-stage-ink/70">
                <span className="mr-2 font-mono text-label uppercase text-spot">{first}</span>
                {partial.character}…
              </p>
            )}
            <div ref={transcriptEnd} />
          </div>

          <div className="border-t border-white/10 p-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onMic}
                disabled={!canTalk || activity === "thinking"}
                aria-pressed={phase === "live" ? !muted : activity === "listening"}
                aria-label={phase === "live" ? (muted ? "Nyalakan mikrofon" : "Bisukan mikrofon") : activity === "listening" ? "Selesai bicara" : "Tekan untuk bicara"}
                className={`grid size-14 shrink-0 place-items-center rounded-full border-2 transition-colors disabled:opacity-40 ${
                  (phase === "live" && !muted) || activity === "listening" ? "border-live bg-live text-white" : "border-white/30 hover:border-white/70"
                }`}
              >
                <svg aria-hidden viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <rect x="9" y="3" width="6" height="11" rx="3" />
                  <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
                  {phase === "live" && muted && <path d="M4 4l16 16" />}
                </svg>
              </button>
              <form onSubmit={onSubmitText} className="flex min-w-0 flex-1 items-center gap-2">
                <label htmlFor="ask" className="sr-only">
                  Ketik pertanyaan
                </label>
                <input
                  id="ask"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  disabled={phase !== "live" && phase !== "fallback"}
                  maxLength={2000}
                  placeholder="Ketik pertanyaan…"
                  autoComplete="off"
                  className="min-h-12 min-w-0 flex-1 rounded-sm border border-white/15 bg-stage px-3 text-stage-ink outline-none placeholder:text-stage-ink-2 focus:border-white/50"
                />
                <button type="submit" disabled={!draft.trim() || activity === "thinking"} className="min-h-12 rounded-sm bg-stage-ink px-4 text-sm font-medium text-stage disabled:opacity-40">
                  Kirim
                </button>
              </form>
            </div>
            <p className="mt-2 text-xs text-stage-ink-2">
              {phase === "live"
                ? "Bicara langsung — kamu boleh memotong. Tombol mikrofon untuk membisukan."
                : stt
                  ? "Tekan mikrofon, bicara, lalu tunggu jawaban. Esc untuk mengakhiri."
                  : "Browser ini tidak mendukung pengenal suara — ketik pertanyaanmu (Chrome/Edge disarankan)."}
            </p>
          </div>
        </aside>
      </div>

      <dialog
        ref={endDialog}
        aria-labelledby="end-title"
        aria-describedby="end-desc"
        onClick={(e) => e.target === e.currentTarget && endDialog.current?.close()}
        className="m-auto w-[min(26rem,calc(100vw-2rem))] rounded-md border border-white/15 bg-stage-2 p-0 text-stage-ink shadow-float backdrop:bg-black/60"
      >
        <div className="p-6">
          <p className="font-mono text-label uppercase text-stage-ink-2">Akhiri wawancara</p>
          <h2 id="end-title" className="mt-2 font-display text-2xl">
            Sudahi wawancara dengan {first}?
          </h2>
          <p id="end-desc" className="mt-3 text-sm leading-relaxed text-stage-ink-2">
            Percakapanmu disimpan lalu langsung dinilai. Sesi ini tidak bisa dilanjutkan lagi.
          </p>
          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button type="button" autoFocus onClick={() => endDialog.current?.close()} className="min-h-11 rounded-sm border border-white/20 px-4 text-sm hover:border-white/60">
              Lanjutkan wawancara
            </button>
            <button
              type="button"
              onClick={() => {
                endDialog.current?.close();
                void finish();
              }}
              className="min-h-11 rounded-sm bg-accent px-4 text-sm font-medium text-accent-ink hover:bg-stage-ink hover:text-stage"
            >
              Akhiri sekarang
            </button>
          </div>
        </div>
      </dialog>
    </div>
  );
}

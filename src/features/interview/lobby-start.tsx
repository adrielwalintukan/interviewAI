"use client";

import { useActionState, useRef, useState } from "react";
import { Notice, SubmitButton } from "@/components/ui/form";
import { giveMicConsent, startSession } from "./actions";

/** Consent (once per account) + optional mic check + start. Spends an attempt on submit. */
export function LobbyStart({
  kind,
  assignmentId,
  versionId,
  needsConsent,
  disabledReason,
}: {
  kind: "assignment" | "library" | "preview";
  assignmentId?: string;
  versionId?: string;
  needsConsent: boolean;
  disabledReason?: string;
}) {
  const [state, action] = useActionState(async (prev: Parameters<typeof startSession>[0], form: FormData) => {
    if (needsConsent) await giveMicConsent();
    return startSession(prev, form);
  }, undefined);
  const [consent, setConsent] = useState(!needsConsent);
  const [level, setLevel] = useState<number | null>(null);
  const [micError, setMicError] = useState<string>();
  const stopRef = useRef<() => void>(() => {});

  async function checkMic() {
    setMicError(undefined);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const ctx = new AudioContext();
      const analyser = ctx.createAnalyser();
      ctx.createMediaStreamSource(stream).connect(analyser);
      const buf = new Float32Array(analyser.fftSize);
      let raf = 0;
      const tick = () => {
        analyser.getFloatTimeDomainData(buf);
        setLevel(Math.min(1, Math.sqrt(buf.reduce((s, v) => s + v * v, 0) / buf.length) * 5));
        raf = requestAnimationFrame(tick);
      };
      tick();
      stopRef.current = () => {
        cancelAnimationFrame(raf);
        stream.getTracks().forEach((t) => t.stop());
        void ctx.close().catch(() => {}); // already closed: nothing to release
      };
      setTimeout(() => stopRef.current(), 8000);
    } catch {
      setMicError("Mikrofon tidak bisa diakses. Kamu tetap bisa wawancara dengan mengetik.");
    }
  }

  if (disabledReason) return <Notice tone="info">{disabledReason}</Notice>;

  return (
    <form action={action} onSubmit={() => stopRef.current()} className="flex flex-col gap-5">
      <input type="hidden" name="kind" value={kind} />
      {assignmentId && <input type="hidden" name="assignmentId" value={assignmentId} />}
      {versionId && <input type="hidden" name="versionId" value={versionId} />}

      {needsConsent && (
        <label className="flex items-start gap-3 rounded-md border border-rule p-4 text-sm leading-relaxed">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1 size-4 shrink-0 accent-[var(--color-accent)]" />
          <span>
            Saya mengerti suara saya diproses oleh layanan AI pihak ketiga (Google) untuk percakapan dan <strong>tidak disimpan</strong>.
            Yang disimpan hanya transkrip teks untuk penilaian.
          </span>
        </label>
      )}

      <div className="flex flex-wrap items-center gap-4">
        <button type="button" onClick={checkMic} className="min-h-11 rounded-sm border border-rule px-4 text-sm hover:border-ink">
          Cek mikrofon
        </button>
        {level !== null && (
          <span className="flex items-center gap-2 text-sm text-ink-2" aria-live="polite">
            <span className="h-2 w-32 overflow-hidden rounded-full bg-paper-2">
              <span className="block h-full bg-moss transition-[width] duration-75" style={{ width: `${Math.round(level * 100)}%` }} />
            </span>
            {level > 0.08 ? "Suara terdengar" : "Coba bicara…"}
          </span>
        )}
      </div>
      {micError && <Notice tone="info">{micError}</Notice>}
      {state?.error && <Notice>{state.error}</Notice>}

      <SubmitButton variant="accent" pending="Membuka ruang…" disabled={!consent} className="self-start text-lg">
        Masuk ruang wawancara
      </SubmitButton>
      {kind === "assignment" && <p className="text-sm text-ink-2">Satu percobaan terpakai saat kamu masuk ruang.</p>}
    </form>
  );
}

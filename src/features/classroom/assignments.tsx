"use client";

import { useActionState, useSyncExternalStore } from "react";
import { Field, Notice, SubmitButton } from "@/components/ui/form";
import { createAssignment } from "./actions";
import { formatDue } from "./due-date";

const noSubscribe = () => () => {};
/** Browser-only value; `server` is what SSR and the hydration pass render. */
const useClientValue = <T,>(read: () => T, server: T) => useSyncExternalStore(noSubscribe, read, () => server);

/** Formats in the viewer's own zone (the server only knows UTC). */
export function LocalTime({ iso }: { iso: string }) {
  const label = useClientValue(() => formatDue(iso), null);
  return <time dateTime={iso}>{label ?? "…"}</time>;
}

export function DueLabel({ iso }: { iso: string | null }) {
  return iso ? <LocalTime iso={iso} /> : <span>Tanpa tenggat</span>;
}

export function DueState({ iso }: { iso: string | null }) {
  const past = useClientValue(() => Boolean(iso && Date.parse(iso) < Date.now()), false);
  return past ? <span className="text-accent">Tenggat lewat</span> : null;
}

export type VersionOption = { id: string; label: string };

export function AssignmentForm({ classId, own, library }: { classId: string; own: VersionOption[]; library: VersionOption[] }) {
  const [state, action] = useActionState(createAssignment, undefined);
  const tz = useClientValue(() => new Date().getTimezoneOffset(), 0);
  const fe = state?.fieldErrors;

  if (own.length + library.length === 0) {
    return (
      <p className="text-ink-2">
        Belum ada skenario terbit. Terbitkan skenario dulu di menu <span className="text-ink">Skenario</span>, atau pakai dari Pustaka.
      </p>
    );
  }

  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="classId" value={classId} />
      <input type="hidden" name="tzOffsetMin" value={tz} />
      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <label htmlFor="versionId" className="font-mono text-label uppercase text-ink-2">
          Skenario
        </label>
        <select id="versionId" name="versionId" required defaultValue="" className="min-h-11 rounded-sm border border-rule bg-paper px-3 text-base outline-none focus:border-ink">
          <option value="" disabled>
            Pilih skenario terbit…
          </option>
          {own.length > 0 && (
            <optgroup label="Skenario saya">
              {own.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </optgroup>
          )}
          {library.length > 0 && (
            <optgroup label="Pustaka">
              {library.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </optgroup>
          )}
        </select>
        {fe?.versionId && <p className="text-sm text-accent">{fe.versionId}</p>}
      </div>
      <div className="sm:col-span-2">
        <Field label="Tenggat (opsional)" name="dueLocal" type="datetime-local" error={fe?.dueLocal} hint="Zona waktu mengikuti perangkat Anda." />
      </div>
      <Field label="Durasi (menit)" name="durationMin" type="number" min={5} max={60} defaultValue={15} required error={fe?.durationMin} />
      <Field label="Batas percobaan" name="maxAttempts" type="number" min={1} max={10} defaultValue={3} required error={fe?.maxAttempts} />
      <div className="flex flex-col gap-3 sm:col-span-2">
        {state?.error && <Notice>{state.error}</Notice>}
        {state?.ok && <Notice tone="ok">{state.ok}</Notice>}
        <SubmitButton variant="accent" pending="Memberikan…" className="self-start">
          Beri tugas
        </SubmitButton>
      </div>
    </form>
  );
}

"use client";

import { useActionState, useId, useRef, useState } from "react";
import { SubmitButton } from "@/components/ui/form";
import { buttonClass } from "@/components/ui/button-class";
import { deleteStudent } from "./actions";

/** US-A-02: retype the learner's name, then delete permanently. The server re-checks everything. */
export function DeleteStudentButton({ userId, name }: { userId: string; name: string }) {
  const [state, action] = useActionState(deleteStudent, undefined);
  const [typed, setTyped] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const id = useId();

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setTyped("");
          dialog.current?.showModal();
        }}
        // relative keeps the sr-only text inside the scrolling table, or it widens the whole page at 360 px.
        className="relative min-h-11 rounded-sm px-2 text-sm text-accent underline-offset-4 hover:underline"
      >
        Hapus data
        <span className="sr-only"> {name}</span>
      </button>
      <dialog
        ref={dialog}
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-desc`}
        onClick={(e) => e.target === dialog.current && dialog.current.close()}
        className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-md border border-rule bg-paper p-0 text-ink shadow-float backdrop:bg-ink/50"
      >
        <form action={action} className="flex flex-col gap-4 p-6">
          <input type="hidden" name="userId" value={userId} />
          <p className="font-mono text-label uppercase text-accent">Hapus permanen</p>
          <h2 id={`${id}-title`} className="font-display text-2xl leading-tight">
            Hapus semua data {name}?
          </h2>
          <p id={`${id}-desc`} className="text-sm text-ink-2">
            Akun, keanggotaan kelas, semua sesi, transkrip, dan nilainya dihapus permanen dan tidak bisa dikembalikan. Ia tidak bisa masuk lagi.
          </p>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${id}-confirm`} className="text-sm">
              Ketik <span className="font-medium">{name}</span> untuk melanjutkan
            </label>
            <input
              id={`${id}-confirm`}
              name="confirm"
              autoComplete="off"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              aria-invalid={state?.error ? true : undefined}
              aria-describedby={state?.error ? `${id}-err` : undefined}
              className="min-h-11 rounded-sm border border-rule bg-paper px-3 text-base text-ink transition-colors focus:border-ink focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2 aria-invalid:border-accent"
            />
            {state?.error && (
              <p id={`${id}-err`} role="alert" className="text-sm text-accent">
                {state.error}
              </p>
            )}
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => dialog.current?.close()} className={buttonClass("ghost")}>
              Batal
            </button>
            <SubmitButton variant="accent" pending="Menghapus…" disabled={typed.trim() !== name.trim()}>
              Hapus permanen
            </SubmitButton>
          </div>
        </form>
      </dialog>
    </>
  );
}

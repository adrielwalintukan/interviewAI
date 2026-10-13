"use client";

import { useActionState, useState } from "react";
import { resetPassword } from "./reset-password";

/** Confirm → reset → show the new one-time password once, with copy. */
export function ResetPasswordButton({ userId, name }: { userId: string; name: string }) {
  const [state, action, pending] = useActionState(resetPassword, undefined);
  const [copied, setCopied] = useState(false);

  if (state?.password) {
    return (
      <span className="flex flex-wrap items-center gap-2" role="status">
        <span className="text-ink-2">Password baru:</span>
        <code className="rounded-sm bg-highlight/60 px-2 py-1 font-mono text-ink">{state.password}</code>
        <button
          type="button"
          onClick={async () => {
            await navigator.clipboard.writeText(state.password!);
            setCopied(true);
          }}
          className="min-h-11 px-2 text-sm text-ink-2 hover:text-ink"
        >
          {copied ? "Tersalin ✓" : "Salin"}
        </button>
      </span>
    );
  }

  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm(`Reset password ${name}? Password lama tidak berlaku lagi dan ia wajib menggantinya saat masuk.`)) e.preventDefault();
      }}
      className="flex items-center gap-2"
    >
      <input type="hidden" name="userId" value={userId} />
      <button type="submit" disabled={pending} className="min-h-11 rounded-sm px-2 text-sm text-ink-2 underline-offset-4 hover:text-ink hover:underline disabled:opacity-60">
        {pending ? "Mereset…" : "Reset password"}
        <span className="sr-only"> {name}</span>
      </button>
      {state?.error && (
        <span role="alert" className="text-sm text-accent">
          {state.error}
        </span>
      )}
    </form>
  );
}

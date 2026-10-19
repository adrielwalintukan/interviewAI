"use client";

import { useFormStatus } from "react-dom";
import type { ComponentProps, ReactNode } from "react";
import { buttonClass, type ButtonVariant } from "./button-class";

/** Submit button that disables itself and shows `pending` text while its form's action runs. */
export function SubmitButton({
  children,
  pending: pendingText,
  variant = "primary",
  className = "",
  disabled,
  ...rest
}: ComponentProps<"button"> & { pending?: string; variant?: ButtonVariant }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending || disabled} aria-busy={pending} className={buttonClass(variant, className)} {...rest}>
      {pending ? (pendingText ?? "Memproses…") : children}
    </button>
  );
}

export function Field({
  label,
  name,
  error,
  hint,
  ...input
}: ComponentProps<"input"> & { label: string; name: string; error?: string; hint?: ReactNode }) {
  const id = `f-${name}`;
  const describedBy = [error && `${id}-err`, hint && `${id}-hint`].filter(Boolean).join(" ") || undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="font-mono text-label uppercase text-ink-2">
        {label}
      </label>
      <input
        id={id}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className="min-h-11 rounded-sm border border-rule bg-paper px-3 text-base text-ink outline-none transition-colors placeholder:text-ink-2/60 focus:border-ink aria-invalid:border-accent"
        {...input}
      />
      {hint && (
        <p id={`${id}-hint`} className="text-sm text-ink-2">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-err`} className="text-sm text-accent">
          {error}
        </p>
      )}
    </div>
  );
}

export function Notice({ tone = "error", children }: { tone?: "error" | "ok" | "info"; children: ReactNode }) {
  const tones = {
    error: "border-accent text-accent",
    ok: "border-moss text-moss",
    info: "border-ochre text-ink",
  };
  return (
    <p role={tone === "error" ? "alert" : "status"} className={`border-l-2 py-1 pl-3 text-sm ${tones[tone]}`}>
      {children}
    </p>
  );
}

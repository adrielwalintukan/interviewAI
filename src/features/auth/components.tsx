"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { buttonClass } from "@/components/ui/button-class";
import { Field, Notice, SubmitButton } from "@/components/ui/form";
import { changePassword, signIn, signInWithGoogle, signUp } from "./actions";

const googleEnabled = process.env.NEXT_PUBLIC_AUTH_GOOGLE_ENABLED === "true";

function GoogleButton({ next }: { next?: string }) {
  if (!googleEnabled) return null;
  return (
    <form action={signInWithGoogle} className="mt-6">
      <input type="hidden" name="next" value={next ?? ""} />
      <button type="submit" className={buttonClass("ghost", "w-full")}>
        Lanjut dengan Google
      </button>
      <p className="mt-6 flex items-center gap-3 font-mono text-label uppercase text-ink-2 before:h-px before:flex-1 before:bg-rule after:h-px after:flex-1 after:bg-rule">
        atau
      </p>
    </form>
  );
}

export function SignInForm({ next, error }: { next?: string; error?: string }) {
  const [state, action] = useActionState(signIn, undefined);
  return (
    <>
      <GoogleButton next={next} />
      <form action={action} className="mt-6 flex flex-col gap-5">
        <input type="hidden" name="next" value={next ?? ""} />
        <Field label="Email atau username" name="identifier" autoComplete="username" required autoFocus defaultValue={state?.values?.identifier} />
        <Field label="Password" name="password" type="password" autoComplete="current-password" required />
        {error === "google" && <Notice>Masuk dengan Google gagal. Coba lagi.</Notice>}
        {state?.error && <Notice>{state.error}</Notice>}
        <SubmitButton pending="Masuk…">Masuk</SubmitButton>
      </form>
      <p className="mt-6 text-sm text-ink-2">
        Belum punya akun?{" "}
        <Link href="/daftar" className="text-ink underline decoration-accent underline-offset-4">
          Daftar
        </Link>
        . Akun dari pengajar? Masuk pakai username.
      </p>
      <p className="mt-4 text-xs text-ink-2">
        Dengan masuk, kamu menyetujui{" "}
        <Link href="/privasi" className="underline underline-offset-4 hover:text-ink">
          Kebijakan Privasi
        </Link>{" "}
        kami.
      </p>
    </>
  );
}

export function SignUpForm() {
  const [state, action] = useActionState(signUp, undefined);
  const [role, setRole] = useState<"pelajar" | "pengajar">("pelajar");
  const fe = state?.fieldErrors;
  return (
    <>
      <GoogleButton />
      <form action={action} className="mt-6 flex flex-col gap-5">
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1.5 font-mono text-label uppercase text-ink-2">Saya seorang</legend>
          <div className="grid grid-cols-2 gap-2">
            {(["pelajar", "pengajar"] as const).map((r) => (
              <label
                key={r}
                className="flex min-h-11 cursor-pointer items-center justify-center rounded-sm border border-rule px-3 text-sm capitalize transition-colors has-checked:border-ink has-checked:bg-ink has-checked:text-paper has-focus-visible:outline-2 has-focus-visible:outline-accent"
              >
                <input type="radio" name="role" value={r} checked={role === r} onChange={() => setRole(r)} className="sr-only" />
                {r}
              </label>
            ))}
          </div>
          {role === "pengajar" && (
            <p className="text-sm text-ink-2">Akun pengajar aktif setelah disetujui Admin institusi.</p>
          )}
        </fieldset>
        <Field label="Nama lengkap" name="displayName" autoComplete="name" required maxLength={80} error={fe?.displayName} defaultValue={state?.values?.displayName} />
        <Field label="Email" name="email" type="email" autoComplete="email" required error={fe?.email} defaultValue={state?.values?.email} />
        <Field
          label="Password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          hint="Minimal 8 karakter."
          error={fe?.password}
        />
        {state?.error && <Notice>{state.error}</Notice>}
        {state?.ok && <Notice tone="ok">{state.ok}</Notice>}
        <SubmitButton pending="Mendaftar…">Buat akun</SubmitButton>
      </form>
      <p className="mt-6 text-sm text-ink-2">
        Sudah punya akun?{" "}
        <Link href="/masuk" className="text-ink underline decoration-accent underline-offset-4">
          Masuk
        </Link>
      </p>
      <p className="mt-4 text-xs text-ink-2">
        Dengan mendaftar, kamu menyetujui{" "}
        <Link href="/privasi" className="underline underline-offset-4 hover:text-ink">
          Kebijakan Privasi
        </Link>{" "}
        kami.
      </p>
    </>
  );
}

export function ChangePasswordForm() {
  const [state, action] = useActionState(changePassword, undefined);
  const fe = state?.fieldErrors;
  useEffect(() => {
    if (state?.ok) window.location.replace("/dashboard");
  }, [state?.ok]);
  return (
    <form action={action} className="mt-6 flex flex-col gap-5">
      <Field
        label="Password baru"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        minLength={8}
        hint="Minimal 8 karakter."
        error={fe?.password}
      />
      <Field label="Ulangi password" name="confirm" type="password" autoComplete="new-password" required error={fe?.confirm} />
      {state?.error && <Notice>{state.error}</Notice>}
      {state?.ok && <Notice tone="ok">{state.ok} Membuka dashboard…</Notice>}
      <SubmitButton pending="Menyimpan…">Simpan password</SubmitButton>
    </form>
  );
}

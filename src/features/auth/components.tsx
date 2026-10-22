"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { buttonClass } from "@/components/ui/button-class";
import { Field, Notice, SubmitButton } from "@/components/ui/form";
import { changePassword, signIn, signInWithGoogle, signUp } from "./actions";

const googleEnabled = process.env.NEXT_PUBLIC_AUTH_GOOGLE_ENABLED === "true";

type Role = "pelajar" | "pengajar";

function GoogleButton({ next, role }: { next?: string; role?: Role }) {
  if (!googleEnabled) return null;
  return (
    <form action={signInWithGoogle} className="mt-6">
      <input type="hidden" name="next" value={next ?? ""} />
      {role && <input type="hidden" name="role" value={role} />}
      <button type="submit" className={buttonClass("ghost", "w-full gap-3")}>
        {/* Google's standard "G" mark, unaltered colors (Google sign-in branding guidelines). */}
        <svg aria-hidden viewBox="0 0 48 48" className="size-5 shrink-0">
          <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
          <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
          <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
          <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
        </svg>
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
        {error === "peran-ditolak" && (
          <Notice>Akun Google ini sudah terdaftar sebagai pelajar. Masuk lagi untuk memakainya, atau hubungi admin institusi bila Anda pengajar.</Notice>
        )}
        {error === "peran-gagal" && (
          <Notice>Pendaftaran sebagai pengajar gagal. Ulangi lewat Daftar → Pengajar, atau hubungi admin institusi.</Notice>
        )}
        {error === "konfirmasi" && (
          <Notice>Link konfirmasi tidak berlaku lagi. Coba masuk; bila belum bisa, daftar ulang dengan email yang sama untuk mendapat link baru.</Notice>
        )}
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
  const [role, setRole] = useState<Role>("pelajar");
  const fe = state?.fieldErrors;
  return (
    <>
      {/* The role comes first: it applies to Google and to the email form (workflow §1). */}
      <fieldset className="mt-6 flex flex-col gap-2">
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
      <GoogleButton role={role} />
      <form action={action} className="mt-6 flex flex-col gap-5">
        <input type="hidden" name="role" value={role} />
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

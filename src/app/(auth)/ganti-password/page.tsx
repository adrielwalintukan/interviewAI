import { Suspense } from "react";
import { ChangePasswordForm } from "@/features/auth/components";
import { requireUser } from "@/features/auth/dal";

export const metadata = { title: "Ganti password — Interview AI" };

async function Intro() {
  const user = await requireUser({ allowPending: true, allowPasswordChange: true });
  return (
    <p className="mt-4 text-ink-2">
      {user.mustChangePassword
        ? `Halo ${user.displayName}. Password awal dari pengajar hanya untuk sekali pakai. Buat password baru milikmu sendiri.`
        : "Buat password baru untuk akunmu."}
    </p>
  );
}

export default function GantiPasswordPage() {
  return (
    <>
      <h1 className="font-display text-display font-medium tracking-tight">Ganti password</h1>
      <Suspense fallback={<p className="mt-4 h-12 animate-pulse rounded-sm bg-paper-2" />}>
        <Intro />
      </Suspense>
      <ChangePasswordForm />
    </>
  );
}

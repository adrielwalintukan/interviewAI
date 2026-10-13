import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { getCurrentUser } from "@/features/auth/dal";
import { signOut } from "@/features/auth/actions";

const ROLE_LABEL = { admin: "Admin", pengajar: "Pengajar", pelajar: "Pelajar" } as const;

async function UserMenu() {
  const user = await getCurrentUser();
  if (!user) return null;
  return (
    <div className="flex items-center gap-4">
      {user.role === "admin" && (
        <Link href="/admin" className="font-mono text-label uppercase text-ink-2 hover:text-ink">
          Admin
        </Link>
      )}
      <span className="hidden text-right sm:block">
        <span className="block text-sm font-medium leading-tight">{user.displayName}</span>
        <span className="block font-mono text-label uppercase text-ink-2">{ROLE_LABEL[user.role]}</span>
      </span>
      <form action={signOut}>
        <button type="submit" className="min-h-11 rounded-sm px-2 text-sm text-ink-2 underline-offset-4 hover:text-ink hover:underline">
          Keluar
        </button>
      </form>
    </div>
  );
}

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grain min-h-dvh">
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-4 border-b border-rule px-4 py-3 sm:px-8">
        <Link href="/dashboard" className="font-display text-xl font-semibold tracking-tight">
          Interview AI
        </Link>
        <Suspense fallback={<span className="h-8 w-28 animate-pulse rounded-sm bg-paper-2" />}>
          <UserMenu />
        </Suspense>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-8 sm:py-12">{children}</main>
    </div>
  );
}

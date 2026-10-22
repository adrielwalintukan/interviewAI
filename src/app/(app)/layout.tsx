import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { AppNav, type NavItem } from "@/components/app-nav";
import { getCurrentUser } from "@/features/auth/dal";
import { signOut } from "@/features/auth/actions";

const ROLE_LABEL = { admin: "Admin", pengajar: "Pengajar", pelajar: "Pelajar" } as const;

const NAV: Record<keyof typeof ROLE_LABEL, NavItem[]> = {
  pengajar: [
    { href: "/dashboard", label: "Kelas", match: ["/dashboard", "/kelas"] },
    { href: "/skenario", label: "Skenario", match: ["/skenario"] },
    { href: "/pustaka", label: "Pustaka", match: ["/pustaka"] },
  ],
  pelajar: [
    { href: "/dashboard", label: "Kelas", match: ["/dashboard", "/kelas"] },
    { href: "/pustaka", label: "Pustaka", match: ["/pustaka"] },
  ],
  admin: [
    { href: "/admin", label: "Kelola akun", match: ["/admin"] },
    { href: "/karakter", label: "Karakter", match: ["/karakter"] },
    { href: "/pustaka", label: "Pustaka", match: ["/pustaka"] },
  ],
};

async function UserMenu() {
  const user = await getCurrentUser();
  if (!user) return null;
  const nav = user.status === "active" ? NAV[user.role] : [];
  return (
    <>
      <div className="order-last w-full sm:order-none sm:w-auto sm:flex-1 sm:pl-6">{nav.length > 0 && <AppNav items={nav} />}</div>
      <div className="flex items-center gap-3">
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
    </>
  );
}

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grain min-h-dvh">
      <header className="mx-auto flex print:hidden max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-rule px-4 py-2 sm:px-8">
        <Link href="/dashboard" className="inline-flex min-h-11 items-center font-display text-xl font-semibold tracking-tight">
          Interview AI
        </Link>
        <Suspense fallback={<span className="h-8 w-28 animate-pulse rounded-sm bg-paper-2" />}>
          <UserMenu />
        </Suspense>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-8 sm:py-12">{children}</main>
      <footer className="mx-auto flex print:hidden max-w-6xl items-center justify-between border-t border-rule px-4 py-4 text-xs text-ink-2 sm:px-8">
        <span>Interview AI</span>
        <Link href="/privasi" className="inline-flex min-h-11 items-center px-2 underline-offset-4 hover:text-ink hover:underline">
          Kebijakan Privasi
        </Link>
      </footer>
    </div>
  );
}

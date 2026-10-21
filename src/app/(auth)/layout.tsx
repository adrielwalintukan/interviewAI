import Link from "next/link";
import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grain grid min-h-dvh md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <aside className="flex flex-col justify-between border-b border-rule bg-paper-2 px-4 py-6 sm:px-8 md:border-r md:border-b-0 md:py-10">
        <Link href="/" className="inline-flex min-h-11 items-center font-display text-xl font-semibold tracking-tight">
          Interview AI
        </Link>
        <div className="mt-10 hidden max-w-sm md:block">
          <p className="font-display text-display font-medium leading-none tracking-tight">Latihan wawancara dengan klien virtual.</p>
          <p className="mt-4 text-ink-2">Klien hanya menceritakan kebutuhannya kalau kamu bertanya dengan tepat.</p>
        </div>
      </aside>
      <main className="flex items-start justify-center px-4 py-10 sm:px-8 md:items-center">
        <div className="w-full max-w-sm">{children}</div>
      </main>
    </div>
  );
}

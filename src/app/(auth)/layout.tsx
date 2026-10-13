import Link from "next/link";
import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grain grid min-h-dvh md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <aside className="flex flex-col justify-between border-b border-rule bg-paper-2 px-4 py-6 sm:px-8 md:border-r md:border-b-0 md:py-10">
        <Link href="/" className="font-display text-xl font-semibold tracking-tight">
          Interview AI
        </Link>
        <blockquote className="mt-10 hidden max-w-sm md:block">
          <p className="font-display text-display font-medium leading-none tracking-tight">
            “Kalau Bapak tanya soal kurir, saya baru cerita.”
          </p>
          <footer className="mt-4 font-mono text-label uppercase text-ink-2">— Bu Ratna, pemilik laundry</footer>
        </blockquote>
        <p className="mt-6 hidden font-mono text-label uppercase text-ink-2 md:block">Ruang latihan elisitasi</p>
      </aside>
      <main className="flex items-start justify-center px-4 py-10 sm:px-8 md:items-center">
        <div className="w-full max-w-sm">{children}</div>
      </main>
    </div>
  );
}

import Link from "next/link";
import { buttonClass } from "@/components/ui/button-class";

// Placeholder landing (tokens + editorial direction). Real landing lands in M5.
export default function Home() {
  return (
    <main className="grain mx-auto flex min-h-dvh max-w-6xl flex-col px-4 py-6 sm:px-8 sm:py-10">
      <header className="flex items-baseline justify-between border-b border-rule pb-4">
        <span className="font-display text-xl font-semibold tracking-tight">Interview AI</span>
        <nav className="flex items-center gap-2">
          <Link href="/masuk" className="inline-flex min-h-11 items-center px-3 text-sm text-ink-2 hover:text-ink">
            Masuk
          </Link>
          <Link href="/daftar" className={buttonClass("primary", "text-sm")}>
            Daftar
          </Link>
        </nav>
      </header>

      <section className="grid flex-1 content-center gap-10 py-12 md:grid-cols-12 md:py-6">
        <div className="md:col-span-8">
          <p className="mb-6 font-mono text-label uppercase text-accent">Latihan wawancara kebutuhan</p>
          {/* display-xl, also capped by viewport height so the landing fits one screen without scrolling */}
          <h1 className="font-display text-[clamp(2.75rem,min(1.5rem+6vw,9dvh),6rem)] leading-[0.95] text-balance hyphens-auto break-words font-medium tracking-tight [font-variation-settings:'SOFT'_50]">
            Klien tidak pernah menyebut <span className="stabilo">semua</span> kebutuhannya.
          </h1>
          <p className="mt-8 max-w-xl text-lg leading-relaxed text-ink-2">
            Wawancarai klien virtual yang menyimpan kebutuhan tersembunyi. Kebutuhan itu baru diceritakan kalau
            pertanyaanmu tepat. Setelah selesai, kamu mendapat nilai dan daftar hal yang terlewat.
          </p>
          <Link href="/daftar" className={buttonClass("accent", "mt-8")}>
            Mulai berlatih
          </Link>
        </div>

        <aside className="self-end border-l border-rule pl-6 md:col-span-4">
          <p className="font-mono text-label uppercase text-ink-2">Contoh skenario</p>
          <p className="mt-4 text-sm leading-relaxed">Bu Ratna punya usaha laundry kiloan dan ingin aplikasi antar-jemput.</p>
          <p className="mt-3 text-sm leading-relaxed text-ink-2">
            Ia tidak akan menyebut bahwa kurirnya hanya dua orang, kecuali kamu menanyakannya.
          </p>
        </aside>
      </section>

      <footer className="flex items-center justify-end border-t border-rule pt-4 font-mono text-label uppercase text-ink-2">
        <Link href="/privasi" className="inline-flex min-h-11 items-center px-2 underline-offset-4 hover:text-ink hover:underline">
          Kebijakan Privasi
        </Link>
      </footer>
    </main>
  );
}

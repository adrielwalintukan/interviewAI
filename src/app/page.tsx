import Link from "next/link";
import { buttonClass } from "@/components/ui/button-class";

// Placeholder landing (tokens + editorial direction). Real landing lands in M5.
export default function Home() {
  return (
    <main className="grain mx-auto flex min-h-dvh max-w-6xl flex-col px-4 py-6 sm:px-8 sm:py-10">
      <header className="flex items-baseline justify-between border-b border-rule pb-4">
        <span className="font-display text-xl font-semibold tracking-tight">Interview AI</span>
        <nav className="flex items-center gap-2">
          <Link href="/masuk" className="min-h-11 px-3 py-2.5 text-sm text-ink-2 hover:text-ink">
            Masuk
          </Link>
          <Link href="/daftar" className={buttonClass("primary", "text-sm")}>
            Daftar
          </Link>
        </nav>
      </header>

      <section className="grid flex-1 gap-10 py-16 md:grid-cols-12 md:py-24">
        <div className="md:col-span-8">
          <p className="mb-6 font-mono text-label uppercase text-accent">01 — Ruang latihan</p>
          <h1 className="font-display text-display-xl text-balance hyphens-auto break-words font-medium tracking-tight [font-variation-settings:'SOFT'_50]">
            Klien tidak pernah menyebut <span className="stabilo">semua</span> kebutuhannya.
          </h1>
          <p className="mt-8 max-w-xl text-lg leading-relaxed text-ink-2">
            Wawancarai karakter yang menyimpan fakta tersembunyi. Makin tajam pertanyaanmu, makin banyak yang
            terungkap — dan pengajarmu bisa melihat di mana kamu berhenti menggali.
          </p>
          <Link href="/daftar" className={buttonClass("accent", "mt-8")}>
            Mulai berlatih
          </Link>
        </div>

        <aside className="self-end border-l border-rule pl-6 md:col-span-4">
          <p className="font-mono text-label uppercase text-ink-2">Catatan pinggir</p>
          <ol className="mt-4 space-y-3 text-sm leading-relaxed">
            <li>
              <span className="font-mono text-accent">a.</span> Bu Ratna, pemilik laundry, menunggu di ruang meeting.
            </li>
            <li>
              <span className="font-mono text-accent">b.</span> Ia sibuk dan agak skeptis soal aplikasi.
            </li>
            <li>
              <span className="font-mono text-accent">c.</span> Kurirnya hanya dua. Itu tidak akan ia ceritakan duluan.
            </li>
          </ol>
        </aside>
      </section>

      <footer className="border-t border-rule pt-4 font-mono text-label uppercase text-ink-2">
        Sedang dibangun · M1
      </footer>
    </main>
  );
}

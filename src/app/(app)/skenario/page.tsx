import Link from "next/link";
import { Suspense } from "react";
import { SubmitButton } from "@/components/ui/form";
import { requireUser } from "@/features/auth/dal";
import { createScenario } from "@/features/scenario/actions";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Skenario — Interview AI" };

type Row = {
  id: string;
  title: string;
  is_public: boolean;
  updated_at: string;
  current: { version: number; client_name: string } | null;
};

async function ScenarioList() {
  await requireUser({ roles: ["pengajar"] });
  const supabase = await createClient();
  const { data } = await supabase
    .from("scenarios")
    .select("id, title, is_public, updated_at, current:scenario_versions!scenarios_current_version_fk(version, client_name)")
    .order("updated_at", { ascending: false })
    .returns<Row[]>();
  const rows = data ?? [];

  if (rows.length === 0) {
    return (
      <p className="border-l-2 border-rule pl-4 text-ink-2">
        Belum ada skenario. Tulis ringkasan singkat, dan AI akan menyiapkan persona, fakta tersembunyi, serta rubriknya.
      </p>
    );
  }

  return (
    <ol className="divide-y divide-rule border-y border-rule">
      {rows.map((s, i) => (
        <li key={s.id}>
          <Link href={`/skenario/${s.id}`} className="group grid grid-cols-[2.5rem_1fr] gap-x-3 gap-y-1 py-4 hover:bg-paper-2/60 sm:grid-cols-[2.5rem_1fr_auto]">
            <span className="font-mono text-label text-ink-2">{String(i + 1).padStart(2, "0")}</span>
            <span className="font-display text-xl group-hover:text-accent">{s.title}</span>
            <span className="col-start-2 flex flex-wrap gap-x-3 font-mono text-label uppercase text-ink-2 sm:col-start-3 sm:justify-end">
              {s.current ? <span className="text-moss">Terbit v{s.current.version}</span> : <span className="text-ochre">Draf</span>}
              {s.is_public && <span>Publik</span>}
            </span>
          </Link>
        </li>
      ))}
    </ol>
  );
}

export default function SkenarioPage() {
  return (
    <div className="grid gap-10 lg:grid-cols-12">
      <section className="lg:col-span-8">
        <p className="font-mono text-label uppercase text-accent">Skenario Anda</p>
        <h1 className="mt-3 font-display text-display font-medium tracking-tight">Klien yang menunggu diwawancarai.</h1>
        <div className="mt-8">
          <Suspense fallback={<div className="h-40 animate-pulse rounded-md bg-paper-2" />}>
            <ScenarioList />
          </Suspense>
        </div>
      </section>
      <aside className="lg:col-span-4 lg:border-l lg:border-rule lg:pl-8">
        <p className="font-mono text-label uppercase text-ink-2">Mulai baru</p>
        <p className="mt-3 text-ink-2">Draf tersimpan otomatis. Terbitkan saat siap, lalu berikan ke kelas sebagai tugas.</p>
        <form action={createScenario} className="mt-5">
          <SubmitButton variant="accent" pending="Menyiapkan…">
            Skenario baru
          </SubmitButton>
        </form>
        <p className="mt-6 text-sm text-ink-2">
          Atau lihat skenario dari pengajar lain di{" "}
          <Link href="/pustaka" className="text-ink underline decoration-accent underline-offset-4">
            Pustaka
          </Link>
          .
        </p>
      </aside>
    </div>
  );
}

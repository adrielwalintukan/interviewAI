import { Suspense } from "react";
import { requireUser } from "@/features/auth/dal";
import { CharacterPortrait } from "@/features/scenario/character-portrait";
import { LANGUAGES, LEVELS } from "@/features/scenario/schema";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Pustaka — Interview AI" };

type LibraryRow = {
  id: string;
  title: string;
  version: number;
  language: keyof typeof LANGUAGES;
  level: keyof typeof LEVELS;
  learner_role: string;
  objective: string;
  client_name: string;
  client_occupation: string;
  character_id: string;
};

async function Library() {
  const user = await requireUser();
  const supabase = await createClient();
  const [{ data }, { data: chars }] = await Promise.all([
    // View filters to the current version of public scenarios; RLS still applies (security_invoker).
    supabase.from("library_versions").select("*").order("published_at", { ascending: false }).returns<LibraryRow[]>(),
    supabase.from("characters").select("id, portrait_hue"),
  ]);
  const hue = new Map((chars ?? []).map((c) => [c.id as string, c.portrait_hue as number]));
  const rows = data ?? [];

  if (rows.length === 0) {
    return (
      <p className="border-l-2 border-rule pl-4 text-ink-2">
        Pustaka masih kosong.{" "}
        {user.role === "pengajar" ? "Terbitkan skenario Anda lalu pilih “Bagikan ke Pustaka”." : "Skenario dari pengajar akan muncul di sini."}
      </p>
    );
  }

  return (
    <ul className="grid gap-x-10 gap-y-2 md:grid-cols-2">
      {rows.map((r) => (
        <li key={r.id} className="flex gap-5 border-t border-rule py-6">
          <CharacterPortrait name={r.client_name} hue={hue.get(r.character_id) ?? 30} />
          <div className="min-w-0">
            <p className="font-mono text-label uppercase text-ink-2">
              {LEVELS[r.level]} · {LANGUAGES[r.language]}
            </p>
            <h2 className="mt-1 font-display text-2xl leading-tight">{r.title}</h2>
            <p className="mt-2 text-sm text-ink-2">
              <span className="text-ink">{r.client_name}</span>, {r.client_occupation}. Peran pelajar: {r.learner_role}.
            </p>
            <p className="mt-2 line-clamp-3 text-sm text-ink-2">{r.objective}</p>
            <p className="mt-3 font-mono text-label uppercase text-ink-2">
              {user.role === "pengajar" ? "Berikan lewat halaman kelas → Beri tugas" : "Latihan bebas segera dibuka"}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}

export default function PustakaPage() {
  return (
    <>
      <p className="font-mono text-label uppercase text-accent">Pustaka skenario</p>
      <h1 className="mt-3 max-w-3xl font-display text-display font-medium tracking-tight">Klien dari ruang kelas lain.</h1>
      <p className="mt-4 max-w-2xl text-ink-2">
        Skenario yang dibagikan pengajar. Fakta tersembunyi dan rubrik tetap rahasia — yang terlihat hanya brief wawancaranya.
      </p>
      <div className="mt-10">
        <Suspense fallback={<div className="h-64 animate-pulse rounded-md bg-paper-2" />}>
          <Library />
        </Suspense>
      </div>
    </>
  );
}

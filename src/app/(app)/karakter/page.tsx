import { Suspense } from "react";
import { setCharacterActive } from "@/features/admin/actions";
import { CharacterForm } from "@/features/admin/character-form";
import { GENDER_LABEL, type CharacterRow } from "@/features/admin/characters";
import { requireUser } from "@/features/auth/dal";
import { CharacterPortrait } from "@/features/scenario/character-portrait";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Karakter — Interview AI" };

/** US-A-03: every preset character, inactive ones included (RLS lets admins read them). No hard delete. */
async function CharacterList() {
  await requireUser({ roles: ["admin"] });
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("characters")
    .select("id, name, occupation, age_range, gender, live_voice, portrait_hue, sort, active")
    .order("sort")
    .returns<CharacterRow[]>();
  if (error) {
    return (
      <p role="alert" className="mt-4 text-sm text-accent">
        Daftar karakter gagal dimuat.
      </p>
    );
  }

  return (
    <>
      <ul className="mt-4 divide-y divide-rule border-y border-rule">
        {(data ?? []).map((c) => (
          <li key={c.id} className="py-4">
            <div className="flex flex-wrap items-center gap-4">
              <CharacterPortrait name={c.name} hue={c.portrait_hue} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  {c.name} <span className="font-mono text-sm text-ink-2">{c.id}</span>
                </p>
                <p className="text-sm text-ink-2">
                  {c.occupation} · {c.age_range} · {GENDER_LABEL[c.gender]} · suara {c.live_voice}
                </p>
              </div>
              <span className={`text-sm ${c.active ? "text-moss" : "text-accent"}`}>{c.active ? "Aktif" : "Nonaktif"}</span>
              <form action={setCharacterActive}>
                <input type="hidden" name="id" value={c.id} />
                <input type="hidden" name="active" value={String(!c.active)} />
                <button type="submit" className="relative min-h-11 rounded-sm border border-rule px-3 text-sm hover:border-ink">
                  {c.active ? "Nonaktifkan" : "Aktifkan"}
                  <span className="sr-only"> {c.name}</span>
                </button>
              </form>
            </div>
            <details className="mt-2">
              <summary className="relative inline-flex min-h-11 cursor-pointer items-center text-sm text-ink-2 hover:text-ink">
                Ubah<span className="sr-only"> {c.name}</span>
              </summary>
              <CharacterForm character={c} />
            </details>
          </li>
        ))}
      </ul>
      <details className="mt-6">
        <summary className="inline-flex min-h-11 cursor-pointer items-center font-medium hover:text-accent">+ Tambah karakter</summary>
        <CharacterForm />
      </details>
      <p className="mt-4 text-sm text-ink-2">Karakter nonaktif tidak muncul di editor skenario. Skenario yang sudah memakainya tetap bisa dijalankan.</p>
    </>
  );
}

export default function KarakterPage() {
  return (
    <>
      <p className="font-mono text-label uppercase text-accent">Admin</p>
      <h1 className="mt-3 font-display text-display font-medium tracking-tight">Karakter.</h1>
      <Suspense fallback={<div className="mt-8 h-64 animate-pulse rounded-md bg-paper-2" />}>
        <CharacterList />
      </Suspense>
    </>
  );
}

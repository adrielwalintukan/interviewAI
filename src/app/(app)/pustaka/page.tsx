import Link from "next/link";
import { Suspense } from "react";
import { requireUser } from "@/features/auth/dal";
import { SessionHistory, calculateRemainingQuota, type HistoryRow } from "@/features/interview/session-history";
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
            {user.role === "pelajar" ? (
              <Link href={`/sesi/mulai?versi=${r.id}&jenis=library`} className="mt-4 inline-flex min-h-11 items-center rounded-sm border border-ink px-4 text-sm hover:bg-ink hover:text-paper">
                Latihan<span className="sr-only"> {r.title}</span>
              </Link>
            ) : (
              <p className="mt-3 font-mono text-label uppercase text-ink-2">Berikan lewat halaman kelas → Beri tugas</p>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

async function LibraryHistory() {
  const user = await requireUser();
  if (user.role !== "pelajar") return null;

  const supabase = await createClient();
  const todayStart = new Date(new Date().setUTCHours(0, 0, 0, 0)).toISOString();

  // RLS: own sessions only. Explicit user_id filter enforces server authorization defense-in-depth.
  const [{ data: rows, error: rowsError }, { count: todayCount, error: countError }] = await Promise.all([
    supabase
      .from("sessions")
      .select("id, status, started_at, v:scenario_versions(title, client_name)")
      .eq("user_id", user.id)
      .eq("kind", "library")
      .order("started_at", { ascending: false })
      .returns<HistoryRow[]>(),
    supabase
      .from("sessions")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("kind", "library")
      .gte("started_at", todayStart),
  ]);

  if (rowsError || countError) {
    return (
      <section className="mt-16 max-w-3xl border-t border-rule pt-10">
        <h2 className="font-mono text-label uppercase text-accent">Riwayat latihan</h2>
        <p className="mt-4 border-l-2 border-rule pl-4 text-sm text-ink-2">
          Gagal memuat riwayat latihan. Silakan muat ulang halaman.
        </p>
      </section>
    );
  }

  const remainingQuota = calculateRemainingQuota(todayCount ?? 0);

  return (
    <section className="mt-16 max-w-3xl border-t border-rule pt-10">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-mono text-label uppercase text-accent">Riwayat latihan</h2>
        <p className="text-xs text-ink-2">
          Sisa latihan hari ini: <span className="font-mono text-ink">{remainingQuota}</span> dari 3 sesi
        </p>
      </div>
      <div className="mt-4">
        <SessionHistory
          rows={rows ?? []}
          empty="Belum ada riwayat latihan. Pilih salah satu skenario di atas untuk mulai berlatih."
        />
      </div>
    </section>
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
      <Suspense fallback={<div className="mt-16 h-32 animate-pulse rounded-md bg-paper-2" />}>
        <LibraryHistory />
      </Suspense>
    </>
  );
}

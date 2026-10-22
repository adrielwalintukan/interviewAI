import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { preload } from "react-dom";
import { requireUser } from "@/features/auth/dal";
import { DueLabel } from "@/features/classroom/assignments";
import { LobbyStart } from "@/features/interview/lobby-start";
import { CharacterPortrait } from "@/features/scenario/character-portrait";
import { createClient } from "@/lib/supabase/server";
import { isPast, nowIso } from "@/lib/time";
import { CLIENT_LEVEL_LOBBY, type ClientLevel } from "@/features/classroom/client-level";

export const metadata = { title: "Bersiap wawancara — Interview AI" };

type Brief = {
  id: string;
  title: string;
  learner_role: string;
  objective: string;
  client_name: string;
  client_occupation: string;
  language: "id" | "en";
  characters: { portrait_hue: number; vrm_path: string | null } | null;
};
const BRIEF = "id, title, learner_role, objective, client_name, client_occupation, language, characters(portrait_hue, vrm_path)";
const isUuid = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v);

async function Lobby({ searchParams }: { searchParams: PageProps<"/sesi/mulai">["searchParams"] }) {
  const user = await requireUser({ roles: ["pelajar", "pengajar"] });
  const sp = await searchParams;
  const supabase = await createClient();

  let kind: "assignment" | "library" | "preview";
  let brief: Brief | null = null;
  let meta: { minutes: number; dueAt?: string | null; attemptsLeft?: number; max?: number; clientLevel?: ClientLevel } = { minutes: 15 };
  let disabledReason: string | undefined;
  let back = "/dashboard";

  if (isUuid(sp.tugas)) {
    kind = "assignment";
    const { data: a } = await supabase
      .from("assignments")
      .select(`id, class_id, due_at, duration_min, max_attempts, client_level, classes!inner(archived_at), v:scenario_versions(${BRIEF})`)
      .eq("id", sp.tugas)
      .maybeSingle<{
        id: string;
        class_id: string;
        due_at: string | null;
        duration_min: number;
        max_attempts: number;
        client_level: ClientLevel;
        classes: { archived_at: string | null } | null;
        v: Brief | null;
      }>();
    if (!a?.v) notFound();
    const { count } = await supabase.from("sessions").select("id", { count: "exact", head: true }).eq("assignment_id", a.id).eq("user_id", user.id);
    brief = a.v;
    back = `/kelas/${a.class_id}`;
    meta = { minutes: a.duration_min, dueAt: a.due_at, attemptsLeft: a.max_attempts - (count ?? 0), max: a.max_attempts, clientLevel: a.client_level };
    if (a.classes?.archived_at) disabledReason = "Kelas ini sudah diarsipkan. Tugas tidak bisa dimulai.";
    else if (user.role !== "pelajar") disabledReason = "Hanya pelajar yang mengerjakan tugas. Gunakan “Uji coba” di editor skenario.";
    else if (meta.attemptsLeft! <= 0) disabledReason = "Kesempatan untuk tugas ini sudah habis.";
    else if (isPast(a.due_at)) disabledReason = "Tenggat tugas ini sudah lewat.";
  } else if (isUuid(sp.versi) && (sp.jenis === "library" || sp.jenis === "preview")) {
    kind = sp.jenis;
    const { data } = await supabase.from("scenario_versions").select(BRIEF).eq("id", sp.versi).maybeSingle<Brief>();
    if (!data) notFound();
    brief = data;
    back = kind === "library" ? "/pustaka" : "/skenario";
    meta = { minutes: kind === "library" ? 15 : 10 };
    if (kind === "preview" && user.role !== "pengajar") notFound();
  } else notFound();

  // architecture §5: fetch the avatar while the learner reads the brief, so the stage opens with it.
  const vrmPath = brief?.characters?.vrm_path;
  if (vrmPath) preload(supabase.storage.from("characters").getPublicUrl(vrmPath).data.publicUrl, { as: "fetch", crossOrigin: "anonymous" });

  const { data: active } = await supabase
    .from("sessions")
    .select("id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .gt("ends_at", nowIso())
    .maybeSingle();

  return (
    <>
      <Link href={back} className="-my-3 inline-flex min-h-11 items-center font-mono text-label uppercase text-ink-2 hover:text-ink">
        ← Kembali
      </Link>
      <div className="mt-6 grid gap-10 lg:grid-cols-12">
        <section className="lg:col-span-7">
          <p className="font-mono text-label uppercase text-accent">
            {kind === "preview" ? "Uji coba pengajar" : kind === "library" ? "Latihan bebas" : "Tugas wawancara"}
          </p>
          <h1 className="mt-3 font-display text-4xl font-medium tracking-tight text-balance sm:text-display">{brief.title}</h1>
          <div className="mt-8 flex items-start gap-5">
            <CharacterPortrait name={brief.client_name} hue={brief.characters?.portrait_hue ?? 30} />
            <dl className="grid gap-3 text-sm">
              <div>
                <dt className="font-mono text-label uppercase text-ink-2">Klien</dt>
                <dd className="text-base">
                  {brief.client_name}, {brief.client_occupation}
                </dd>
              </div>
              <div>
                <dt className="font-mono text-label uppercase text-ink-2">Peranmu</dt>
                <dd className="text-base">{brief.learner_role}</dd>
              </div>
              <div>
                <dt className="font-mono text-label uppercase text-ink-2">Tujuan</dt>
                <dd className="text-base">{brief.objective}</dd>
              </div>
              {meta.clientLevel && (
                <div>
                  <dt className="font-mono text-label uppercase text-ink-2">Sikap klien</dt>
                  <dd className="text-base">Klien {CLIENT_LEVEL_LOBBY[meta.clientLevel]}</dd>
                </div>
              )}
            </dl>
          </div>
          <ul className="mt-8 flex flex-wrap gap-x-5 gap-y-1 font-mono text-label uppercase text-ink-2">
            <li>{meta.minutes} menit</li>
            <li>{brief.language === "en" ? "Bahasa Inggris" : "Bahasa Indonesia"}</li>
            {meta.max !== undefined && (
              <li>
                Sisa {Math.max(0, meta.attemptsLeft ?? 0)}/{meta.max} percobaan
              </li>
            )}
            {meta.dueAt !== undefined && (
              <li>
                <DueLabel iso={meta.dueAt ?? null} />
              </li>
            )}
          </ul>
        </section>

        <aside className="lg:col-span-5 lg:border-l lg:border-rule lg:pl-8">
          <p className="font-mono text-label uppercase text-ink-2">Sebelum masuk</p>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-ink-2">
            <li>Pakai earphone bila ada, di tempat yang cukup tenang.</li>
            <li>Mulai dengan perkenalan, lalu ajukan pertanyaan terbuka (“bagaimana…”, “ceritakan…”).</li>
            <li>Tanyakan lebih lanjut setiap jawaban yang menarik. Klien tidak akan menceritakan semuanya sendiri.</li>
            <li>Tutup dengan merangkum kebutuhan yang kamu dengar.</li>
          </ol>
          <div className="mt-8">
            {active ? (
              <Link href={`/sesi/${active.id}`} className="inline-flex min-h-11 items-center rounded-sm bg-ink px-5 text-paper hover:bg-accent">
                Lanjutkan sesi yang sedang berjalan
              </Link>
            ) : (
              <LobbyStart
                kind={kind}
                assignmentId={kind === "assignment" ? (sp.tugas as string) : undefined}
                versionId={kind === "assignment" ? undefined : brief.id}
                needsConsent={!user.micConsentAt}
                disabledReason={disabledReason}
              />
            )}
          </div>
        </aside>
      </div>
    </>
  );
}

export default function MulaiPage({ searchParams }: PageProps<"/sesi/mulai">) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-md bg-paper-2" />}>
      <Lobby searchParams={searchParams} />
    </Suspense>
  );
}

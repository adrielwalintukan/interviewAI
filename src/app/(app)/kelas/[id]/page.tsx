import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { requireUser } from "@/features/auth/dal";
import { deleteAssignment, regenerateJoinCode } from "@/features/classroom/actions";
import { AssignmentForm, DueLabel, DueState, type VersionOption } from "@/features/classroom/assignments";
import { BulkStudentsForm, CopyCode } from "@/features/classroom/components";
import { CharacterPortrait } from "@/features/scenario/character-portrait";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Kelas — Interview AI" };

type Member = { joined_at: string; profiles: { display_name: string; username: string | null } | null };

type AssignmentRow = {
  id: string;
  due_at: string | null;
  duration_min: number;
  max_attempts: number;
  v: {
    title: string;
    version: number;
    client_name: string;
    client_occupation: string;
    learner_role: string;
    objective: string;
    characters: { portrait_hue: number } | null;
  } | null;
};

function AssignmentList({ rows, classId, isOwner }: { rows: AssignmentRow[]; classId: string; isOwner: boolean }) {
  if (rows.length === 0) {
    return (
      <p className="border-l-2 border-rule pl-4 text-ink-2">
        {isOwner ? "Belum ada tugas. Berikan skenario lewat form Beri tugas." : "Belum ada tugas wawancara. Pengajarmu akan memberikannya di sini."}
      </p>
    );
  }
  return (
    <ol className="divide-y divide-rule border-y border-rule">
      {rows.map((a) => (
        <li key={a.id} className="flex gap-4 py-5">
          <CharacterPortrait name={a.v?.client_name ?? "?"} hue={a.v?.characters?.portrait_hue ?? 30} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="font-display text-xl leading-tight">
              {a.v?.title}
              {isOwner && <span className="ml-2 font-mono text-label uppercase text-ink-2">v{a.v?.version}</span>}
            </p>
            <p className="mt-1 text-sm text-ink-2">
              Wawancarai <span className="text-ink">{a.v?.client_name}</span>, {a.v?.client_occupation}.{" "}
              {isOwner ? "Peran pelajar" : "Peranmu"}: {a.v?.learner_role}.
            </p>
            <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-label uppercase text-ink-2">
              <DueLabel iso={a.due_at} />
              <DueState iso={a.due_at} />
              <span>{a.duration_min} menit</span>
              <span>{a.max_attempts}× percobaan</span>
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            {isOwner ? (
              <form action={deleteAssignment}>
                <input type="hidden" name="id" value={a.id} />
                <input type="hidden" name="classId" value={classId} />
                <button type="submit" className="min-h-11 px-2 text-sm text-ink-2 hover:text-accent">
                  Hapus<span className="sr-only"> tugas {a.v?.title}</span>
                </button>
              </form>
            ) : (
              <span className="inline-flex min-h-11 items-center rounded-sm border border-dashed border-rule px-3 text-sm text-ink-2" title="Ruang wawancara hadir di milestone berikutnya">
                Segera dibuka
              </span>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

async function ClassDetail({ params }: { params: PageProps<"/kelas/[id]">["params"] }) {
  const user = await requireUser();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const supabase = await createClient();
  // RLS returns nothing unless the caller owns or belongs to the class.
  const { data: cls } = await supabase
    .from("classes")
    .select("id, name, join_code, owner_id, archived_at")
    .eq("id", id)
    .maybeSingle();
  if (!cls) notFound();

  const isOwner = cls.owner_id === user.id;

  // RLS: owner and members of this class only.
  const { data: assignmentData } = await supabase
    .from("assignments")
    .select(
      "id, due_at, duration_min, max_attempts, v:scenario_versions(title, version, client_name, client_occupation, learner_role, objective, characters(portrait_hue))",
    )
    .eq("class_id", id)
    .order("created_at", { ascending: false })
    .returns<AssignmentRow[]>();
  const assignments = assignmentData ?? [];

  const header = (
    <>
      <Link href="/dashboard" className="-my-3 inline-flex min-h-11 items-center font-mono text-label uppercase text-ink-2 hover:text-ink">
        ← Dashboard
      </Link>
      <h1 className="mt-4 font-display text-display font-medium tracking-tight">{cls.name}</h1>
    </>
  );

  if (!isOwner) {
    return (
      <>
        {header}
        <section className="mt-10 max-w-3xl">
          <p className="font-mono text-label uppercase text-accent">Tugas wawancara</p>
          <div className="mt-4">
            <AssignmentList rows={assignments} classId={cls.id} isOwner={false} />
          </div>
        </section>
      </>
    );
  }

  const [{ data: ownScenarios }, { data: library }] = await Promise.all([
    supabase
      .from("scenarios")
      .select("current:scenario_versions!scenarios_current_version_fk(id, version, title)")
      .not("current_version_id", "is", null)
      .eq("author_id", user.id)
      .order("updated_at", { ascending: false })
      .returns<{ current: { id: string; version: number; title: string } | null }[]>(),
    supabase.from("library_versions").select("id, title, version, client_name").order("published_at", { ascending: false }),
  ]);
  // Label with the published version's title: the draft title may already have moved on.
  const own: VersionOption[] = (ownScenarios ?? []).flatMap((s) => (s.current ? [{ id: s.current.id, label: `${s.current.title} (v${s.current.version})` }] : []));
  const ownIds = new Set(own.map((o) => o.id));
  const libraryOptions: VersionOption[] = (library ?? [])
    .filter((v) => !ownIds.has(v.id))
    .map((v) => ({ id: v.id, label: `${v.title} — ${v.client_name} (v${v.version})` }));

  const { data: members } = await supabase
    .from("class_members")
    .select("joined_at, profiles(display_name, username)")
    .eq("class_id", id)
    .order("joined_at", { ascending: true })
    .returns<Member[]>();

  return (
    <>
      {header}
      <div className="mt-10 grid gap-12 lg:grid-cols-12">
        <section className="lg:col-span-7">
          <p className="font-mono text-label uppercase text-accent">01 — Tugas ({assignments.length})</p>
          <div className="mt-4">
            <AssignmentList rows={assignments} classId={cls.id} isOwner />
          </div>
        </section>
        <section className="lg:col-span-5 lg:border-l lg:border-rule lg:pl-8">
          <p className="font-mono text-label uppercase text-accent">02 — Beri tugas</p>
          <div className="mt-4">
            <AssignmentForm classId={cls.id} own={own} library={libraryOptions} />
          </div>
        </section>
      </div>
      <div className="mt-16 grid gap-12 border-t border-rule pt-10 lg:grid-cols-12">
        <section className="lg:col-span-5">
          <p className="font-mono text-label uppercase text-accent">03 — Kode gabung</p>
          <p className="mt-3 font-mono text-[clamp(2.5rem,8vw,4rem)] leading-none tracking-[0.18em]" aria-label={`Kode kelas ${cls.join_code.split("").join(" ")}`}>
            {cls.join_code}
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <CopyCode code={cls.join_code} />
            <form action={regenerateJoinCode}>
              <input type="hidden" name="classId" value={cls.id} />
              <button type="submit" className="min-h-11 rounded-sm px-4 text-sm text-ink-2 underline-offset-4 hover:text-ink hover:underline">
                Buat kode baru
              </button>
            </form>
          </div>
          <p className="mt-3 text-sm text-ink-2">Kode lama langsung tidak berlaku setelah dibuat ulang.</p>

          <p className="mt-12 font-mono text-label uppercase text-accent">04 — Pelajar ({members?.length ?? 0})</p>
          {members && members.length > 0 ? (
            <ol className="mt-3 divide-y divide-rule border-y border-rule">
              {members.map((m, i) => (
                <li key={`${m.profiles?.username ?? i}-${m.joined_at}`} className="grid grid-cols-[2rem_1fr_auto] gap-3 py-2.5 text-sm">
                  <span className="font-mono text-ink-2">{String(i + 1).padStart(2, "0")}</span>
                  <span>{m.profiles?.display_name ?? "—"}</span>
                  <span className="font-mono text-ink-2">{m.profiles?.username ?? "email"}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-3 text-ink-2">Belum ada pelajar. Bagikan kode di atas atau buat akun massal.</p>
          )}
        </section>

        <section className="lg:col-span-7 lg:border-l lg:border-rule lg:pl-8">
          <p className="font-mono text-label uppercase text-accent">05 — Akun pelajar massal</p>
          <p className="mt-3 text-ink-2">
            Untuk pelajar tanpa email. Mereka masuk dengan <span className="font-mono text-ink">username</span> dan
            password awal, lalu wajib menggantinya saat pertama masuk.
          </p>
          <div className="mt-6">
            <BulkStudentsForm classId={cls.id} />
          </div>
        </section>
      </div>
    </>
  );
}

export default function KelasPage({ params }: PageProps<"/kelas/[id]">) {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-md bg-paper-2" />}>
      <ClassDetail params={params} />
    </Suspense>
  );
}

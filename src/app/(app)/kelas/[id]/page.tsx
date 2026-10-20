import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { requireUser } from "@/features/auth/dal";
import { deleteAssignment, regenerateJoinCode } from "@/features/classroom/actions";
import { ArchiveClassButton } from "@/features/classroom/archive-button";
import { AssignmentForm, DueLabel, DueState, type VersionOption } from "@/features/classroom/assignments";
import { BulkStudentsForm, CopyCode } from "@/features/classroom/components";
import { ResetPasswordButton } from "@/features/auth/reset-password-button";
import { SessionHistory, type HistoryRow } from "@/features/interview/session-history";
import { CharacterPortrait } from "@/features/scenario/character-portrait";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Kelas — Interview AI" };

type Member = { user_id: string; joined_at: string; profiles: { display_name: string; username: string | null; role: string } | null };

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

/** `asTeacher`: teacher wording, no Mulai. `canEdit`: the class owner (admin only reads; the actions are pengajar-only). */
/** A failed query must not read as "nothing here yet". */
function LoadError({ what }: { what: string }) {
  return (
    <p role="alert" className="border-l-2 border-accent pl-4 text-accent">
      {what} gagal dimuat. Muat ulang halaman ini; bila masih gagal, hubungi admin.
    </p>
  );
}

function AssignmentList({
  rows,
  classId,
  asTeacher,
  canEdit,
  isArchived,
}: {
  rows: AssignmentRow[];
  classId: string;
  asTeacher: boolean;
  canEdit: boolean;
  isArchived?: boolean;
}) {
  if (rows.length === 0) {
    return (
      <p className="border-l-2 border-rule pl-4 text-ink-2">
        {canEdit
          ? "Belum ada tugas. Berikan skenario lewat form Beri tugas."
          : asTeacher
            ? "Belum ada tugas."
            : "Belum ada tugas wawancara. Pengajarmu akan memberikannya di sini."}
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
              {asTeacher && <span className="ml-2 font-mono text-label uppercase text-ink-2">v{a.v?.version}</span>}
            </p>
            <p className="mt-1 text-sm text-ink-2">
              Wawancarai <span className="text-ink">{a.v?.client_name}</span>, {a.v?.client_occupation}.{" "}
              {asTeacher ? "Peran pelajar" : "Peranmu"}: {a.v?.learner_role}.
            </p>
            <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-label uppercase text-ink-2">
              <DueLabel iso={a.due_at} />
              <DueState iso={a.due_at} />
              <span>{a.duration_min} menit</span>
              <span>{a.max_attempts}× percobaan</span>
            </p>
          </div>
          <div className="flex max-w-24 shrink-0 flex-col items-end gap-2 sm:max-w-none">
            {asTeacher && (
              <Link href={`/kelas/${classId}/tugas/${a.id}`} className="inline-flex min-h-11 items-center rounded-sm border border-rule px-4 text-sm hover:border-ink">
                Hasil<span className="sr-only"> tugas {a.v?.title}</span>
              </Link>
            )}
            {asTeacher && (
              // A file download, not a page: plain <a> so the client router doesn't try to render it.
              <a href={`/kelas/${classId}/tugas/${a.id}/nilai-csv`} download className="inline-flex min-h-11 items-center px-2 text-right text-sm text-ink-2 underline-offset-4 hover:text-ink hover:underline">
                Unduh CSV nilai<span className="sr-only"> tugas {a.v?.title}</span>
              </a>
            )}
            {canEdit ? (
              <form action={deleteAssignment}>
                <input type="hidden" name="id" value={a.id} />
                <input type="hidden" name="classId" value={classId} />
                <button type="submit" className="min-h-11 px-2 text-sm text-ink-2 hover:text-accent">
                  Hapus<span className="sr-only"> tugas {a.v?.title}</span>
                </button>
              </form>
            ) : asTeacher ? null : isArchived ? (
              <span
                className="inline-flex min-h-11 items-center rounded-sm border border-rule px-4 text-xs font-mono uppercase text-ink-2"
                title="Kelas ini sudah diarsipkan"
              >
                Kelas diarsipkan
              </span>
            ) : (
              <Link href={`/sesi/mulai?tugas=${a.id}`} className="inline-flex min-h-11 items-center rounded-sm bg-accent px-4 text-sm font-medium text-accent-ink hover:bg-ink hover:text-paper">
                Mulai<span className="sr-only"> wawancara {a.v?.title}</span>
              </Link>
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
  // RLS returns nothing unless the caller owns or belongs to the class, or is an admin.
  const { data: cls } = await supabase
    .from("classes")
    .select("id, name, join_code, owner_id, archived_at")
    .eq("id", id)
    .maybeSingle();
  if (!cls) notFound();

  const isOwner = cls.owner_id === user.id;
  const isArchived = Boolean(cls.archived_at);
  // Admins read every class (RLS) but aren't members: they get the teacher view without the owner's actions.
  const isAdmin = user.role === "admin" && !isOwner;

  // RLS: owner, members of this class, and admins.
  const { data: assignmentData, error: assignmentError } = await supabase
    .from("assignments")
    .select(
      "id, due_at, duration_min, max_attempts, v:scenario_versions(title, version, client_name, client_occupation, learner_role, objective, characters(portrait_hue))",
    )
    .eq("class_id", id)
    .order("created_at", { ascending: false })
    .returns<AssignmentRow[]>();
  const assignments = assignmentData ?? [];

  const header = (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Link href="/dashboard" className="-my-3 inline-flex min-h-11 items-center font-mono text-label uppercase text-ink-2 hover:text-ink">
          ← Dashboard
        </Link>
        {isOwner && <ArchiveClassButton classId={cls.id} isArchived={isArchived} />}
      </div>
      <h1 className="mt-4 font-display text-display font-medium tracking-tight">{cls.name}</h1>
      {isArchived && (
        <div className="mt-4 rounded-sm border border-ochre/40 bg-ochre/10 p-4 text-sm text-ochre">
          <p className="font-medium">Kelas ini diarsipkan</p>
          <p className="mt-1 text-ink-2">
            Pelajar tidak dapat bergabung atau memulai tugas baru. Riwayat dan transkrip masih bisa dilihat; transkrip dan nilainya dihapus permanen 1 tahun setelah kelas diarsipkan.
          </p>
        </div>
      )}
    </div>
  );

  if (!isOwner && !isAdmin) {
    // RLS: own sessions only. Sessions of a deleted assignment lose their class link and drop out of this list.
    const { data: history } = await supabase
      .from("sessions")
      .select("id, status, started_at, assignment:assignments!inner(class_id), v:scenario_versions(title, client_name), evaluation:evaluations(final_score, ai_score)")
      .eq("user_id", user.id)
      .eq("assignment.class_id", id)
      .order("started_at", { ascending: false })
      .returns<HistoryRow[]>();
    return (
      <>
        {header}
        <section className="mt-10 max-w-3xl">
          <p className="font-mono text-label uppercase text-accent">Tugas wawancara</p>
          <div className="mt-4">
            {assignmentError ? (
              <LoadError what="Daftar tugas" />
            ) : (
              <AssignmentList rows={assignments} classId={cls.id} asTeacher={false} canEdit={false} isArchived={isArchived} />
            )}
          </div>
        </section>
        <section className="mt-12 max-w-3xl">
          <p className="font-mono text-label uppercase text-accent">Riwayat wawancara</p>
          <div className="mt-4">
            <SessionHistory rows={history ?? []} />
          </div>
        </section>
      </>
    );
  }

  // Options for the Beri tugas form, which only the owner gets.
  const [{ data: ownScenarios }, { data: library }] = !isOwner ? [{ data: null }, { data: null }] : await Promise.all([
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

  const { data: members, error: membersError } = await supabase
    .from("class_members")
    .select("user_id, joined_at, profiles!inner(display_name, username, role)")
    .eq("class_id", id)
    // A member whose role an admin changed (US-A-01) keeps the class_members row; this list counts learners only.
    .eq("profiles.role", "pelajar")
    .order("joined_at", { ascending: true })
    .returns<Member[]>();

  return (
    <>
      {header}
      {isAdmin && <p className="mt-3 text-ink-2">Tampilan admin, hanya baca. Kelas ini dikelola pengajarnya.</p>}
      <div className="mt-10 grid gap-12 lg:grid-cols-12">
        <section className="lg:col-span-7">
          <p className="font-mono text-label uppercase text-accent">01 — Tugas{assignmentError ? "" : ` (${assignments.length})`}</p>
          <div className="mt-4">
            {assignmentError ? (
              <LoadError what="Daftar tugas" />
            ) : (
              <AssignmentList rows={assignments} classId={cls.id} asTeacher canEdit={isOwner && !isArchived} isArchived={isArchived} />
            )}
          </div>
        </section>
        {isOwner && (
          <section className="lg:col-span-5 lg:border-l lg:border-rule lg:pl-8">
            <p className="font-mono text-label uppercase text-accent">02 — Beri tugas</p>
            <div className="mt-4">
              {isArchived ? (
                <p className="border-l-2 border-rule pl-4 text-sm text-ink-2">
                  Kelas ini diarsipkan. Buka arsip kelas untuk memberikan tugas baru.
                </p>
              ) : (
                <AssignmentForm classId={cls.id} own={own} library={libraryOptions} />
              )}
            </div>
          </section>
        )}
      </div>
      <div className="mt-16 grid gap-12 border-t border-rule pt-10 lg:grid-cols-12">
        <section className="lg:col-span-5">
          {isOwner && (
            <>
              <p className="font-mono text-label uppercase text-accent">03 — Kode gabung</p>
              <p className="mt-3 font-mono text-[clamp(2.5rem,8vw,4rem)] leading-none tracking-[0.18em]" aria-label={`Kode kelas ${cls.join_code.split("").join(" ")}`}>
                {cls.join_code}
              </p>
              {isArchived ? (
                <p className="mb-12 mt-4 border-l-2 border-rule pl-4 text-sm text-ink-2">
                  Kode gabung dinonaktifkan karena kelas diarsipkan. Pelajar baru tidak dapat bergabung.
                </p>
              ) : (
                <>
                  <div className="mt-5 flex flex-wrap gap-2">
                    <CopyCode code={cls.join_code} />
                    <form action={regenerateJoinCode}>
                      <input type="hidden" name="classId" value={cls.id} />
                      <button type="submit" className="min-h-11 rounded-sm px-4 text-sm text-ink-2 underline-offset-4 hover:text-ink hover:underline">
                        Buat kode baru
                      </button>
                    </form>
                  </div>
                  <p className="mb-12 mt-3 text-sm text-ink-2">Kode lama langsung tidak berlaku setelah dibuat ulang.</p>
                </>
              )}
            </>
          )}

          <p className="font-mono text-label uppercase text-accent">
            {isOwner ? "04" : "02"} — Pelajar{membersError ? "" : ` (${members?.length ?? 0})`}
          </p>
          {membersError ? (
            <div className="mt-3">
              <LoadError what="Daftar pelajar" />
            </div>
          ) : members && members.length > 0 ? (
            <ol className="mt-3 divide-y divide-rule border-y border-rule">
              {members.map((m, i) => (
                <li key={m.user_id} className="grid grid-cols-[2rem_1fr] gap-x-3 gap-y-1 py-2.5 text-sm sm:grid-cols-[2rem_1fr_auto]">
                  <span className="font-mono text-ink-2">{String(i + 1).padStart(2, "0")}</span>
                  <span>
                    {m.profiles?.display_name ?? "—"}
                    <span className="block font-mono text-ink-2">{m.profiles?.username ?? "login dengan email"}</span>
                  </span>
                  <span className="col-start-2 sm:col-start-3 sm:justify-self-end">
                    {m.profiles?.role === "pelajar" && <ResetPasswordButton userId={m.user_id} name={m.profiles.display_name} />}
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-3 text-ink-2">{isOwner ? "Belum ada pelajar. Bagikan kode di atas atau buat akun massal." : "Belum ada pelajar."}</p>
          )}
        </section>

        {isOwner && (
          <section className="lg:col-span-7 lg:border-l lg:border-rule lg:pl-8">
            <p className="font-mono text-label uppercase text-accent">05 — Akun pelajar massal</p>
            {isArchived ? (
              <p className="mt-4 border-l-2 border-rule pl-4 text-sm text-ink-2">
                Kelas ini diarsipkan. Buka arsip kelas untuk menambahkan akun pelajar baru.
              </p>
            ) : (
              <>
                <p className="mt-3 text-ink-2">
                  Untuk pelajar tanpa email. Mereka masuk dengan <span className="font-mono text-ink">username</span> dan
                  password awal, lalu wajib menggantinya saat pertama masuk.
                </p>
                <div className="mt-6">
                  <BulkStudentsForm classId={cls.id} />
                </div>
              </>
            )}
          </section>
        )}
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

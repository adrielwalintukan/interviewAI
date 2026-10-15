import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { requireUser } from "@/features/auth/dal";
import { deleteAssignment, regenerateJoinCode } from "@/features/classroom/actions";
import { AssignmentForm, DueLabel, DueState, LocalTime, type VersionOption } from "@/features/classroom/assignments";
import { BulkStudentsForm, CopyCode } from "@/features/classroom/components";
import { ResetPasswordButton } from "@/features/auth/reset-password-button";
import { STATUS_LABEL, SessionHistory, type HistoryRow } from "@/features/interview/session-history";
import { CharacterPortrait } from "@/features/scenario/character-portrait";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Kelas — Interview AI" };

type Member = { user_id: string; joined_at: string; profiles: { display_name: string; username: string | null; role: string } | null };

type ResultRow = {
  id: string;
  status: string;
  started_at: string;
  profiles: { display_name: string } | null;
  evaluations: { final_score: number; reviewer_id: string | null } | null;
  assignment: { v: { title: string } | null } | null;
};

/** Teacher view: every attempt in this class, newest first, linking to the review page (US-G-07). */
function ClassResults({ rows }: { rows: ResultRow[] }) {
  if (rows.length === 0) return <p className="border-l-2 border-rule pl-4 text-ink-2">Belum ada pelajar yang mengerjakan tugas.</p>;
  return (
    <ol className="divide-y divide-rule border-y border-rule">
      {rows.map((r) => (
        <li key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3">
          <div className="min-w-0 flex-1">
            <p className="font-medium">{r.profiles?.display_name ?? "—"}</p>
            <p className="flex flex-wrap gap-x-3 font-mono text-label uppercase text-ink-2">
              <span className="normal-case">{r.assignment?.v?.title}</span>
              <LocalTime iso={r.started_at} />
            </p>
          </div>
          <p className="font-mono text-label uppercase text-ink-2">
            {r.evaluations ? (
              <>
                <span className="font-display text-2xl tabular-nums text-ink">{r.evaluations.final_score}</span>
                {r.evaluations.reviewer_id ? " · ditinjau" : " · AI"}
              </>
            ) : (
              (STATUS_LABEL[r.status] ?? r.status)
            )}
          </p>
          <Link href={`/sesi/${r.id}/selesai`} className="inline-flex min-h-11 shrink-0 items-center rounded-sm border border-rule px-4 text-sm hover:border-ink">
            Tinjau<span className="sr-only"> wawancara {r.profiles?.display_name}</span>
          </Link>
        </li>
      ))}
    </ol>
  );
}

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
            <AssignmentList rows={assignments} classId={cls.id} isOwner={false} />
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

  // RLS: the class owner reads its sessions, evaluations and members' profiles.
  // shortcut: newest 100 attempts only; the class dashboard (US-G-08, #13) replaces this list with per-assignment views.
  const { data: results } = await supabase
    .from("sessions")
    .select("id, status, started_at, profiles(display_name), evaluations(final_score, reviewer_id), assignment:assignments!inner(class_id, v:scenario_versions(title))")
    .eq("assignment.class_id", id)
    .order("started_at", { ascending: false })
    .limit(100)
    .returns<ResultRow[]>();

  const { data: members } = await supabase
    .from("class_members")
    .select("user_id, joined_at, profiles(display_name, username, role)")
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
      <section className="mt-16 border-t border-rule pt-10 lg:max-w-4xl">
        <p className="font-mono text-label uppercase text-accent">Hasil wawancara</p>
        <div className="mt-4">
          <ClassResults rows={results ?? []} />
        </div>
      </section>
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

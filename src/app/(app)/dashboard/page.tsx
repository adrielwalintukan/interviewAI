import Link from "next/link";
import { Suspense } from "react";
import { requireUser, type CurrentUser } from "@/features/auth/dal";
import { CreateClassForm, JoinClassForm } from "@/features/classroom/components";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Dashboard — Interview AI" };

type ClassRow = { id: string; name: string; archived_at: string | null; class_members: { count: number }[] };

async function ClassList({ user }: { user: CurrentUser }) {
  const supabase = await createClient();
  // RLS scopes this to owned classes (pengajar) or joined classes (pelajar).
  const { data } = await supabase
    .from("classes")
    .select("id, name, archived_at, class_members(count)")
    .order("created_at", { ascending: false })
    .returns<ClassRow[]>();
  const classes = data ?? [];

  if (classes.length === 0) {
    return (
      <p className="border-l-2 border-rule pl-4 text-ink-2">
        {user.role === "pengajar"
          ? "Belum ada kelas. Buat kelas baru, lalu bagikan kodenya ke pelajar."
          : "Kamu belum bergabung ke kelas mana pun. Minta kode kelas ke pengajarmu."}
      </p>
    );
  }

  return (
    <ol className="divide-y divide-rule border-y border-rule">
      {classes.map((c, i) => (
        <li key={c.id}>
          <Link
            href={`/kelas/${c.id}`}
            className="group grid grid-cols-[2.5rem_1fr_auto] items-baseline gap-3 py-4 transition-colors hover:bg-paper-2/60"
          >
            <span className="font-mono text-label text-ink-2">{String(i + 1).padStart(2, "0")}</span>
            <span className="font-display text-xl group-hover:text-accent">
              {c.name}
              {c.archived_at && <span className="ml-2 font-mono text-label uppercase text-ink-2">diarsipkan</span>}
            </span>
            {user.role === "pengajar" && (
              <span className="font-mono text-label uppercase text-ink-2">{c.class_members[0]?.count ?? 0} pelajar</span>
            )}
          </Link>
        </li>
      ))}
    </ol>
  );
}

type ReviewNotice = { session_id: string; final_score: number; s: { v: { title: string } | null } | null };

/** US-G-07: a teacher reviewed one of the learner's grades and they haven't opened that report since. */
async function ReviewNotices({ user }: { user: CurrentUser }) {
  const supabase = await createClient();
  // RLS: own evaluations; review_seen_at is cleared on every review and set when the learner opens the report.
  const { data } = await supabase
    .from("evaluations")
    .select("session_id, final_score, s:sessions!inner(user_id, v:scenario_versions(title))")
    .eq("s.user_id", user.id)
    .not("reviewed_at", "is", null)
    .is("review_seen_at", null)
    .order("reviewed_at", { ascending: false })
    .returns<ReviewNotice[]>();
  if (!data?.length) return null;
  return (
    <section aria-labelledby="nilai-baru-h" className="mb-10 border-l-2 border-accent pl-4">
      <h2 id="nilai-baru-h" className="font-mono text-label uppercase text-accent">
        Nilai baru dari pengajar
      </h2>
      <ul className="mt-2 space-y-1">
        {data.map((n) => (
          <li key={n.session_id}>
            <Link href={`/sesi/${n.session_id}/selesai`} className="inline-flex min-h-11 items-center gap-2 underline decoration-accent underline-offset-4 hover:text-accent">
              {n.s?.v?.title} — nilai final <span className="tabular-nums">{n.final_score}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

async function Dashboard() {
  const user = await requireUser({ allowPending: true });

  if (user.status === "pending") {
    return (
      <section className="max-w-xl">
        <p className="font-mono text-label uppercase text-ochre">Menunggu persetujuan</p>
        <h1 className="mt-3 font-display text-display font-medium tracking-tight">Halo, {user.displayName}.</h1>
        <p className="mt-4 text-lg text-ink-2">
          Akun pengajar Anda sedang ditinjau Admin institusi. Setelah disetujui, Anda bisa membuat kelas dan skenario.
        </p>
      </section>
    );
  }

  const isTeacher = user.role === "pengajar";
  return (
    <div className="grid gap-12 lg:grid-cols-12">
      <section className="lg:col-span-7">
        <p className="font-mono text-label uppercase text-accent">01 — {isTeacher ? "Kelas Anda" : "Kelasmu"}</p>
        <h1 className="mt-3 font-display text-display font-medium tracking-tight">Halo, {user.displayName}.</h1>
        <div className="mt-8">
          {user.role === "pelajar" && <ReviewNotices user={user} />}
          <ClassList user={user} />
        </div>
      </section>
      <aside className="lg:col-span-5 lg:border-l lg:border-rule lg:pl-8">
        <p className="font-mono text-label uppercase text-ink-2">02 — {isTeacher ? "Kelas baru" : "Gabung kelas"}</p>
        <div className="mt-4">{isTeacher ? <CreateClassForm /> : user.role === "pelajar" ? <JoinClassForm /> : null}</div>
        {user.role === "admin" && (
          <p className="text-ink-2">
            Kelola akun & persetujuan pengajar di{" "}
            <Link href="/admin" className="text-ink underline decoration-accent underline-offset-4">
              halaman Admin
            </Link>
            .
          </p>
        )}
      </aside>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="h-48 animate-pulse rounded-md bg-paper-2" />}>
      <Dashboard />
    </Suspense>
  );
}

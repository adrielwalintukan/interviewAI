import Link from "next/link";
import { Suspense } from "react";
import { requireUser, type CurrentUser } from "@/features/auth/dal";
import { CreateClassForm, JoinClassForm } from "@/features/classroom/components";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Dashboard — Interview AI" };

type ClassRow = { id: string; name: string; archived_at: string | null; class_members: { profiles: { role: string } | null }[] };

async function ClassList({ user }: { user: CurrentUser }) {
  const supabase = await createClient();
  // RLS scopes this to owned classes (pengajar), joined classes (pelajar), or all classes (admin).
  // Role per member, not count: a member whose role an Admin changed (US-A-01) stays in class_members.
  // shortcut: fetches one row per member, fine for a school; switch to a counting view if dashboards slow down.
  const { data, error } = await supabase
    .from("classes")
    .select("id, name, archived_at, class_members(profiles(role))")
    .order("created_at", { ascending: false })
    .returns<ClassRow[]>();

  if (error) {
    return <p className="border-l-2 border-rule pl-4 text-ink-2">Gagal memuat daftar kelas. Silakan muat ulang halaman.</p>;
  }
  const classes = data;

  if (classes.length === 0) {
    return (
      <p className="border-l-2 border-rule pl-4 text-ink-2">
        {user.role === "pengajar"
          ? "Belum ada kelas. Buat kelas baru, lalu bagikan kodenya ke pelajar."
          : user.role === "admin"
            ? "Belum ada kelas di institusi ini."
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
            {user.role !== "pelajar" && (
              <span className="font-mono text-label uppercase text-ink-2">{c.class_members.filter((m) => m.profiles?.role === "pelajar").length} pelajar</span>
            )}
          </Link>
        </li>
      ))}
    </ol>
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
  const isAdmin = user.role === "admin";
  return (
    <div className="grid gap-12 lg:grid-cols-12">
      <section className="lg:col-span-7">
        <p className="font-mono text-label uppercase text-accent">01 — {isAdmin ? "Semua kelas" : isTeacher ? "Kelas Anda" : "Kelasmu"}</p>
        <h1 className="mt-3 font-display text-display font-medium tracking-tight">Halo, {user.displayName}.</h1>
        <div className="mt-8">
          <ClassList user={user} />
        </div>
      </section>
      <aside className="lg:col-span-5 lg:border-l lg:border-rule lg:pl-8">
        <p className="font-mono text-label uppercase text-ink-2">02 — {isAdmin ? "Admin" : isTeacher ? "Kelas baru" : "Gabung kelas"}</p>
        {isAdmin ? (
          <p className="mt-4 text-ink-2">
            Kelola akun & persetujuan pengajar di{" "}
            <Link href="/admin" className="text-ink underline decoration-accent underline-offset-4">
              halaman Admin
            </Link>
            .
          </p>
        ) : (
          <div className="mt-4">{isTeacher ? <CreateClassForm /> : <JoinClassForm />}</div>
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

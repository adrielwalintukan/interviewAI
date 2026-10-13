import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { requireUser } from "@/features/auth/dal";
import { regenerateJoinCode } from "@/features/classroom/actions";
import { BulkStudentsForm, CopyCode } from "@/features/classroom/components";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Kelas — Interview AI" };

type Member = { joined_at: string; profiles: { display_name: string; username: string | null } | null };

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

  const header = (
    <>
      <Link href="/dashboard" className="font-mono text-label uppercase text-ink-2 hover:text-ink">
        ← Dashboard
      </Link>
      <h1 className="mt-4 font-display text-display font-medium tracking-tight">{cls.name}</h1>
    </>
  );

  if (!isOwner) {
    return (
      <>
        {header}
        <section className="mt-10 max-w-xl border-l-2 border-rule pl-4">
          <p className="font-mono text-label uppercase text-ink-2">Tugas</p>
          <p className="mt-2 text-ink-2">Belum ada tugas wawancara. Pengajarmu akan memberikannya di sini.</p>
        </section>
      </>
    );
  }

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
        <section className="lg:col-span-5">
          <p className="font-mono text-label uppercase text-accent">01 — Kode gabung</p>
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

          <p className="mt-12 font-mono text-label uppercase text-accent">02 — Pelajar ({members?.length ?? 0})</p>
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
          <p className="font-mono text-label uppercase text-accent">03 — Akun pelajar massal</p>
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

import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { requireUser } from "@/features/auth/dal";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Wawancara selesai — Interview AI" };

type Row = {
  id: string;
  user_id: string;
  kind: "assignment" | "library" | "preview";
  mode: string;
  status: string;
  started_at: string;
  ended_at: string | null;
  assignment: { class_id: string } | null;
  v: { title: string; client_name: string } | null;
};

async function Summary({ params }: { params: PageProps<"/sesi/[id]/selesai">["params"] }) {
  const user = await requireUser({ roles: ["pelajar", "pengajar", "admin"] });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const supabase = await createClient();
  // RLS: the learner, their class teacher, or an admin.
  const { data: s } = await supabase
    .from("sessions")
    .select("id, user_id, kind, mode, status, started_at, ended_at, assignment:assignments(class_id), v:scenario_versions(title, client_name)")
    .eq("id", id)
    .maybeSingle<Row>();
  if (!s?.v) notFound();
  const { data: messages } = await supabase.from("messages").select("seq, speaker, text").eq("session_id", id).order("seq");
  const turns = messages ?? [];
  const learnerTurns = turns.filter((m) => m.speaker === "learner").length;
  const minutes = s.ended_at ? Math.max(1, Math.round((Date.parse(s.ended_at) - Date.parse(s.started_at)) / 60_000)) : null;
  const back = s.assignment ? `/kelas/${s.assignment.class_id}` : s.kind === "preview" ? "/skenario" : "/pustaka";
  const isOwn = s.user_id === user.id;

  return (
    <div className="grid gap-10 lg:grid-cols-12">
      <section className="lg:col-span-4">
        <p className="font-mono text-label uppercase text-accent">{s.status === "active" ? "Sesi berjalan" : "Wawancara selesai"}</p>
        <h1 className="mt-3 font-display text-4xl font-medium tracking-tight text-balance">{s.v.title}</h1>
        <dl className="mt-8 grid grid-cols-2 gap-6 border-t border-rule pt-6">
          <div>
            <dt className="font-mono text-label uppercase text-ink-2">Pertanyaanmu</dt>
            <dd className="font-display text-5xl tabular-nums">{learnerTurns}</dd>
          </div>
          <div>
            <dt className="font-mono text-label uppercase text-ink-2">Durasi</dt>
            <dd className="font-display text-5xl tabular-nums">{minutes ?? "—"}</dd>
            <dd className="font-mono text-label uppercase text-ink-2">menit</dd>
          </div>
        </dl>
        <p className="mt-8 border-l-2 border-ochre pl-4 text-sm text-ink-2">
          Penilaian AI — fakta yang berhasil digali, kualitas pertanyaan, dan saran — hadir di pembaruan berikutnya. Transkrip ini sudah tersimpan.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href={back} className="inline-flex min-h-11 items-center rounded-sm bg-ink px-5 text-paper hover:bg-accent">
            Kembali
          </Link>
          {isOwn && s.status === "active" && (
            <Link href={`/sesi/${s.id}`} className="inline-flex min-h-11 items-center rounded-sm border border-rule px-5 hover:border-ink">
              Lanjutkan sesi
            </Link>
          )}
        </div>
      </section>

      <section aria-labelledby="transkrip-h" className="lg:col-span-8 lg:border-l lg:border-rule lg:pl-8">
        <h2 id="transkrip-h" className="font-mono text-label uppercase text-ink-2">
          Transkrip ({turns.length} giliran)
        </h2>
        {turns.length === 0 ? (
          <p className="mt-4 text-ink-2">Tidak ada percakapan yang tercatat.</p>
        ) : (
          <ol className="mt-4 space-y-4">
            {turns.map((m) => (
              <li key={m.seq} className="grid grid-cols-[2.5rem_1fr] gap-3 leading-relaxed">
                <span className="pt-0.5 font-mono text-label text-ink-2">{String(m.seq).padStart(2, "0")}</span>
                <p>
                  <span className={`mr-2 font-mono text-label uppercase ${m.speaker === "character" ? "text-accent" : "text-ink-2"}`}>
                    {m.speaker === "character" ? s.v!.client_name : isOwn ? "Kamu" : "Pelajar"}
                  </span>
                  {m.text}
                </p>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

export default function SelesaiPage({ params }: PageProps<"/sesi/[id]/selesai">) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-md bg-paper-2" />}>
      <Summary params={params} />
    </Suspense>
  );
}

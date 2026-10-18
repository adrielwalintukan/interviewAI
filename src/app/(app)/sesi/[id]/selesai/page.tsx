import Link from "next/link";
import { notFound } from "next/navigation";
import { after } from "next/server";
import { Suspense } from "react";
import { requireUser } from "@/features/auth/dal";
import { gradeSession } from "@/features/grading/grade";
import { regradeSession } from "@/features/grading/actions";
import { RefreshWhileGrading } from "@/features/grading/refresh-while-grading";
import { applyOverride, revealMissed, triggerQuestion, type GradeResult, type Override, type Turn } from "@/features/grading/result";
import { ReviewForm } from "@/features/grading/review-form";
import { loadScenarioContent } from "@/features/interview/context";
import { DownloadPdfButton } from "@/features/interview/download-pdf";
import { FACT_CATEGORIES } from "@/features/scenario/schema";
import { createClient } from "@/lib/supabase/server";
import { isPast } from "@/lib/time";

export const metadata = { title: "Wawancara selesai — Interview AI" };
// Grading may run here (after the response) when the timer closed the session without "Akhiri".
export const maxDuration = 300;

type Row = {
  id: string;
  user_id: string;
  kind: "assignment" | "library" | "preview";
  mode: string;
  status: string;
  started_at: string;
  ends_at: string;
  ended_at: string | null;
  scenario_version_id: string;
  assignment: { class_id: string; due_at: string | null; classes: { owner_id: string } | null } | null;
  v: { title: string; client_name: string } | null;
};

const LEVEL_LABEL = { 1: "Kurang", 2: "Cukup", 3: "Baik", 4: "Sangat baik" } as const;

type Graded = { score: number; aiScore: number; result: GradeResult; override: Override | null; comment: string | null; reviewed: boolean };

async function Report({ session, graded, turns, isOwn, isReviewer }: { session: Row; graded: Graded; turns: Turn[]; isOwn: boolean; isReviewer: boolean }) {
  const { result } = graded;
  // Fact text is secret: read with the service role only now that RLS has let this user see the session.
  const scenario = await loadScenarioContent(session.scenario_version_id);
  if (!scenario) return null;

  const facts = new Map(scenario.content.facts.map((f) => [f.id, f]));
  const found = result.facts.filter((f) => f.found);
  const missed = result.facts.filter((f) => !f.found);
  const reveal = revealMissed(session.kind, isPast(session.assignment?.due_at));
  const you = isOwn ? "kamu" : "pelajar";
  const q = result.questionQuality;

  return (
    <section aria-labelledby="laporan-h" className="space-y-10">
      <div>
        <h2 id="laporan-h" className="font-mono text-label uppercase text-accent">
          Laporan
        </h2>
        <p className="mt-3 max-w-prose text-lg leading-relaxed">{result.summary}</p>
        {graded.comment && (
          <blockquote className="mt-6 border-l-2 border-ink pl-4">
            <p className="font-mono text-label uppercase text-ink-2">Komentar pengajar</p>
            <p className="mt-1 whitespace-pre-line leading-relaxed">{graded.comment}</p>
          </blockquote>
        )}
      </div>

      <div>
        <h3 className="font-mono text-label uppercase text-ink-2">Rubrik</h3>
        <ul className="mt-3 divide-y divide-rule border-y border-rule">
          {applyOverride(result, graded.override).map((c) => (
            <li key={c.criterion} className="grid gap-1 py-3 sm:grid-cols-[1fr_auto] sm:gap-x-6">
              <p className="font-medium">{c.criterion}</p>
              <p className="font-mono text-label uppercase text-ink-2 sm:row-span-2 sm:text-right">
                <span className="font-display text-2xl tabular-nums text-ink">{c.level}</span>/4 · {LEVEL_LABEL[c.level]}
                {graded.reviewed && (
                  <span className="block">
                    AI: {c.ai}/4 · {c.level !== c.ai ? "diubah pengajar" : "dikonfirmasi pengajar"}
                  </span>
                )}
              </p>
              <p className="text-sm text-ink-2">{c.rationale}</p>
            </li>
          ))}
        </ul>
        <p className="mt-3 font-mono text-label uppercase text-ink-2">
          Pertanyaan: {q.open} terbuka · {q.closed} tertutup · {q.leading} menggiring · {q.followUps} lanjutan
        </p>
      </div>

      <div>
        <h3 className="font-mono text-label uppercase text-ink-2">
          Fakta ditemukan ({found.length} dari {result.facts.length})
        </h3>
        {found.length === 0 ? (
          <p className="mt-3 text-ink-2">Belum ada fakta tersembunyi yang tergali.</p>
        ) : (
          <ul className="mt-3 space-y-4">
            {found.map((f) => {
              const fact = facts.get(f.factId);
              const trigger = triggerQuestion(f.evidenceSeq, turns);
              return (
                <li key={f.factId} className="break-inside-avoid border-l-2 border-ochre pl-4">
                  <p>
                    <mark className="bg-ochre/25 px-0.5 text-ink">{fact?.content}</mark>
                  </p>
                  {trigger && (
                    <p className="mt-1 text-sm text-ink-2">
                      Dibuka oleh pertanyaan {you}{" "}
                      <a href={`#giliran-${trigger.seq}`} className="font-mono underline underline-offset-4 hover:text-ink">
                        #{trigger.seq}
                      </a>
                      : “{trigger.text}”
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {missed.length > 0 && (
        <div>
          <h3 className="font-mono text-label uppercase text-ink-2">Fakta terlewat ({missed.length})</h3>
          {reveal ? (
            <ul className="mt-3 space-y-2">
              {missed.map((f) => {
                const fact = facts.get(f.factId);
                return (
                  <li key={f.factId} className="text-ink-2">
                    <span className="mr-2 font-mono text-label uppercase">{fact ? FACT_CATEGORIES[fact.category] : ""}</span>
                    {fact?.content}
                  </li>
                );
              })}
            </ul>
          ) : (
            <>
              <p className="mt-3 flex flex-wrap gap-2">
                {missed.map((f) => {
                  const fact = facts.get(f.factId);
                  return (
                    <span key={f.factId} className="rounded-sm border border-rule px-2 py-1 font-mono text-label uppercase text-ink-2">
                      {fact ? FACT_CATEGORIES[fact.category] : "—"}
                    </span>
                  );
                })}
              </p>
              <p className="mt-2 text-sm text-ink-2">Isi fakta yang terlewat dibuka setelah tenggat tugas lewat.</p>
            </>
          )}
        </div>
      )}

      <div>
        <h3 className="font-mono text-label uppercase text-ink-2">Coba tanyakan</h3>
        <ol className="mt-3 list-decimal space-y-2 pl-5">
          {result.betterQuestions.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ol>
      </div>

      {isReviewer && (
        <div className="border-t border-rule pt-8 print:hidden">
          <h3 className="font-mono text-label uppercase text-accent">Tinjau nilai</h3>
          {result.anomalies.length > 0 && (
            <ul className="mt-3 space-y-1 text-sm text-ink-2">
              {result.anomalies.map((a) => (
                <li key={a}>Catatan AI: {a}</li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-sm text-ink-2">Ubah level kriteria bila penilaian AI kurang tepat. Nilai final dihitung ulang dengan rumus yang sama.</p>
          <div className="mt-5 max-w-md">
            <ReviewForm sessionId={session.id} criteria={applyOverride(result, graded.override)} comment={graded.comment} />
          </div>
        </div>
      )}
    </section>
  );
}

async function Summary({ params }: { params: PageProps<"/sesi/[id]/selesai">["params"] }) {
  const user = await requireUser({ roles: ["pelajar", "pengajar", "admin"] });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const supabase = await createClient();
  // RLS: the learner, their class teacher, or an admin.
  const { data: s } = await supabase
    .from("sessions")
    .select("id, user_id, kind, mode, status, started_at, ends_at, ended_at, scenario_version_id, assignment:assignments(class_id, due_at, classes(owner_id)), v:scenario_versions(title, client_name)")
    .eq("id", id)
    .maybeSingle<Row>();
  if (!s?.v) notFound();
  const { data: messages } = await supabase.from("messages").select("seq, speaker, text").eq("session_id", id).order("seq");
  const turns = (messages ?? []) as Turn[];
  const learnerTurns = turns.filter((m) => m.speaker === "learner").length;
  const minutes = s.ended_at ? Math.max(1, Math.round((Date.parse(s.ended_at) - Date.parse(s.started_at)) / 60_000)) : null;
  const back = s.assignment ? `/kelas/${s.assignment.class_id}` : s.kind === "preview" ? "/skenario" : "/pustaka";
  const isOwn = s.user_id === user.id;
  const isReviewer = user.role === "admin" || (user.role === "pengajar" && s.assignment?.classes?.owner_id === user.id);
  const canRegrade = s.status === "grading_failed" && (isReviewer || (isOwn && s.kind !== "assignment"));

  const running = s.status === "active" && !isPast(new Date(Date.parse(s.ends_at) + 60_000).toISOString());
  // Ended (or timed out) but not graded yet: the owner's visit kicks off grading; claim_grading dedupes.
  const pending = learnerTurns > 0 && (s.status === "grading" || s.status === "ended" || (s.status === "active" && !running));
  if (pending && isOwn) after(() => gradeSession(s.id));

  // RLS: same readers as the session.
  const { data: ev } = await supabase
    .from("evaluations")
    .select("ai_result, ai_score, final_score, override, comment, reviewer_id, reviewed_at, review_seen_at")
    .eq("session_id", id)
    .maybeSingle();
  const graded: Graded | null =
    s.status === "graded" && ev
      ? {
          score: ev.final_score as number,
          aiScore: ev.ai_score as number,
          result: ev.ai_result as GradeResult,
          override: ev.override as Override | null,
          comment: ev.comment as string | null,
          reviewed: ev.reviewer_id !== null,
        }
      : null;
  // The learner opened the report: the teacher-review notice on the dashboard is now read (each review resets it).
  if (isOwn && ev?.reviewed_at && !ev.review_seen_at) await supabase.rpc("mark_review_seen", { p_session_id: id });

  return (
    <div className="grid gap-10 lg:grid-cols-12">
      <section className="lg:col-span-4">
        <p className="font-mono text-label uppercase text-accent">{running ? "Sesi berjalan" : "Wawancara selesai"}</p>
        <h1 className="mt-3 font-display text-4xl font-medium tracking-tight text-balance">{s.v.title}</h1>
        {graded && (
          <p className="mt-6">
            <span className="block font-mono text-label uppercase text-ink-2">{graded.reviewed ? "Nilai final" : "Nilai"}</span>
            <span className="font-display text-7xl tabular-nums">{graded.score}</span>
            <span className="font-mono text-label uppercase text-ink-2"> / 100</span>
            {graded.reviewed && (
              <span className="block font-mono text-label uppercase text-ink-2">Nilai AI {graded.aiScore} · ditinjau pengajar</span>
            )}
          </p>
        )}
        <dl className="mt-8 grid grid-cols-2 gap-6 border-t border-rule pt-6">
          <div>
            <dt className="font-mono text-label uppercase text-ink-2">{isOwn ? "Pertanyaanmu" : "Pertanyaan"}</dt>
            <dd className="font-display text-5xl tabular-nums">{learnerTurns}</dd>
          </div>
          <div>
            <dt className="font-mono text-label uppercase text-ink-2">Durasi</dt>
            <dd className="font-display text-5xl tabular-nums">{minutes ?? "—"}</dd>
            <dd className="font-mono text-label uppercase text-ink-2">menit</dd>
          </div>
        </dl>
        {!running && s.status !== "graded" && (
          <p role="status" className="mt-8 border-l-2 border-ochre pl-4 text-sm text-ink-2 print:hidden">
            {pending
              ? "Penilaian sedang diproses — biasanya kurang dari satu menit. Halaman ini akan diperbarui sendiri."
              : s.status === "grading_failed"
                ? canRegrade
                  ? "Penilaian gagal diproses. Transkrip sudah tersimpan; coba nilai ulang."
                  : "Penilaian gagal diproses. Transkrip sudah tersimpan; pengajarmu bisa menilai ulang."
                : "Tidak dinilai karena belum ada pertanyaan dalam sesi ini."}
          </p>
        )}
        {pending && <RefreshWhileGrading />}
        <div className="mt-8 flex flex-wrap gap-3 print:hidden">
          <Link href={back} className="inline-flex min-h-11 items-center rounded-sm bg-ink px-5 text-paper hover:bg-accent">
            Kembali
          </Link>
          {turns.length > 0 && <DownloadPdfButton fileName={`Transkrip ${s.v.title} ${s.started_at.slice(0, 10)}`} />}
          {canRegrade && (
            <form action={regradeSession}>
              <input type="hidden" name="sessionId" value={s.id} />
              <button type="submit" className="inline-flex min-h-11 items-center rounded-sm border border-ink px-5 hover:bg-ink hover:text-paper">
                Nilai ulang
              </button>
            </form>
          )}
          {isOwn && running && (
            <Link href={`/sesi/${s.id}`} className="inline-flex min-h-11 items-center rounded-sm border border-rule px-5 hover:border-ink">
              Lanjutkan sesi
            </Link>
          )}
        </div>
      </section>

      <div className="space-y-12 lg:col-span-8 lg:border-l lg:border-rule lg:pl-8 print:border-0 print:pl-0">
        {graded && (
          <Suspense fallback={<div className="h-64 animate-pulse rounded-md bg-paper-2" />}>
            <Report session={s} graded={graded} turns={turns} isOwn={isOwn} isReviewer={isReviewer} />
          </Suspense>
        )}

        <section aria-labelledby="transkrip-h">
          <h2 id="transkrip-h" className="font-mono text-label uppercase text-ink-2">
            Transkrip ({turns.length} giliran)
          </h2>
          {turns.length === 0 ? (
            <p className="mt-4 text-ink-2">Tidak ada percakapan yang tercatat.</p>
          ) : (
            <ol className="mt-4 space-y-4">
              {turns.map((m) => (
                <li key={m.seq} id={`giliran-${m.seq}`} className="grid scroll-mt-6 grid-cols-[2.5rem_1fr] gap-3 leading-relaxed break-inside-avoid target:bg-ochre/15">
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

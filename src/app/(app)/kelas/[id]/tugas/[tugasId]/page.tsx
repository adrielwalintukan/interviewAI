import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { requireUser } from "@/features/auth/dal";
import { DueLabel, DueState, LocalTime } from "@/features/classroom/assignments";
import { LEARNER_STATUS_LABEL, canSeeFactContent, learnerStatus, missedFacts, scoreHistogram } from "@/features/grading/class-dashboard";
import type { GradeResult } from "@/features/grading/result";
import { loadScenarioContent } from "@/features/interview/context";
import { STATUS_LABEL } from "@/features/interview/session-history";
import { FACT_CATEGORIES } from "@/features/scenario/schema";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Hasil tugas — Interview AI" };

type AssignmentRow = {
  id: string;
  due_at: string | null;
  max_attempts: number;
  scenario_version_id: string;
  classes: { name: string; owner_id: string } | null;
  v: { title: string; scenarios: { author_id: string } | null } | null;
};
type SessionRow = {
  id: string;
  user_id: string;
  status: string;
  started_at: string;
  profiles: { display_name: string } | null;
  evaluations: { final_score: number; reviewer_id: string | null; ai_result: Pick<GradeResult, "facts"> } | null;
};
type Member = { user_id: string; profiles: { display_name: string; username: string | null } | null };

const RANGES = Array.from({ length: 10 }, (_, i) => (i === 9 ? "90–100" : `${i * 10}–${i * 10 + 9}`));

async function AssignmentResults({ params }: { params: PageProps<"/kelas/[id]/tugas/[tugasId]">["params"] }) {
  const user = await requireUser({ roles: ["pengajar", "admin"] });
  const { id, tugasId } = await params;
  if (![id, tugasId].every((x) => /^[0-9a-f-]{36}$/i.test(x))) notFound();

  const supabase = await createClient();
  // RLS: class owner, members and admins read the assignment; only the owner or an admin gets this page.
  // scenarios(author_id) is readable by its author and admins only, so it is null for other teachers.
  const { data: a, error: aError } = await supabase
    .from("assignments")
    .select("id, due_at, max_attempts, scenario_version_id, classes(name, owner_id), v:scenario_versions(title, scenarios!scenario_id(author_id))")
    .eq("id", tugasId)
    .eq("class_id", id)
    .maybeSingle<AssignmentRow>();
  if (aError) throw aError; // a failed query must not read as 404
  if (!a || !(user.role === "admin" || a.classes?.owner_id === user.id)) notFound();

  const [{ data: members, error: membersError }, { data: sessions, error: sessionsError }, { data: scores, error: scoresError }, scenario] = await Promise.all([
    supabase
      .from("class_members")
      .select("user_id, profiles!inner(display_name, username, role)")
      .eq("class_id", id)
      .eq("profiles.role", "pelajar")
      .order("joined_at", { ascending: true })
      .returns<Member[]>(),
    // ai_result holds fact ids/flags only; it is aggregated below and never rendered as is.
    supabase
      .from("sessions")
      .select("id, user_id, status, started_at, profiles(display_name), evaluations(final_score, reviewer_id, ai_result)")
      .eq("assignment_id", tugasId)
      .order("started_at", { ascending: false })
      .returns<SessionRow[]>(),
    supabase.from("assignment_scores").select("user_id, attempts, best_score").eq("assignment_id", tugasId),
    // Access checked above. Fact content is dropped by missedFacts() unless canSeeFactContent().
    loadScenarioContent(a.scenario_version_id),
  ]);
  const failed = membersError || sessionsError || scoresError || !scenario;

  const byUser = new Map<string, SessionRow[]>();
  for (const s of sessions ?? []) byUser.set(s.user_id, [...(byUser.get(s.user_id) ?? []), s]);
  const scoreOf = new Map((scores ?? []).map((s) => [s.user_id, s]));

  const learners = (members ?? []).map((m) => {
    const own = byUser.get(m.user_id) ?? [];
    const best = scoreOf.get(m.user_id)?.best_score ?? null;
    // Review link: the attempt that counts (best final score), else the latest attempt.
    const link = own.find((s) => s.evaluations && s.evaluations.final_score === best) ?? own[0];
    return {
      id: m.user_id,
      name: m.profiles?.display_name ?? "—",
      status: learnerStatus(own.map((s) => s.status)),
      attempts: scoreOf.get(m.user_id)?.attempts ?? 0,
      best,
      linkId: link?.id ?? null,
      graded: own.flatMap((s) => (s.status === "graded" && s.evaluations ? [s.evaluations.ai_result] : [])),
    };
  });
  const bestScores = learners.flatMap((l) => (l.best === null ? [] : [l.best]));
  const bins = scoreHistogram(bestScores);
  const maxBin = Math.max(1, ...bins);
  const missed = scenario ? missedFacts(learners.map((l) => l.graded), scenario.content.facts, canSeeFactContent(user, a.v?.scenarios?.author_id)).slice(0, 5) : [];
  const done = learners.filter((l) => l.status === "dinilai").length;

  return (
    <>
      <Link href={`/kelas/${id}`} className="-my-3 inline-flex min-h-11 items-center font-mono text-label uppercase text-ink-2 hover:text-ink">
        ← {a.classes?.name}
      </Link>
      <h1 className="mt-4 font-display text-display font-medium tracking-tight">{a.v?.title}</h1>
      <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 font-mono text-label uppercase text-ink-2">
        <DueLabel iso={a.due_at} />
        <DueState iso={a.due_at} />
        <span>{a.max_attempts}× percobaan</span>
      </p>

      {failed ? (
        <p role="alert" className="mt-10 border-l-2 border-accent pl-4 text-accent">
          Hasil tugas gagal dimuat. Muat ulang halaman ini; bila masih gagal, hubungi admin.
        </p>
      ) : (
        <>
          <div className="mt-10 grid gap-12 lg:grid-cols-12">
            <section aria-labelledby="pelajar-h" className="min-w-0 lg:col-span-7">
              <h2 id="pelajar-h" className="font-mono text-label uppercase text-accent">
                01 — Pelajar · {done} dari {learners.length} dinilai
              </h2>
              {learners.length === 0 ? (
                <p className="mt-4 border-l-2 border-rule pl-4 text-ink-2">Belum ada pelajar di kelas ini.</p>
              ) : (
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full min-w-[32rem] border-y border-rule text-left text-sm">
                    <thead className="font-mono text-label uppercase text-ink-2">
                      <tr className="border-b border-rule">
                        <th scope="col" className="py-2 pr-3 font-normal">Pelajar</th>
                        <th scope="col" className="py-2 pr-3 font-normal">Status</th>
                        <th scope="col" className="py-2 pr-3 text-right font-normal">Percobaan</th>
                        <th scope="col" className="py-2 pr-3 text-right font-normal">Nilai terbaik</th>
                        <th scope="col" className="py-2 font-normal"><span className="sr-only">Tinjau</span></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-rule">
                      {learners.map((l) => (
                        <tr key={l.id}>
                          <th scope="row" className="py-2 pr-3 font-medium">{l.name}</th>
                          <td className={`py-2 pr-3 ${l.status === "belum" ? "text-ink-2" : ""}`}>{LEARNER_STATUS_LABEL[l.status]}</td>
                          <td className="py-2 pr-3 text-right tabular-nums">
                            {l.attempts}/{a.max_attempts}
                          </td>
                          <td className="py-2 pr-3 text-right font-display text-xl tabular-nums">{l.best ?? "—"}</td>
                          <td className="py-1 text-right">
                            {l.linkId && (
                              <Link href={`/sesi/${l.linkId}/selesai`} className="inline-flex min-h-11 items-center rounded-sm border border-rule px-3 hover:border-ink">
                                Tinjau<span className="sr-only"> wawancara {l.name}</span>
                              </Link>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <div className="flex min-w-0 flex-col gap-12 lg:col-span-5 lg:border-l lg:border-rule lg:pl-8">
              <section aria-labelledby="sebaran-h">
                <h2 id="sebaran-h" className="font-mono text-label uppercase text-accent">
                  02 — Sebaran nilai terbaik
                </h2>
                {bestScores.length === 0 ? (
                  <p className="mt-4 text-ink-2">Belum ada nilai.</p>
                ) : (
                  <ol className="mt-4 space-y-1.5">
                    {bins.map((n, i) => (
                      <li key={RANGES[i]} className="grid grid-cols-[4.5rem_1fr_2rem] items-center gap-3 font-mono text-label">
                        <span className="text-ink-2">{RANGES[i]}</span>
                        <span className="h-3 bg-paper-2" aria-hidden>
                          <span className="block h-full bg-ink" style={{ width: `${(n / maxBin) * 100}%` }} />
                        </span>
                        <span className="text-right tabular-nums">
                          {n}
                          <span className="sr-only"> pelajar</span>
                        </span>
                      </li>
                    ))}
                  </ol>
                )}
              </section>

              <section aria-labelledby="terlewat-h">
                <h2 id="terlewat-h" className="font-mono text-label uppercase text-accent">
                  03 — Fakta paling sering terlewat
                </h2>
                {missed.length === 0 ? (
                  <p className="mt-4 text-ink-2">{done === 0 ? "Belum ada wawancara yang dinilai." : "Tidak ada fakta yang terlewat."}</p>
                ) : (
                  <>
                    <ol className="mt-4 divide-y divide-rule border-y border-rule">
                      {missed.map((f) => (
                        <li key={f.factId} className="flex gap-3 py-2.5 text-sm">
                          <span className="min-w-0 flex-1">
                            <span className="mr-2 font-mono text-label uppercase text-ink-2">{FACT_CATEGORIES[f.category]}</span>
                            {f.content ?? <span className="text-ink-2">Isi fakta hanya terlihat oleh penulis skenario.</span>}
                          </span>
                          <span className="shrink-0 font-mono tabular-nums">
                            {f.missed}/{f.of}
                            <span className="sr-only"> pelajar melewatkannya</span>
                          </span>
                        </li>
                      ))}
                    </ol>
                    <p className="mt-2 text-sm text-ink-2">Dihitung dari pelajar yang sudah dinilai: terlewat bila tidak ditemukan di percobaan mana pun.</p>
                  </>
                )}
              </section>
            </div>
          </div>

          <section aria-labelledby="percobaan-h" className="mt-16 border-t border-rule pt-10 lg:max-w-4xl">
            <h2 id="percobaan-h" className="font-mono text-label uppercase text-accent">
              04 — Semua percobaan ({sessions?.length ?? 0})
            </h2>
            {!sessions?.length ? (
              <p className="mt-4 border-l-2 border-rule pl-4 text-ink-2">Belum ada pelajar yang mengerjakan tugas ini.</p>
            ) : (
              <ol className="mt-4 divide-y divide-rule border-y border-rule">
                {sessions.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{r.profiles?.display_name ?? "—"}</p>
                      <p className="font-mono text-label uppercase text-ink-2">
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
            )}
          </section>
        </>
      )}
    </>
  );
}

export default function AssignmentResultsPage({ params }: PageProps<"/kelas/[id]/tugas/[tugasId]">) {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-md bg-paper-2" />}>
      <AssignmentResults params={params} />
    </Suspense>
  );
}

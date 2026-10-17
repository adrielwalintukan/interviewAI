import Link from "next/link";
import type { ReactNode } from "react";
import { LocalTime } from "@/features/classroom/assignments";

export type HistoryRow = {
  id: string;
  status: string;
  started_at: string;
  v: { title: string; client_name: string } | null;
};

export const MAX_DAILY_LIBRARY_SESSIONS = 3;

export function calculateRemainingQuota(todayCount: number): number {
  return Math.max(0, MAX_DAILY_LIBRARY_SESSIONS - todayCount);
}

export const STATUS_LABEL: Record<string, string> = {
  active: "Berjalan",
  ended: "Selesai",
  grading: "Penilaian diproses",
  graded: "Sudah dinilai",
  grading_failed: "Penilaian gagal",
};

export function SessionHistory({
  rows,
  empty = "Belum ada wawancara. Transkripmu akan tersimpan di sini.",
}: {
  rows: HistoryRow[];
  empty?: ReactNode;
}) {
  if (rows.length === 0) {
    return typeof empty === "string" ? (
      <p className="border-l-2 border-rule pl-4 text-ink-2">{empty}</p>
    ) : (
      <>{empty}</>
    );
  }

  return (
    <ol className="divide-y divide-rule border-y border-rule">
      {rows.map((s) => (
        <li key={s.id} className="flex items-center gap-4 py-4">
          <div className="min-w-0 flex-1">
            <p className="font-display text-lg leading-tight">{s.v?.title}</p>
            <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 font-mono text-label uppercase text-ink-2">
              <LocalTime iso={s.started_at} />
              <span className={s.status === "active" ? "text-accent" : undefined}>
                {STATUS_LABEL[s.status] ?? s.status}
              </span>
            </p>
          </div>
          <Link
            href={`/sesi/${s.id}/selesai`}
            className="inline-flex min-h-11 shrink-0 items-center rounded-sm border border-rule px-4 text-sm hover:border-ink"
          >
            Transkrip<span className="sr-only"> {s.v?.title}</span>
          </Link>
        </li>
      ))}
    </ol>
  );
}

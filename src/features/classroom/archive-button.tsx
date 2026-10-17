"use client";

import { SubmitButton } from "@/components/ui/form";
import { archiveClass, unarchiveClass } from "./actions";

export function ArchiveClassButton({
  classId,
  isArchived,
}: {
  classId: string;
  isArchived: boolean;
}) {
  const message = isArchived
    ? "Buka kembali arsip kelas ini? Pelajar akan dapat bergabung kembali dan melanjutkan tugas."
    : "Arsipkan kelas ini? Pelajar tidak bisa bergabung dan tugas tidak bisa dimulai lagi. Seluruh riwayat dan transkrip tetap dapat diakses.";

  return (
    <form
      action={isArchived ? unarchiveClass : archiveClass}
      onSubmit={(e) => {
        if (!window.confirm(message)) {
          e.preventDefault();
        }
      }}
      className="inline-block"
    >
      <input type="hidden" name="classId" value={classId} />
      <SubmitButton
        variant="ghost"
        pending={isArchived ? "Membuka arsip…" : "Mengarsipkan…"}
        className="min-h-9 px-3 text-xs text-ink-2 hover:text-ink"
      >
        {isArchived ? "Buka arsip kelas" : "Arsipkan kelas"}
      </SubmitButton>
    </form>
  );
}

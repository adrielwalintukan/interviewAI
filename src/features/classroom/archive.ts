/**
 * Helper partisi kelas aktif dan diarsipkan untuk Dashboard.
 */
export function partitionClasses<T extends { archived_at: string | null }>(
  classes: T[],
): { active: T[]; archived: T[] } {
  const active: T[] = [];
  const archived: T[] = [];
  for (const c of classes) {
    if (c.archived_at) {
      archived.push(c);
    } else {
      active.push(c);
    }
  }
  return { active, archived };
}

/**
 * Memeriksa apakah kelas dapat menerima penugasan baru (fail-closed).
 */
export function checkClassCanAcceptAssignment(
  cls: { archived_at: string | null } | null,
  error: unknown,
): { ok: true } | { ok: false; error: string } {
  if (error || !cls) {
    return { ok: false, error: "Kelas tidak ditemukan." };
  }
  if (cls.archived_at) {
    return { ok: false, error: "Kelas sudah diarsipkan. Tidak dapat membuat tugas baru." };
  }
  return { ok: true };
}


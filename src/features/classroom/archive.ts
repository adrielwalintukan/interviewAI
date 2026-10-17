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

/**
 * <input type="datetime-local"> gives wall-clock time without a zone. The form also sends the
 * browser's Date#getTimezoneOffset() (minutes, positive west of UTC), so WIB/WITA/WIT all resolve.
 */
export function toDueInstant(dueLocal: string, tzOffsetMin: number): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(dueLocal)) return null;
  const asUtc = Date.parse(`${dueLocal}:00Z`);
  return Number.isNaN(asUtc) ? null : new Date(asUtc + tzOffsetMin * 60_000).toISOString();
}

/** "Sen, 20 Okt 2026, 23.59 WITA"-style label in the viewer's zone. */
export function formatDue(iso: string, timeZone?: string): string {
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
    timeZoneName: "short",
  }).format(new Date(iso));
}

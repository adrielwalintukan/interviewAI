// Request-time clock reads for Server Components (kept out of render bodies for react-hooks/purity).
export const isPast = (iso: string | null | undefined) => Boolean(iso && Date.parse(iso) < Date.now());
export const nowIso = () => new Date().toISOString();

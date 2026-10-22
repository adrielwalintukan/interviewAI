import { z } from "zod";

// docs/ai-design.md §1. Draft = anything the editor can autosave; Content = what may be published.

export const LANGUAGES = { id: "Bahasa Indonesia", en: "English" } as const;
export const LEVELS = { smk: "SMK / SMA", s1: "Perguruan tinggi", umum: "Umum" } as const;
export const FACT_CATEGORIES = {
  fungsional: "Fungsional",
  "non-fungsional": "Non-fungsional",
  bisnis: "Bisnis",
  kendala: "Kendala",
  stakeholder: "Stakeholder",
} as const;

const text = (max: number) => z.string().trim().max(max);
const required = (max: number, label: string) => z.string().trim().min(1, `${label} wajib diisi`).max(max);
const scale = z.number().int().min(1).max(3);

export const factSchema = z.object({
  id: z.string().regex(/^F\d{1,2}$/),
  category: z.enum(Object.keys(FACT_CATEGORIES) as [keyof typeof FACT_CATEGORIES]),
  content: required(400, "Isi fakta"),
  weight: scale,
  difficulty: scale,
  triggerHint: required(200, "Pemicu"),
});

export const criterionSchema = z.object({
  criterion: required(80, "Nama kriteria"),
  weight: z.number().int().min(1).max(5),
  descriptors: z.object({ 1: required(200, "Deskriptor 1"), 2: required(200, "Deskriptor 2"), 3: required(200, "Deskriptor 3"), 4: required(200, "Deskriptor 4") }),
});

export const personaSchema = z.object({
  name: required(80, "Nama klien"),
  age: z.number().int().min(15).max(90),
  occupation: required(120, "Pekerjaan klien"),
  background: required(1200, "Latar belakang"),
  speakingStyle: required(300, "Gaya bicara"),
  attitude: required(300, "Sikap"),
  openingLine: required(300, "Kalimat pembuka"),
});

export const contentSchema = z.object({
  title: required(120, "Judul"),
  language: z.enum(["id", "en"]),
  level: z.enum(["smk", "s1", "umum"]),
  learnerRole: required(200, "Peran pelajar"),
  objective: required(500, "Tujuan wawancara"),
  characterId: z.string().min(1, "Pilih karakter"),
  persona: personaSchema,
  facts: z.array(factSchema).min(3, "Minimal 3 fakta tersembunyi").max(20, "Maksimal 20 fakta"),
  rubric: z.array(criterionSchema).min(1, "Minimal 1 kriteria rubrik").max(8, "Maksimal 8 kriteria"),
});
export type ScenarioContent = z.infer<typeof contentSchema>;

/** Autosaved editor state: every field optional, but still bounded so a draft can't balloon. */
export const draftSchema = z.object({
  summary: text(1000).optional(),
  title: text(120).optional(),
  language: z.enum(["id", "en"]).optional(),
  level: z.enum(["smk", "s1", "umum"]).optional(),
  learnerRole: text(200).optional(),
  objective: text(500).optional(),
  characterId: text(40).optional(),
  persona: z
    .object({
      name: text(80),
      age: z.number().int().min(0).max(120),
      occupation: text(120),
      background: text(1200),
      speakingStyle: text(300),
      attitude: text(300),
      openingLine: text(300),
    })
    .partial()
    .optional(),
  facts: z
    .array(
      z
        .object({
          id: text(4),
          category: z.enum(Object.keys(FACT_CATEGORIES) as [keyof typeof FACT_CATEGORIES]),
          content: text(400),
          weight: scale,
          difficulty: scale,
          triggerHint: text(200),
        })
        .partial(),
    )
    .max(20)
    .optional(),
  rubric: z
    .array(
      z
        .object({
          criterion: text(80),
          weight: z.number().int().min(1).max(5),
          descriptors: z.object({ 1: text(200), 2: text(200), 3: text(200), 4: text(200) }).partial(),
        })
        .partial(),
    )
    .max(8)
    .optional(),
});
export type ScenarioDraft = z.infer<typeof draftSchema>;

/** Human-readable publish blockers, in editor section order. */
export function publishProblems(draft: ScenarioDraft, characterIds: readonly string[]): string[] {
  const parsed = contentSchema.safeParse(draft);
  const problems = parsed.success
    ? []
    : parsed.error.issues.map((i) => {
        const where = i.path.map((p) => (typeof p === "number" ? `#${p + 1}` : String(p))).join(" › ");
        return where ? `${where}: ${i.message}` : i.message;
      });
  if (draft.characterId && !characterIds.includes(draft.characterId)) problems.push("characterId: karakter tidak tersedia");
  return problems;
}

/** Fresh, sequential fact ids (F1, F2…) so the grader can cite them. */
export function renumberFacts<T extends { id?: string }>(facts: T[]): (T & { id: string })[] {
  return facts.map((f, i) => ({ ...f, id: `F${i + 1}` }));
}

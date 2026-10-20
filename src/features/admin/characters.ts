import { z } from "zod";

/**
 * Gemini prebuilt voices, verified 2026-10-20 at https://ai.google.dev/gemini-api/docs/speech-generation
 * ("Voice options"). Live native-audio models accept the same set (ai.google.dev/gemini-api/docs/live-guide),
 * so one voice serves both Live and mode-hemat TTS.
 */
export const GEMINI_VOICES = [
  "Zephyr", "Puck", "Charon", "Kore", "Fenrir", "Leda", "Orus", "Aoede", "Callirrhoe", "Autonoe",
  "Enceladus", "Iapetus", "Umbriel", "Algieba", "Despina", "Erinome", "Algenib", "Rasalgethi", "Laomedeia", "Achernar",
  "Alnilam", "Schedar", "Gacrux", "Pulcherrima", "Achird", "Zubenelgenubi", "Vindemiatrix", "Sadachbia", "Sadaltager", "Sulafat",
] as const;

export const GENDER_LABEL = { female: "Perempuan", male: "Laki-laki" } as const;

/** Mirrors the `characters` table constraints (supabase/migrations/20261014100000_scenarios.sql). */
export const characterSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]{2,40}$/, "ID: 2–40 huruf kecil, angka, atau tanda hubung."),
  name: z.string().trim().min(1, "Nama wajib diisi.").max(60),
  occupation: z.string().trim().min(1, "Pekerjaan wajib diisi.").max(80),
  age_range: z.string().trim().min(1, "Rentang usia wajib diisi.").max(20),
  gender: z.enum(["female", "male"], "Pilih gender."),
  live_voice: z.enum(GEMINI_VOICES, "Pilih suara dari daftar."),
  portrait_hue: z.coerce.number().int().min(0, "Warna potret 0–359.").max(359, "Warna potret 0–359."),
  sort: z.coerce.number().int().min(0, "Urutan 0–999.").max(999, "Urutan 0–999."),
});

export type CharacterRow = z.infer<typeof characterSchema> & { active: boolean };

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/features/auth/dal";
import { extractJson } from "@/lib/llm/extract-json";
import { complete } from "@/lib/llm/gateway";
import { buildGeneratorMessages } from "@/lib/llm/prompts/generator";
import { createClient } from "@/lib/supabase/server";
import { contentSchema, draftSchema, publishProblems, renumberFacts, type ScenarioDraft } from "./schema";

const scenarioId = z.uuid();

async function loadOwnDraft(id: string) {
  const supabase = await createClient();
  // RLS: only the author can read a scenario row.
  const { data } = await supabase.from("scenarios").select("id, draft").eq("id", id).maybeSingle();
  return data ? { supabase, draft: draftSchema.catch({}).parse(data.draft) } : null;
}

export async function createScenario(): Promise<void> {
  const user = await requireUser({ roles: ["pengajar"] });
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("scenarios")
    .insert({ author_id: user.id, draft: { language: "id", level: "smk" } })
    .select("id")
    .single();
  if (error || !data) redirect("/skenario?error=create");
  redirect(`/skenario/${data.id}`);
}

export type SaveResult = { ok: true; savedAt: string } | { ok: false; error: string };

export async function saveDraft(id: string, draft: ScenarioDraft): Promise<SaveResult> {
  await requireUser({ roles: ["pengajar"] });
  const parsedId = scenarioId.safeParse(id);
  const parsed = draftSchema.safeParse(draft);
  if (!parsedId.success || !parsed.success) return { ok: false, error: "Draf tidak valid." };

  const supabase = await createClient();
  const savedAt = new Date().toISOString();
  const { data, error } = await supabase
    .from("scenarios")
    .update({ draft: parsed.data, title: parsed.data.title?.trim() || "Skenario tanpa judul", updated_at: savedAt })
    .eq("id", parsedId.data)
    .select("id");
  if (error || !data?.length) return { ok: false, error: "Gagal menyimpan draf." };
  return { ok: true, savedAt };
}

const generateInput = z.object({
  summary: z.string().trim().min(20, "Ringkasan minimal 20 karakter").max(1000),
  language: z.enum(["id", "en"]),
  level: z.enum(["smk", "s1", "umum"]),
  factCount: z.number().int().min(6).max(15),
});

export type GenerateResult = { ok: true; draft: ScenarioDraft } | { ok: false; error: string };

/** US-G-03: AI drafts persona, hidden facts and rubric from the teacher's summary. */
export async function generateDraft(id: string, input: z.input<typeof generateInput>): Promise<GenerateResult> {
  await requireUser({ roles: ["pengajar"] });
  const parsedId = scenarioId.safeParse(id);
  const parsed = generateInput.safeParse(input);
  if (!parsedId.success) return { ok: false, error: "Skenario tidak valid." };
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Input tidak valid." };

  const own = await loadOwnDraft(parsedId.data);
  if (!own) return { ok: false, error: "Skenario tidak ditemukan." };

  const { data: characters } = await own.supabase
    .from("characters")
    .select("id, name, occupation, age_range, gender")
    .eq("active", true)
    .order("sort");
  const roster = (characters ?? []).map((c) => ({ id: c.id, name: c.name, occupation: c.occupation, ageRange: c.age_range, gender: c.gender }));

  const messages = buildGeneratorMessages({ ...parsed.data, characters: roster });
  // shortcut: no per-teacher daily cap yet; add one (counted in llm_calls) before opening sign-ups widely.
  for (let attempt = 0; attempt < 2; attempt++) {
    let reply: string;
    try {
      reply = (await complete({ task: "grader", json: true, messages, temperature: 0.8 })).text;
    } catch {
      return { ok: false, error: "Layanan AI sedang sibuk. Coba lagi sebentar lagi." };
    }
    const json = extractJson(reply) as Partial<ScenarioDraft> | null;
    const candidate = json && { ...json, facts: renumberFacts(Array.isArray(json.facts) ? json.facts : []) };
    const result = contentSchema.safeParse(candidate);
    if (result.success && roster.some((c) => c.id === result.data.characterId)) {
      const draft: ScenarioDraft = { ...result.data, summary: parsed.data.summary };
      const saved = await saveDraft(parsedId.data, draft);
      return saved.ok ? { ok: true, draft } : { ok: false, error: saved.error };
    }
    messages.push(
      { role: "assistant", content: reply.slice(0, 4000) },
      { role: "user", content: "JSON tidak valid atau tidak lengkap. Balas ulang HANYA objek JSON lengkap sesuai skema, id karakter dari daftar." },
    );
  }
  return { ok: false, error: "AI belum menghasilkan skenario yang lengkap. Coba lagi atau perjelas ringkasan." };
}

export type PublishResult = { ok: true; version: number } | { ok: false; problems: string[] };

export async function publishScenario(id: string): Promise<PublishResult> {
  await requireUser({ roles: ["pengajar"] });
  const parsedId = scenarioId.safeParse(id);
  if (!parsedId.success) return { ok: false, problems: ["Skenario tidak valid."] };
  const own = await loadOwnDraft(parsedId.data);
  if (!own) return { ok: false, problems: ["Skenario tidak ditemukan."] };

  const { data: characters } = await own.supabase.from("characters").select("id").eq("active", true);
  const draft = { ...own.draft, facts: renumberFacts(own.draft.facts ?? []) };
  const problems = publishProblems(draft, (characters ?? []).map((c) => c.id));
  if (problems.length) return { ok: false, problems };

  const c = contentSchema.parse(draft);
  const { data: versionId, error } = await own.supabase.rpc("publish_scenario", {
    p_scenario_id: parsedId.data,
    p_brief: {
      title: c.title,
      language: c.language,
      level: c.level,
      learnerRole: c.learnerRole,
      objective: c.objective,
      clientName: c.persona.name,
      clientOccupation: c.persona.occupation,
      characterId: c.characterId,
    },
    p_secrets: { persona: c.persona, facts: c.facts, rubric: c.rubric },
  });
  if (error || !versionId) return { ok: false, problems: ["Gagal menerbitkan. Coba lagi."] };

  const { data: v } = await own.supabase.from("scenario_versions").select("version").eq("id", versionId).single();
  revalidatePath("/skenario");
  revalidatePath("/pustaka");
  return { ok: true, version: v?.version ?? 1 };
}

export async function setScenarioPublic(form: FormData): Promise<void> {
  await requireUser({ roles: ["pengajar"] });
  const id = scenarioId.parse(form.get("id"));
  const supabase = await createClient();
  // DB check constraint rejects public=true for an unpublished scenario.
  await supabase.from("scenarios").update({ is_public: form.get("public") === "true" }).eq("id", id);
  revalidatePath(`/skenario/${id}`);
  revalidatePath("/skenario");
  revalidatePath("/pustaka");
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { requireUser } from "@/features/auth/dal";
import { ScenarioEditor, type EditorCharacter } from "@/features/scenario/editor";
import { draftSchema } from "@/features/scenario/schema";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Editor skenario — Interview AI" };

async function Editor({ params }: { params: PageProps<"/skenario/[id]">["params"] }) {
  await requireUser({ roles: ["pengajar"] });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const supabase = await createClient();
  const [{ data: s }, { data: characters }] = await Promise.all([
    // RLS: authors only.
    supabase
      .from("scenarios")
      .select("id, title, draft, is_public, current:scenario_versions!scenarios_current_version_fk(version)")
      .eq("id", id)
      .maybeSingle<{ id: string; title: string; draft: unknown; is_public: boolean; current: { version: number } | null }>(),
    supabase
      .from("characters")
      .select("id, name, occupation, age_range, gender, live_voice, portrait_hue")
      .eq("active", true)
      .order("sort")
      .returns<EditorCharacter[]>(),
  ]);
  if (!s) notFound();

  return (
    <>
      <Link href="/skenario" className="-my-3 inline-flex min-h-11 items-center font-mono text-label uppercase text-ink-2 hover:text-ink">
        ← Skenario
      </Link>
      <h1 className="mt-3 mb-8 font-display text-4xl font-medium tracking-tight text-balance sm:text-display">{s.title}</h1>
      <ScenarioEditor
        id={s.id}
        initialDraft={draftSchema.catch({}).parse(s.draft)}
        characters={characters ?? []}
        published={s.current ? { version: s.current.version, isPublic: s.is_public } : null}
      />
    </>
  );
}

export default function EditorPage({ params }: PageProps<"/skenario/[id]">) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-md bg-paper-2" />}>
      <Editor params={params} />
    </Suspense>
  );
}

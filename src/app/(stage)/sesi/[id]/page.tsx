import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { requireUser } from "@/features/auth/dal";
import { Stage } from "@/features/interview/stage";
import { createClient } from "@/lib/supabase/server";
import { isPast } from "@/lib/time";

export const metadata = { title: "Ruang wawancara — Interview AI" };

type Row = {
  id: string;
  status: string;
  ends_at: string;
  v: {
    title: string;
    language: "id" | "en";
    client_name: string;
    characters: { portrait_hue: number; gender: string } | null;
  } | null;
};

async function Room({ params }: { params: PageProps<"/sesi/[id]">["params"] }) {
  const user = await requireUser({ roles: ["pelajar", "pengajar"] });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const supabase = await createClient();
  const { data: s } = await supabase
    .from("sessions")
    .select("id, status, ends_at, v:scenario_versions(title, language, client_name, characters(portrait_hue, gender))")
    .eq("id", id)
    .eq("user_id", user.id) // a teacher reading a student's session must not get the stage
    .maybeSingle<Row>();
  if (!s?.v) notFound();
  if (s.status !== "active" || isPast(s.ends_at)) redirect(`/sesi/${id}/selesai`);

  const { data: messages } = await supabase.from("messages").select("speaker, text").eq("session_id", id).order("seq");

  return (
    <Stage
      sessionId={s.id}
      endsAt={s.ends_at}
      title={s.v.title}
      language={s.v.language}
      character={{ name: s.v.client_name, hue: s.v.characters?.portrait_hue ?? 30, gender: s.v.characters?.gender ?? "female" }}
      initialTurns={(messages ?? []).map((m) => ({ speaker: m.speaker as "learner" | "character", text: m.text as string }))}
    />
  );
}

export default function SesiPage({ params }: PageProps<"/sesi/[id]">) {
  return (
    <Suspense fallback={<div className="stage min-h-dvh" />}>
      <Room params={params} />
    </Suspense>
  );
}

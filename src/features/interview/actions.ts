"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import type { FormState } from "@/features/auth/actions";
import { requireUser } from "@/features/auth/dal";
import { gradeSession } from "@/features/grading/grade";
import { liveEnv, liveMaxConcurrent } from "@/lib/env";
import { complete } from "@/lib/llm/gateway";
import { isTimeoutError, logLlmCall } from "@/lib/llm/log";
import { PERSONA_PROMPT_VERSION, buildPersonaPrompt, openCue } from "@/lib/llm/prompts/persona";
import { createClient } from "@/lib/supabase/server";
import { loadOwnActiveSession } from "./context";

const uuid = z.uuid();

const START_ERRORS: Record<string, string> = {
  active_session_exists: "Kamu masih punya sesi yang berjalan. Selesaikan dulu.",
  no_attempts_left: "Kesempatan untuk tugas ini sudah habis.",
  past_due: "Tenggat tugas ini sudah lewat.",
  class_archived: "Kelas sudah diarsipkan. Tugas tidak bisa dimulai.",
  daily_quota: "Kuota latihan hari ini sudah habis (3 sesi). Coba lagi besok.",
  not_allowed: "Kamu tidak punya akses ke skenario ini.",
};

const startInput = z.object({
  kind: z.enum(["assignment", "library", "preview"]),
  assignmentId: uuid.optional(),
  versionId: uuid.optional(),
});

/** Spends an attempt (PRD §6) and opens the stage. */
export async function startSession(_: FormState, form: FormData): Promise<FormState> {
  await requireUser({ roles: ["pelajar", "pengajar"] });
  const parsed = startInput.safeParse({
    kind: form.get("kind"),
    assignmentId: form.get("assignmentId") || undefined,
    versionId: form.get("versionId") || undefined,
  });
  if (!parsed.success) return { error: "Permintaan tidak valid." };
  const { kind, assignmentId, versionId } = parsed.data;

  const supabase = await createClient();
  if (kind === "assignment") {
    if (!assignmentId) return { error: "Permintaan tidak valid." };
    const { data: asgn } = await supabase
      .from("assignments")
      .select("classes!inner(archived_at)")
      .eq("id", assignmentId)
      .maybeSingle();
    const classData = asgn?.classes as unknown as { archived_at: string | null } | null;
    if (classData?.archived_at) {
      return { error: "Kelas sudah diarsipkan. Tugas tidak bisa dimulai." };
    }
  }

  const { data: id, error } = await supabase.rpc("start_session", {
    p_kind: kind,
    p_assignment_id: kind === "assignment" ? assignmentId : null,
    p_version_id: kind === "assignment" ? null : versionId,
    p_prompt_version: PERSONA_PROMPT_VERSION,
  });
  if (error || !id) {
    const key = Object.keys(START_ERRORS).find((k) => error?.message.includes(k));
    return { error: key ? START_ERRORS[key] : "Sesi gagal dimulai. Coba lagi." };
  }
  redirect(`/sesi/${id}`);
}

export async function giveMicConsent(): Promise<void> {
  const user = await requireUser({ roles: ["pelajar", "pengajar"] });
  const supabase = await createClient();
  await supabase.from("profiles").update({ mic_consent_at: new Date().toISOString() }).eq("id", user.id);
}

export type LiveGrant =
  | { mode: "live"; token: string; model: string }
  | { mode: "fallback"; reason: "busy" | "unavailable" | "closed" };

const MAX_LIVE = liveMaxConcurrent();
const GEMINI = "https://generativelanguage.googleapis.com";

/**
 * Mints a single-use Gemini Live token with the WHOLE setup (persona + facts, voice, transcription)
 * locked server-side: no fieldMask ⇒ the browser's setup is ignored (spike 2026-10-14, architecture §3.1).
 */
export async function requestLiveToken(sessionId: string): Promise<LiveGrant> {
  const user = await requireUser({ roles: ["pelajar", "pengajar"] });
  if (!uuid.safeParse(sessionId).success) return { mode: "fallback", reason: "closed" };
  const ctx = await loadOwnActiveSession(sessionId, user.id);
  if (!ctx) return { mode: "fallback", reason: "closed" };

  let env: ReturnType<typeof liveEnv>;
  try {
    env = liveEnv();
  } catch {
    await logLlmCall({ task: "live", provider: "gemini", model: "", latencyMs: 0, status: "unconfigured", sessionId });
    return { mode: "fallback", reason: "unavailable" };
  }

  // Only a successful `false` means the slots are full; an RPC error is a failure, not capacity.
  const { data: claimed, error: claimError } = await ctx.supabase.rpc("claim_live_slot", { p_session_id: sessionId, p_max: MAX_LIVE });
  if (claimError || !claimed) {
    await logLlmCall({ task: "live", provider: "gemini", model: env.LIVE_MODEL, latencyMs: 0, status: claimError ? "error" : "busy", sessionId });
    return { mode: "fallback", reason: claimError ? "unavailable" : "busy" };
  }

  const now = Date.now();
  const model = `models/${env.LIVE_MODEL}`;
  const log = (status: "ok" | "error" | "timeout") =>
    logLlmCall({ task: "live", provider: "gemini", model: env.LIVE_MODEL, latencyMs: Date.now() - now, status, sessionId });
  try {
    const res = await fetch(`${GEMINI}/v1beta/auth_tokens`, {
      method: "POST",
      headers: { "x-goog-api-key": env.GEMINI_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        uses: 1,
        newSessionExpireTime: new Date(now + 60_000).toISOString(),
        expireTime: new Date(Date.parse(ctx.session.ends_at) + 2 * 60_000).toISOString(),
        bidiGenerateContentSetup: {
          model,
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: ctx.voice } } },
          },
          systemInstruction: { parts: [{ text: buildPersonaPrompt(ctx.content, ctx.clientLevel, ctx.minutes) }] },
          inputAudioTranscription: {},
          outputAudioTranscription: {},
        },
      }),
      signal: AbortSignal.timeout(10_000),
    });
    const body = (await res.json()) as { name?: string };
    if (!res.ok || !body.name) throw new Error(`token ${res.status}`);
    await log("ok");
    return { mode: "live", token: body.name, model };
  } catch (err) {
    await log(isTimeoutError(err) ? "timeout" : "error");
    await ctx.supabase.rpc("release_live_slot", { p_session_id: sessionId });
    return { mode: "fallback", reason: "unavailable" };
  }
}

export async function releaseLive(sessionId: string): Promise<void> {
  await requireUser({ roles: ["pelajar", "pengajar"] });
  if (!uuid.safeParse(sessionId).success) return;
  const supabase = await createClient();
  await supabase.rpc("release_live_slot", { p_session_id: sessionId });
}

const turnText = z.string().trim().min(1).max(2000);

/** Live mode: the browser hears both sides, so it reports each finished turn here. */
export async function logTurn(sessionId: string, speaker: "learner" | "character", text: string): Promise<{ ok: boolean }> {
  await requireUser({ roles: ["pelajar", "pengajar"] });
  const t = turnText.safeParse(text);
  if (!uuid.safeParse(sessionId).success || !t.success || !["learner", "character"].includes(speaker)) return { ok: false };
  const supabase = await createClient();
  const { error } = await supabase.rpc("append_message", { p_session_id: sessionId, p_speaker: speaker, p_text: t.data });
  return { ok: !error };
}

export type ChatResult = { ok: true; reply: string } | { ok: false; error: string; closed?: boolean };

/** Fallback mode: one learner turn in, one character turn out (server keeps prompt + transcript). */
export async function chatTurn(sessionId: string, text: string | null): Promise<ChatResult> {
  const user = await requireUser({ roles: ["pelajar", "pengajar"] });
  if (!uuid.safeParse(sessionId).success) return { ok: false, error: "Sesi tidak valid.", closed: true };
  const ctx = await loadOwnActiveSession(sessionId, user.id);
  if (!ctx) return { ok: false, error: "Sesi sudah berakhir.", closed: true };
  if (ctx.session.mode === "live") await ctx.supabase.rpc("release_live_slot", { p_session_id: sessionId });

  const { data: history } = await ctx.supabase
    .from("messages")
    .select("speaker, text")
    .eq("session_id", sessionId)
    .order("seq", { ascending: true });

  // null = open the conversation: the character greets in its own words, like the Live cue (persona@4).
  if (text === null && history?.length) return { ok: true, reply: "" };
  let learnerText = openCue(); // the cue is sent to the model but never saved to the transcript
  if (text !== null) {
    const t = turnText.safeParse(text);
    if (!t.success) return { ok: false, error: "Pertanyaan kosong atau terlalu panjang." };
    const { error: appendError } = await ctx.supabase.rpc("append_message", { p_session_id: sessionId, p_speaker: "learner", p_text: t.data });
    if (appendError) return { ok: false, error: appendError.message.includes("rate_limited") ? "Pelan-pelan, terlalu banyak pesan." : "Sesi sudah berakhir.", closed: !appendError.message.includes("rate_limited") };
    learnerText = t.data;
  }

  try {
    const res = await complete({
      task: "chat",
      sessionId,
      messages: [
        { role: "system", content: buildPersonaPrompt(ctx.content, ctx.clientLevel, ctx.minutes) },
        ...(history ?? []).map((m) => ({ role: m.speaker === "learner" ? ("user" as const) : ("assistant" as const), content: m.text as string })),
        { role: "user", content: learnerText },
      ],
    });
    const reply = res.text.replace(/[*_#`]/g, "").trim().slice(0, 2000) || "Maaf, bisa diulang pertanyaannya?";
    await ctx.supabase.rpc("append_message", { p_session_id: sessionId, p_speaker: "character", p_text: reply });
    return { ok: true, reply };
  } catch {
    return { ok: false, error: "Klien sedang tidak bisa menjawab. Coba ulangi pertanyaanmu." };
  }
}

/** Ends the caller's session and grades it after the response, so the redirect isn't held up (≤ minutes). */
export async function endSession(sessionId: string): Promise<void> {
  const user = await requireUser({ roles: ["pelajar", "pengajar"] });
  if (!uuid.safeParse(sessionId).success) redirect("/dashboard");
  const supabase = await createClient();
  await supabase.rpc("end_session", { p_session_id: sessionId });
  const { data: own } = await supabase.from("sessions").select("id").eq("id", sessionId).eq("user_id", user.id).maybeSingle();
  if (own) after(() => gradeSession(sessionId));
  redirect(`/sesi/${sessionId}/selesai`);
}

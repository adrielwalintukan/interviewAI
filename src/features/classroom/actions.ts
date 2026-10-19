"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { FormState } from "@/features/auth/actions";
import { requireUser } from "@/features/auth/dal";
import { usernameToEmail } from "@/features/auth/identifier";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { checkClassCanAcceptAssignment } from "./archive";
import { generateInitialPassword, parseStudentCsv } from "./bulk-students";
import { toDueInstant } from "./due-date";

const className = z.string().trim().min(1, "Nama kelas wajib diisi").max(80, "Maksimal 80 karakter");

export async function createClass(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser({ roles: ["pengajar"] });
  const values = { name: String(form.get("name") ?? "") };
  const parsed = className.safeParse(values.name);
  if (!parsed.success) return { fieldErrors: { name: parsed.error.issues[0]?.message ?? "Tidak valid" }, values };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("classes")
    .insert({ owner_id: user.id, name: parsed.data })
    .select("id")
    .single();
  if (error || !data) return { error: "Kelas gagal dibuat. Coba lagi.", values };
  redirect(`/kelas/${data.id}`);
}

export async function joinClass(_: FormState, form: FormData): Promise<FormState> {
  await requireUser({ roles: ["pelajar"] });
  const code = String(form.get("code") ?? "").trim();
  const values = { code };
  if (!/^[A-Za-z0-9]{6,8}$/.test(code)) return { fieldErrors: { code: "Kode kelas 6–8 huruf/angka" }, values };

  const supabase = await createClient();
  const { data: classId, error } = await supabase.rpc("join_class", { p_code: code });
  // Same message for wrong and archived codes (US-P-01).
  if (error || !classId) return { fieldErrors: { code: "Kode tidak ditemukan atau kelas sudah ditutup." }, values };
  redirect(`/kelas/${classId}`);
}

export async function regenerateJoinCode(form: FormData): Promise<void> {
  await requireUser({ roles: ["pengajar"] });
  const classId = z.uuid().parse(form.get("classId"));
  const supabase = await createClient();
  await supabase.rpc("regenerate_join_code", { p_class_id: classId }); // RPC enforces ownership
  revalidatePath(`/kelas/${classId}`);
}

export async function archiveClass(form: FormData): Promise<void> {
  const user = await requireUser({ roles: ["pengajar"] });
  const classId = z.uuid().parse(form.get("classId"));
  const supabase = await createClient();
  const { error } = await supabase
    .from("classes")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", classId)
    .eq("owner_id", user.id);
  if (error) throw new Error("Gagal mengarsipkan kelas.");
  revalidatePath(`/kelas/${classId}`);
  revalidatePath("/dashboard");
}

export async function unarchiveClass(form: FormData): Promise<void> {
  const user = await requireUser({ roles: ["pengajar"] });
  const classId = z.uuid().parse(form.get("classId"));
  const supabase = await createClient();
  const { error } = await supabase
    .from("classes")
    .update({ archived_at: null })
    .eq("id", classId)
    .eq("owner_id", user.id);
  if (error) throw new Error("Gagal membuka arsip kelas.");
  revalidatePath(`/kelas/${classId}`);
  revalidatePath("/dashboard");
}


export type BulkResult = {
  error?: string;
  text?: string; // pasted list echoed back on error so the form reset doesn't lose it
  created?: { name: string; username: string; password: string }[];
  rejected?: { line: number; raw: string; reason: string }[];
};

export async function bulkCreateStudents(_: BulkResult | undefined, form: FormData): Promise<BulkResult> {
  const teacher = await requireUser({ roles: ["pengajar"] });
  const pasted = String(form.get("text") ?? "");
  const classId = z.uuid().safeParse(form.get("classId"));
  if (!classId.success) return { error: "Kelas tidak valid." };
  if (form.get("consent") !== "on") {
    return { error: "Centang konfirmasi persetujuan orang tua/wali sebelum membuat akun.", text: pasted };
  }

  // Ownership checked as the teacher (RLS), before any service-role write.
  const supabase = await createClient();
  const { data: owned } = await supabase
    .from("classes")
    .select("id")
    .eq("id", classId.data)
    .eq("owner_id", teacher.id)
    .is("archived_at", null)
    .maybeSingle();
  if (!owned) return { error: "Kelas tidak ditemukan.", text: pasted };

  const file = form.get("file");
  const text = file instanceof File && file.size > 0 ? await file.text() : pasted;
  if (!text.trim()) return { error: "Unggah file CSV atau tempel daftar pelajar." };
  if (text.length > 100_000) return { error: "File terlalu besar (maks. 100 KB).", text: pasted };

  const admin = createAdminClient();
  const { rows: candidates } = parseStudentCsv(text);
  const { data: existing } = await admin
    .from("profiles")
    .select("username")
    .in("username", candidates.map((r) => r.username));
  const { rows, rejected } = parseStudentCsv(text, new Set((existing ?? []).map((p) => p.username as string)));

  const created: NonNullable<BulkResult["created"]> = [];
  // shortcut: sequential, ~0.2–0.5 s per account; fine for a class (≤ 500), move to a background job if it times out.
  for (const row of rows) {
    const pass = generateInitialPassword();
    const { data, error } = await admin.auth.admin.createUser({
      email: usernameToEmail(row.username),
      password: pass,
      email_confirm: true,
      user_metadata: { display_name: row.name, role: "pelajar" },
    });
    if (error || !data.user) {
      rejected.push({ line: row.line, raw: `${row.name},${row.username}`, reason: "Akun gagal dibuat (mungkin username sudah dipakai)" });
      continue;
    }
    const uid = data.user.id;
    const { error: profileError } = await admin
      .from("profiles")
      .update({ username: row.username, must_change_password: true })
      .eq("id", uid);
    const { error: memberError } = await admin.from("class_members").insert({ class_id: classId.data, user_id: uid });
    if (profileError || memberError) {
      await admin.auth.admin.deleteUser(uid); // don't leave a half-made account behind
      rejected.push({ line: row.line, raw: `${row.name},${row.username}`, reason: "Akun gagal disiapkan" });
      continue;
    }
    created.push({ name: row.name, username: row.username, password: pass });
  }

  rejected.sort((a, b) => a.line - b.line);
  revalidatePath(`/kelas/${classId.data}`);
  return { created, rejected };
}

const assignmentInput = z.object({
  classId: z.uuid(),
  versionId: z.uuid("Pilih skenario"),
  // <input type="datetime-local"> sends local wall time; the browser's offset comes alongside it.
  dueLocal: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/).or(z.literal("")),
  tzOffsetMin: z.coerce.number().int().min(-840).max(840),
  durationMin: z.coerce.number().int().min(5, "Durasi 5–60 menit").max(60, "Durasi 5–60 menit"),
  maxAttempts: z.coerce.number().int().min(1, "Percobaan 1–10").max(10, "Percobaan 1–10"),
});

/** US-G-06: give a published scenario version to a class (the version is a snapshot). */
export async function createAssignment(_: FormState, form: FormData): Promise<FormState> {
  await requireUser({ roles: ["pengajar"] });
  const parsed = assignmentInput.safeParse(Object.fromEntries(form));
  if (!parsed.success) {
    const fe: Record<string, string> = {};
    for (const i of parsed.error.issues) fe[String(i.path[0])] ??= i.message;
    return { fieldErrors: fe };
  }
  const { classId, versionId, dueLocal, tzOffsetMin, durationMin, maxAttempts } = parsed.data;
  const dueAt = toDueInstant(dueLocal, tzOffsetMin);
  if (dueAt && Date.parse(dueAt) < Date.now()) return { fieldErrors: { dueLocal: "Tenggat sudah lewat" } };

  const supabase = await createClient();
  const { data: cls, error: clsError } = await supabase
    .from("classes")
    .select("archived_at")
    .eq("id", classId)
    .maybeSingle();
  const check = checkClassCanAcceptAssignment(cls, clsError);
  if (!check.ok) return { error: check.error };

  // RLS: owner of the class, and the version is theirs or in the public library.
  const { error } = await supabase.from("assignments").insert({
    class_id: classId,
    scenario_version_id: versionId,
    due_at: dueAt,
    duration_min: durationMin,
    max_attempts: maxAttempts,
  });
  if (error) return { error: "Tugas gagal dibuat." };
  revalidatePath(`/kelas/${classId}`);
  return { ok: "Tugas diberikan." };
}

export async function deleteAssignment(form: FormData): Promise<void> {
  await requireUser({ roles: ["pengajar"] });
  const id = z.uuid().parse(form.get("id"));
  const classId = z.uuid().parse(form.get("classId"));
  const supabase = await createClient();
  await supabase.from("assignments").delete().eq("id", id); // RLS: class owner only
  revalidatePath(`/kelas/${classId}`);
}

"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/features/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { characterSchema } from "./characters";

const input = z.object({
  userId: z.uuid(),
  role: z.enum(["admin", "pengajar", "pelajar"]),
  status: z.enum(["active", "pending", "disabled"]),
});

/** US-A-01: change role / approve / disable. Admin-only, enforced here before the service-role write. */
export async function updateUserAccess(form: FormData): Promise<void> {
  const admin = await requireUser({ roles: ["admin"] });
  const parsed = input.safeParse(Object.fromEntries(form));
  if (!parsed.success) return;
  const { userId, role, status } = parsed.data;
  if (userId === admin.id) return; // an admin can't demote or lock themselves out

  const db = createAdminClient();
  const { error } = await db.from("profiles").update({ role, status }).eq("id", userId);
  if (error) return;
  // Ban at the Auth layer too so a disabled account can't sign in at all.
  await db.auth.admin.updateUserById(userId, { ban_duration: status === "disabled" ? "876000h" : "none" });
  revalidatePath("/admin");
}

export type DeleteResult = { done?: true; error?: string } | undefined;

const deleteInput = z.object({ userId: z.uuid(), confirm: z.string().trim().min(1).max(80) });

const DELETE_ERRORS: Record<string, string> = {
  confirmation_mismatch: "Nama yang diketik tidak cocok.",
  not_a_student: "Hanya akun pelajar yang bisa dihapus di sini.",
  not_found: "Akun tidak ditemukan.",
  cannot_delete_self: "Anda tidak bisa menghapus akun sendiri.",
};

/**
 * US-A-02: permanently delete a learner and everything that belongs to them. delete_student runs as the
 * caller (auth.uid()) and re-checks admin, role and the retyped name; the delete and its audit row share
 * one transaction.
 */
export async function deleteStudent(_: DeleteResult, form: FormData): Promise<DeleteResult> {
  const admin = await requireUser({ roles: ["admin"] });
  const parsed = deleteInput.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Ketik nama pelajar untuk konfirmasi." };
  if (parsed.data.userId === admin.id) return { error: DELETE_ERRORS.cannot_delete_self };

  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_student", { p_user_id: parsed.data.userId, p_confirm: parsed.data.confirm });
  if (error) return { error: DELETE_ERRORS[error.message] ?? "Gagal menghapus data pelajar." };
  revalidatePath("/admin");
  return { done: true };
}

export type CharacterResult = { ok?: true; error?: string } | undefined;

/** US-A-03: add (mode=new) or edit a preset character. Admin-only; written with the service role (no write policy). */
export async function saveCharacter(_: CharacterResult, form: FormData): Promise<CharacterResult> {
  await requireUser({ roles: ["admin"] });
  const parsed = characterSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Data karakter tidak valid." };

  const db = createAdminClient();
  const { id, ...fields } = parsed.data;
  const { error } =
    form.get("mode") === "new" ? await db.from("characters").insert(parsed.data) : await db.from("characters").update(fields).eq("id", id);
  if (error) return { error: error.code === "23505" ? "ID karakter sudah dipakai." : "Gagal menyimpan karakter." };
  revalidatePath("/admin");
  return { ok: true };
}

const activeInput = z.object({ id: characterSchema.shape.id, active: z.enum(["true", "false"]) });

/** US-A-03: deactivate instead of delete, so scenarios that use the character keep working. */
export async function setCharacterActive(form: FormData): Promise<void> {
  await requireUser({ roles: ["admin"] });
  const parsed = activeInput.safeParse(Object.fromEntries(form));
  if (!parsed.success) return;
  await createAdminClient().from("characters").update({ active: parsed.data.active === "true" }).eq("id", parsed.data.id);
  revalidatePath("/admin");
}

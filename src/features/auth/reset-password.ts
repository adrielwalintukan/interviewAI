"use server";

import { z } from "zod";
import { generateInitialPassword } from "@/features/classroom/bulk-students";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "./dal";

export type ResetResult = { password?: string; error?: string } | undefined;

/**
 * "Lupa password": issues a new one-time password (shown once) and forces a change at next login.
 * Passwords are never stored or shown anywhere else — Supabase Auth keeps only a bcrypt hash.
 * Admin: any account but their own. Pengajar: only learners in a class they own.
 */
export async function resetPassword(_: ResetResult, form: FormData): Promise<ResetResult> {
  const caller = await requireUser({ roles: ["admin", "pengajar"] });
  const target = z.uuid().safeParse(form.get("userId"));
  if (!target.success || target.data === caller.id) return { error: "Akun tidak valid." };

  const db = createAdminClient();
  const { data: profile } = await db.from("profiles").select("role").eq("id", target.data).maybeSingle();
  if (!profile) return { error: "Akun tidak ditemukan." };

  if (caller.role === "pengajar") {
    const supabase = await createClient();
    // Evaluated as the caller (auth.uid()), so a teacher can't reach learners outside their classes.
    const { data: teaches } = await supabase.rpc("teaches_user", { p_user_id: target.data });
    if (!teaches || profile.role !== "pelajar") return { error: "Anda hanya bisa mereset password pelajar di kelas Anda." };
  }

  const password = generateInitialPassword();
  const { error } = await db.auth.admin.updateUserById(target.data, { password });
  if (error) return { error: "Gagal mereset password." };
  await db.from("profiles").update({ must_change_password: true }).eq("id", target.data);
  return { password };
}

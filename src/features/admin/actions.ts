"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/features/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";

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

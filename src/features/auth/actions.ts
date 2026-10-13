"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { loadCurrentUser } from "./dal";
import { loginIdentifierToEmail, safeNextPath } from "./identifier";

// `values` echoes non-secret fields back: React 19 resets a form after its action, and
// inputs read them as defaultValue so a failed submit doesn't wipe what the user typed.
export type FormState =
  | { error?: string; fieldErrors?: Record<string, string>; ok?: string; values?: Record<string, string> }
  | undefined;

const password = z.string().min(8, "Minimal 8 karakter").max(72, "Maksimal 72 karakter");

function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    out[key] ??= issue.message;
  }
  return out;
}

export async function signIn(_: FormState, form: FormData): Promise<FormState> {
  const identifier = String(form.get("identifier") ?? "");
  const values = { identifier };
  const email = loginIdentifierToEmail(identifier);
  const pass = String(form.get("password") ?? "");
  if (!email || !pass) return { error: "Isi email/username dan password.", values };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
  // One message for every failure so the form can't be used to discover which accounts exist.
  if (error) return { error: "Email/username atau password salah.", values };

  redirect(safeNextPath(form.get("next")));
}

const signUpSchema = z.object({
  displayName: z.string().trim().min(1, "Nama wajib diisi").max(80, "Maksimal 80 karakter"),
  email: z.email("Email tidak valid").transform((v) => v.toLowerCase()),
  password,
  role: z.enum(["pelajar", "pengajar"]),
});

export async function signUp(_: FormState, form: FormData): Promise<FormState> {
  const values = {
    displayName: String(form.get("displayName") ?? ""),
    email: String(form.get("email") ?? ""),
  };
  const parsed = signUpSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values };
  const { displayName, email, password: pass, role } = parsed.data;

  const supabase = await createClient();
  // role is only a request: the DB trigger makes "pengajar" pending and never grants admin.
  const { data, error } = await supabase.auth.signUp({
    email,
    password: pass,
    options: { data: { display_name: displayName, role } },
  });
  if (error) {
    return {
      error: error.code === "user_already_exists" ? "Email ini sudah terdaftar. Silakan masuk." : "Pendaftaran gagal. Coba lagi sebentar lagi.",
      values,
    };
  }
  if (!data.session) return { ok: "Cek email Anda untuk konfirmasi, lalu masuk." };
  redirect("/dashboard");
}

export async function signInWithGoogle(form: FormData): Promise<void> {
  if (process.env.NEXT_PUBLIC_AUTH_GOOGLE_ENABLED !== "true") redirect("/masuk");
  const origin = (await headers()).get("origin") ?? "";
  const next = safeNextPath(form.get("next"));
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}` },
  });
  if (error || !data.url) redirect("/masuk?error=google");
  redirect(data.url);
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/masuk");
}

const changePasswordSchema = z
  .object({ password, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { message: "Konfirmasi tidak sama", path: ["confirm"] });

export async function changePassword(_: FormState, form: FormData): Promise<FormState> {
  // Uncached so a just-cleared must_change_password is never read back stale within this request.
  const user = await loadCurrentUser();
  if (!user || user.status === "disabled") redirect("/keluar");
  const parsed = changePasswordSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    return { error: error.code === "same_password"
          ? "Password baru harus berbeda dari yang lama."
          : "Gagal mengganti password. Sesi mungkin sudah berakhir — keluar, lalu masuk lagi." };
  }
  // must_change_password isn't user-writable (column grant), so clear it with the service role.
  if (user.mustChangePassword) {
    await createAdminClient().from("profiles").update({ must_change_password: false }).eq("id", user.id);
  }
  // The client does a full navigation: updateUser rotated the session cookie, and a soft redirect
  // races the automatic refresh of /ganti-password that cookie writes trigger.
  return { ok: "Password tersimpan." };
}

import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type Role = "admin" | "pengajar" | "pelajar";
export type Status = "active" | "pending" | "disabled";

export type CurrentUser = {
  id: string;
  role: Role;
  status: Status;
  displayName: string;
  username: string | null;
  mustChangePassword: boolean;
};

/** Verified identity (getClaims checks the JWT) + own profile row. Uncached: use in actions that change it. */
export async function loadCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return null;

  const { data: p } = await supabase
    .from("profiles")
    .select("id, role, status, display_name, username, must_change_password")
    .eq("id", userId)
    .maybeSingle();
  if (!p) return null;

  return {
    id: p.id,
    role: p.role,
    status: p.status,
    displayName: p.display_name,
    username: p.username,
    mustChangePassword: p.must_change_password,
  };
}

/**
 * Deduped per request. The cache spans a whole action request including the redirect render that
 * follows it, so an action that changes the caller's own profile must use loadCurrentUser().
 */
export const getCurrentUser = cache(loadCurrentUser);

/**
 * Gate for pages and actions. Disabled accounts are bounced; pending teachers may only see the
 * waiting notice (allowPending); first login with a bulk password must change it first.
 */
export async function requireUser(opts: { roles?: Role[]; allowPending?: boolean; allowPasswordChange?: boolean } = {}) {
  const user = await getCurrentUser();
  // Via /keluar (clears the cookie) — a live session on /masuk would bounce back here forever.
  if (!user || user.status === "disabled") redirect("/keluar");
  if (user.mustChangePassword && !opts.allowPasswordChange) redirect("/ganti-password");
  if (user.status === "pending" && !opts.allowPending) redirect("/dashboard");
  if (opts.roles && !opts.roles.includes(user.role)) redirect("/dashboard");
  return user;
}

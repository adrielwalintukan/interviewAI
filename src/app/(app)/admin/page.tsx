import { Suspense } from "react";
import { requireUser } from "@/features/auth/dal";
import { updateUserAccess } from "@/features/admin/actions";
import { USERNAME_EMAIL_DOMAIN } from "@/features/auth/identifier";
import { ResetPasswordButton } from "@/features/auth/reset-password-button";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Admin — Interview AI" };

type ProfileRow = {
  id: string;
  display_name: string;
  username: string | null;
  role: "admin" | "pengajar" | "pelajar";
  status: "active" | "pending" | "disabled";
  created_at: string;
};

const STATUS_LABEL = { active: "Aktif", pending: "Menunggu", disabled: "Nonaktif" } as const;
const STATUS_TONE = { active: "text-moss", pending: "text-ochre", disabled: "text-accent" } as const;

function AccessButton({ user, role, status, label }: { user: ProfileRow; role: ProfileRow["role"]; status: ProfileRow["status"]; label: string }) {
  return (
    <form action={updateUserAccess}>
      <input type="hidden" name="userId" value={user.id} />
      <input type="hidden" name="role" value={role} />
      <input type="hidden" name="status" value={status} />
      <button type="submit" className="min-h-11 rounded-sm border border-rule px-3 text-sm hover:border-ink">
        {label}
      </button>
    </form>
  );
}

async function UserTable() {
  const me = await requireUser({ roles: ["admin"] });
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, display_name, username, role, status, created_at")
    .order("created_at", { ascending: false })
    .limit(500)
    .returns<ProfileRow[]>();
  const users = data ?? [];

  // Emails live in Supabase Auth (auth.users), not profiles; read them server-side for admins only.
  // shortcut: one page of 1000 auth users; paginate once an institution has more.
  const { data: authUsers } = await createAdminClient().auth.admin.listUsers({ perPage: 1000 });
  const emailById = new Map((authUsers?.users ?? []).map((u) => [u.id, u.email ?? ""]));
  const emailOf = (id: string) => {
    const email = emailById.get(id) ?? "";
    return email.endsWith(`@${USERNAME_EMAIL_DOMAIN}`) ? null : email; // username accounts have a synthetic address
  };

  const pending = users.filter((u) => u.status === "pending");

  return (
    <>
      {pending.length > 0 && (
        <section className="mt-8 border-l-2 border-ochre pl-4">
          <p className="font-mono text-label uppercase text-ochre">{pending.length} pengajar menunggu persetujuan</p>
          <ul className="mt-3 flex flex-col gap-3">
            {pending.map((u) => (
              <li key={u.id} className="flex flex-wrap items-center gap-3">
                <span className="font-medium">{u.display_name}</span>
                <AccessButton user={u} role="pengajar" status="active" label="Setujui" />
                <AccessButton user={u} role="pelajar" status="active" label="Jadikan pelajar" />
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mt-10 overflow-x-auto">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <thead className="font-mono text-label uppercase text-ink-2">
            <tr className="border-b border-rule">
              <th className="py-2 pr-4 font-normal">Nama & login</th>
              <th className="py-2 pr-4 font-normal">Role</th>
              <th className="py-2 pr-4 font-normal">Status</th>
              <th className="py-2 font-normal">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-rule align-middle">
                <td className="py-3 pr-4">
                  <span className="block">{u.display_name}</span>
                  <span className="block break-all font-mono text-ink-2">{u.username ?? emailOf(u.id) ?? "—"}</span>
                </td>
                <td className="py-3 pr-4 capitalize">{u.role}</td>
                <td className={`py-3 pr-4 ${STATUS_TONE[u.status]}`}>{STATUS_LABEL[u.status]}</td>
                <td className="py-3">
                  {u.id === me.id ? (
                    <span className="text-ink-2">Anda</span>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {u.role !== "pengajar" && <AccessButton user={u} role="pengajar" status={u.status === "disabled" ? "disabled" : "active"} label="→ Pengajar" />}
                      {u.role !== "pelajar" && <AccessButton user={u} role="pelajar" status={u.status === "disabled" ? "disabled" : "active"} label="→ Pelajar" />}
                      {u.status === "disabled" ? (
                        <AccessButton user={u} role={u.role} status="active" label="Aktifkan" />
                      ) : (
                        <AccessButton user={u} role={u.role} status="disabled" label="Nonaktifkan" />
                      )}
                      <ResetPasswordButton userId={u.id} name={u.display_name} />
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export default function AdminPage() {
  return (
    <>
      <p className="font-mono text-label uppercase text-accent">Admin</p>
      <h1 className="mt-3 font-display text-display font-medium tracking-tight">Akun & akses.</h1>
      <Suspense fallback={<div className="mt-8 h-64 animate-pulse rounded-md bg-paper-2" />}>
        <UserTable />
      </Suspense>
    </>
  );
}

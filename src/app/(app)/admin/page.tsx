import { Suspense } from "react";
import { requireUser } from "@/features/auth/dal";
import { updateUserAccess } from "@/features/admin/actions";
import { DeleteStudentButton } from "@/features/admin/delete-student-button";
import { USERNAME_EMAIL_DOMAIN } from "@/features/auth/identifier";
import { ResetPasswordButton } from "@/features/auth/reset-password-button";
import { liveMaxConcurrent } from "@/lib/env";
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
                      {u.role === "pelajar" && <DeleteStudentButton userId={u.id} name={u.display_name} />}
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

type UsageRow = {
  day: string;
  sessions: number;
  fallback_sessions: number;
  chat: number;
  grader: number;
  generator: number;
  live: number;
  tts: number;
  router_errors: number;
  router_timeouts: number;
  gemini_errors: number;
  gemini_timeouts: number;
};

const USAGE_DAYS = 14;
const TASKS = [
  ["chat", "Chat"],
  ["grader", "Penilai"],
  ["generator", "Generator"],
  ["live", "Live"],
  ["tts", "TTS"],
] as const;

/** US-A-04: aggregated per day in Postgres (admin_usage), never raw rows. Days are UTC, like the daily quota. */
async function UsageTable() {
  await requireUser({ roles: ["admin"] });
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_usage", { p_days: USAGE_DAYS });
  const rows = (data ?? []) as UsageRow[];
  const num = "py-2 pr-3 text-right tabular-nums";

  return (
    <>
      <p className="mt-3 text-sm text-ink-2">
        {USAGE_DAYS} hari terakhir (tanggal UTC). Batas sesi Live bersamaan: <span className="tabular-nums">{liveMaxConcurrent()}</span>; sesi berikutnya langsung memakai mode hemat.
      </p>
      {error ? (
        <p role="alert" className="mt-4 border-l-2 border-accent pl-4 text-accent">
          Data pemakaian gagal dimuat. Muat ulang halaman ini.
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[52rem] border-y border-rule text-left text-sm">
            <thead className="font-mono text-label uppercase text-ink-2">
              <tr className="border-b border-rule">
                <th scope="col" className="py-2 pr-3 font-normal">Tanggal</th>
                <th scope="col" className="py-2 pr-3 text-right font-normal">Sesi</th>
                <th scope="col" className="py-2 pr-3 text-right font-normal">Mode hemat</th>
                {TASKS.map(([k, label]) => (
                  <th key={k} scope="col" className="py-2 pr-3 text-right font-normal">
                    {label}
                  </th>
                ))}
                <th scope="col" className="py-2 pr-3 text-right font-normal">
                  9router <span className="normal-case">error / timeout</span>
                </th>
                <th scope="col" className="py-2 text-right font-normal">
                  Gemini <span className="normal-case">error / timeout</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule">
              {rows.map((r) => (
                <tr key={r.day}>
                  <th scope="row" className="py-2 pr-3 font-mono font-normal">
                    {new Date(`${r.day}T00:00:00Z`).toLocaleDateString("id-ID", { day: "numeric", month: "short", timeZone: "UTC" })}
                  </th>
                  <td className={num}>{r.sessions}</td>
                  <td className={num}>{r.sessions ? `${Math.round((r.fallback_sessions / r.sessions) * 100)}%` : "—"}</td>
                  {TASKS.map(([k]) => (
                    <td key={k} className={num}>
                      {r[k]}
                    </td>
                  ))}
                  <td className={`${num} ${r.router_errors + r.router_timeouts ? "text-accent" : ""}`}>
                    {r.router_errors} / {r.router_timeouts}
                  </td>
                  <td className={`py-2 text-right tabular-nums ${r.gemini_errors + r.gemini_timeouts ? "text-accent" : ""}`}>
                    {r.gemini_errors} / {r.gemini_timeouts}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
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

      <section aria-labelledby="pemakaian-h" className="mt-16">
        <h2 id="pemakaian-h" className="font-mono text-label uppercase text-accent">
          Pemakaian
        </h2>
        <Suspense fallback={<div className="mt-4 h-64 animate-pulse rounded-md bg-paper-2" />}>
          <UsageTable />
        </Suspense>
      </section>
    </>
  );
}

import { beforeEach, describe, expect, it, vi } from "vitest";

const ADMIN = "00000000-0000-4000-8000-0000000000ad";
const LEARNER = "00000000-0000-4000-8000-0000000000b1";
const rpc = vi.fn();
const revalidatePath = vi.fn();

vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/features/auth/dal", () => ({ requireUser: async () => ({ id: ADMIN, role: "admin" }) }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ rpc }) }));

const { deleteStudent } = await import("./actions");

const form = (fields: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
};

beforeEach(() => {
  rpc.mockReset().mockResolvedValue({ data: null, error: null });
  revalidatePath.mockClear();
});

describe("deleteStudent", () => {
  it("calls delete_student with the trimmed confirmation and refreshes /admin", async () => {
    expect(await deleteStudent(undefined, form({ userId: LEARNER, confirm: "  Siswa A " }))).toEqual({ done: true });
    expect(rpc).toHaveBeenCalledExactlyOnceWith("delete_student", { p_user_id: LEARNER, p_confirm: "Siswa A" });
    expect(revalidatePath).toHaveBeenCalledWith("/admin");
  });

  it("refuses an empty confirmation or a bad id without calling the database", async () => {
    expect((await deleteStudent(undefined, form({ userId: LEARNER, confirm: "  " })))?.error).toBeTruthy();
    expect((await deleteStudent(undefined, form({ userId: "x", confirm: "Siswa A" })))?.error).toBeTruthy();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("refuses to delete the admin themselves", async () => {
    expect(await deleteStudent(undefined, form({ userId: ADMIN, confirm: "Admin" }))).toEqual({ error: "Anda tidak bisa menghapus akun sendiri." });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("maps database refusals to Indonesian messages and does not refresh", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "confirmation_mismatch" } });
    expect(await deleteStudent(undefined, form({ userId: LEARNER, confirm: "Salah" }))).toEqual({ error: "Nama yang diketik tidak cocok." });
    rpc.mockResolvedValue({ data: null, error: { message: "connection reset" } });
    expect(await deleteStudent(undefined, form({ userId: LEARNER, confirm: "Siswa A" }))).toEqual({ error: "Gagal menghapus data pelajar." });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

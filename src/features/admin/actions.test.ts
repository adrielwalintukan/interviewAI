import { beforeEach, describe, expect, it, vi } from "vitest";

const ADMIN = "00000000-0000-4000-8000-0000000000ad";
const LEARNER = "00000000-0000-4000-8000-0000000000b1";
const rpc = vi.fn();
const revalidatePath = vi.fn();
const requireUser = vi.fn<(opts: unknown) => Promise<{ id: string; role: string }>>(async () => ({ id: ADMIN, role: "admin" }));
// Service-role writes: insert(row) / update(fields).eq("id", id)
const writes: { op: string; row: unknown; id?: string }[] = [];
let writeError: { code: string } | null = null;
const adminDb = {
  from: () => ({
    insert: async (row: unknown) => (writes.push({ op: "insert", row }), { error: writeError }),
    update: (row: unknown) => ({ eq: async (_c: string, id: string) => (writes.push({ op: "update", row, id }), { error: writeError }) }),
  }),
};

vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/features/auth/dal", () => ({ requireUser }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => adminDb }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ rpc }) }));

const { deleteStudent, saveCharacter, setCharacterActive } = await import("./actions");

const form = (fields: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
};

beforeEach(() => {
  rpc.mockReset().mockResolvedValue({ data: null, error: null });
  revalidatePath.mockClear();
  requireUser.mockClear();
  writes.length = 0;
  writeError = null;
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

const CHARACTER = { id: "wulan", name: "Bu Wulan", occupation: "Pemilik toko kue", age_range: "30-an", gender: "female", live_voice: "Kore", portrait_hue: "40", sort: "7" };

describe("saveCharacter", () => {
  it("is admin-only and inserts a new character with numbers coerced", async () => {
    expect(await saveCharacter(undefined, form({ mode: "new", ...CHARACTER }))).toEqual({ ok: true });
    expect(requireUser).toHaveBeenCalledWith({ roles: ["admin"] });
    expect(writes).toEqual([{ op: "insert", row: { ...CHARACTER, portrait_hue: 40, sort: 7 } }]);
    expect(revalidatePath).toHaveBeenCalledWith("/karakter");
  });

  it("edits by id without changing the id", async () => {
    expect(await saveCharacter(undefined, form({ mode: "edit", ...CHARACTER, name: "Bu Wulan S." }))).toEqual({ ok: true });
    const fields = Object.fromEntries(Object.entries(CHARACTER).filter(([k]) => k !== "id"));
    expect(writes).toEqual([{ op: "update", row: { ...fields, name: "Bu Wulan S.", portrait_hue: 40, sort: 7 }, id: "wulan" }]);
  });

  it.each([
    [{ id: "Bu Wulan" }, "ID: 2–40 huruf kecil, angka, atau tanda hubung."],
    [{ live_voice: "Nadia" }, "Pilih suara dari daftar."],
    [{ portrait_hue: "360" }, "Warna potret 0–359."],
    [{ gender: "other" }, "Pilih gender."],
  ])("rejects %o before writing", async (bad, error) => {
    expect(await saveCharacter(undefined, form({ mode: "new", ...CHARACTER, ...bad }))).toEqual({ error });
    expect(writes).toEqual([]);
  });

  it("reports a duplicate id", async () => {
    writeError = { code: "23505" };
    expect(await saveCharacter(undefined, form({ mode: "new", ...CHARACTER }))).toEqual({ error: "ID karakter sudah dipakai." });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("setCharacterActive", () => {
  it("is admin-only and only flips `active`", async () => {
    await setCharacterActive(form({ id: "wulan", active: "false" }));
    expect(requireUser).toHaveBeenCalledWith({ roles: ["admin"] });
    expect(writes).toEqual([{ op: "update", row: { active: false }, id: "wulan" }]);
    expect(revalidatePath).toHaveBeenCalledWith("/karakter");
  });

  it("ignores malformed input", async () => {
    await setCharacterActive(form({ id: "x'; drop", active: "yes" }));
    expect(writes).toEqual([]);
  });
});

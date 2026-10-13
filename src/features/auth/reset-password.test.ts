import { beforeEach, describe, expect, it, vi } from "vitest";

const caller = { current: { id: "teacher-1", role: "pengajar" as "pengajar" | "admin" } };
const target = { role: "pelajar" as string | null };
const teaches = { value: true };
const updateUserById = vi.fn();
const profileUpdate = vi.fn();

vi.mock("./dal", () => ({ requireUser: async () => caller.current }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ rpc: async () => ({ data: teaches.value }) }),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    auth: { admin: { updateUserById } },
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: target.role ? { role: target.role } : null }) }) }),
      update: (v: unknown) => ({ eq: async () => profileUpdate(v) }),
    }),
  }),
}));

const { resetPassword } = await import("./reset-password");
const STUDENT = "00000000-0000-4000-8000-000000000001";
const form = (userId: string) => {
  const f = new FormData();
  f.set("userId", userId);
  return f;
};

beforeEach(() => {
  caller.current = { id: "teacher-1", role: "pengajar" };
  target.role = "pelajar";
  teaches.value = true;
  updateUserById.mockReset().mockResolvedValue({ error: null });
  profileUpdate.mockReset();
});

describe("resetPassword", () => {
  it("lets a teacher reset a learner in their class and forces a change", async () => {
    const res = await resetPassword(undefined, form(STUDENT));
    expect(res?.password).toMatch(/^[a-km-zA-HJ-NP-Z2-9]{12}$/);
    expect(updateUserById).toHaveBeenCalledWith(STUDENT, { password: res?.password });
    expect(profileUpdate).toHaveBeenCalledWith({ must_change_password: true });
  });

  it("refuses a learner outside the teacher's classes", async () => {
    teaches.value = false;
    expect((await resetPassword(undefined, form(STUDENT)))?.error).toMatch(/kelas Anda/);
    expect(updateUserById).not.toHaveBeenCalled();
  });

  it("refuses a teacher resetting another teacher or admin", async () => {
    target.role = "pengajar";
    expect((await resetPassword(undefined, form(STUDENT)))?.error).toBeDefined();
    expect(updateUserById).not.toHaveBeenCalled();
  });

  it("lets an admin reset any other account", async () => {
    caller.current = { id: "admin-1", role: "admin" };
    teaches.value = false;
    target.role = "pengajar";
    expect((await resetPassword(undefined, form(STUDENT)))?.password).toBeDefined();
  });

  it("refuses resetting yourself, bad ids and unknown accounts", async () => {
    caller.current = { id: STUDENT, role: "admin" };
    expect((await resetPassword(undefined, form(STUDENT)))?.error).toBeDefined();
    caller.current = { id: "admin-1", role: "admin" };
    expect((await resetPassword(undefined, form("bukan-uuid")))?.error).toBeDefined();
    target.role = null;
    expect((await resetPassword(undefined, form(STUDENT)))?.error).toBe("Akun tidak ditemukan.");
    expect(updateUserById).not.toHaveBeenCalled();
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
const revalidatePath = vi.fn();

vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ rpc }),
}));
vi.mock("@/features/auth/dal", () => ({
  requireUser: vi.fn(async () => ({ id: "00000000-0000-0000-0000-0000000000a1", role: "pengajar" })),
}));

const { archiveClass, unarchiveClass } = await import("./actions");

beforeEach(() => {
  rpc.mockReset().mockResolvedValue({ data: null, error: null });
  revalidatePath.mockReset();
});

describe("archiveClass & unarchiveClass", () => {
  const validClassId = "11111111-1111-4111-a111-111111111111";
  const form = (id: string) => {
    const f = new FormData();
    f.set("classId", id);
    return f;
  };

  it("archiveClass calls set_class_archived RPC with p_archived: true", async () => {
    await archiveClass(form(validClassId));

    expect(rpc).toHaveBeenCalledWith("set_class_archived", {
      p_class_id: validClassId,
      p_archived: true,
    });
    expect(revalidatePath).toHaveBeenCalledWith(`/kelas/${validClassId}`);
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard");
  });

  it("unarchiveClass calls set_class_archived RPC with p_archived: false", async () => {
    await unarchiveClass(form(validClassId));

    expect(rpc).toHaveBeenCalledWith("set_class_archived", {
      p_class_id: validClassId,
      p_archived: false,
    });
    expect(revalidatePath).toHaveBeenCalledWith(`/kelas/${validClassId}`);
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard");
  });

  it("throws error when RPC fails", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: "database error" } });
    await expect(archiveClass(form(validClassId))).rejects.toThrow("Gagal mengarsipkan kelas.");
  });
});

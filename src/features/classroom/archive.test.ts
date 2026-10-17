import { describe, expect, it } from "vitest";
import { checkClassCanAcceptAssignment, partitionClasses } from "./archive";

describe("partitionClasses (production helper)", () => {
  it("separates active and archived classes while preserving order and extra fields", () => {
    const classes = [
      { id: "c1", name: "Kelas X", archived_at: null, member_count: 30 },
      { id: "c2", name: "Kelas Y", archived_at: "2026-10-18T00:00:00.000Z", member_count: 25 },
      { id: "c3", name: "Kelas Z", archived_at: null, member_count: 10 },
      { id: "c4", name: "Kelas W", archived_at: "2026-09-01T12:00:00.000Z", member_count: 15 },
    ];

    const result = partitionClasses(classes);

    expect(result.active).toEqual([
      { id: "c1", name: "Kelas X", archived_at: null, member_count: 30 },
      { id: "c3", name: "Kelas Z", archived_at: null, member_count: 10 },
    ]);
    expect(result.archived).toEqual([
      { id: "c2", name: "Kelas Y", archived_at: "2026-10-18T00:00:00.000Z", member_count: 25 },
      { id: "c4", name: "Kelas W", archived_at: "2026-09-01T12:00:00.000Z", member_count: 15 },
    ]);
  });

  it("handles empty array correctly", () => {
    const result = partitionClasses([]);
    expect(result.active).toEqual([]);
    expect(result.archived).toEqual([]);
  });

  it("handles case when all classes are active", () => {
    const classes = [
      { id: "1", name: "Kelas A", archived_at: null },
      { id: "2", name: "Kelas B", archived_at: null },
    ];
    const result = partitionClasses(classes);
    expect(result.active).toHaveLength(2);
    expect(result.archived).toHaveLength(0);
  });

  it("handles case when all classes are archived", () => {
    const classes = [
      { id: "1", name: "Kelas A", archived_at: "2026-10-01T00:00:00.000Z" },
      { id: "2", name: "Kelas B", archived_at: "2026-10-02T00:00:00.000Z" },
    ];
    const result = partitionClasses(classes);
    expect(result.active).toHaveLength(0);
    expect(result.archived).toHaveLength(2);
  });
});

describe("checkClassCanAcceptAssignment (fail-closed guard)", () => {
  it("allows assignment creation when class is active and query succeeded", () => {
    const res = checkClassCanAcceptAssignment({ archived_at: null }, null);
    expect(res).toEqual({ ok: true });
  });

  it("rejects when class is archived", () => {
    const res = checkClassCanAcceptAssignment({ archived_at: "2026-10-18T00:00:00.000Z" }, null);
    expect(res).toEqual({
      ok: false,
      error: "Kelas sudah diarsipkan. Tidak dapat membuat tugas baru.",
    });
  });

  it("fails closed when query returned an error", () => {
    const res = checkClassCanAcceptAssignment(null, new Error("Database timeout"));
    expect(res).toEqual({
      ok: false,
      error: "Kelas tidak ditemukan.",
    });
  });

  it("fails closed when class data is null/not found", () => {
    const res = checkClassCanAcceptAssignment(null, null);
    expect(res).toEqual({
      ok: false,
      error: "Kelas tidak ditemukan.",
    });
  });
});

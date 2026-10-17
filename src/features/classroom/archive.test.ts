import { describe, expect, it } from "vitest";

describe("Class archive filtering and helper logic", () => {
  type ClassItem = {
    id: string;
    name: string;
    archived_at: string | null;
  };

  it("correctly separates active classes and archived classes", () => {
    const list: ClassItem[] = [
      { id: "1", name: "Kelas A", archived_at: null },
      { id: "2", name: "Kelas B", archived_at: "2026-10-18T00:00:00.000Z" },
      { id: "3", name: "Kelas C", archived_at: null },
      { id: "4", name: "Kelas D", archived_at: "2026-09-01T12:00:00.000Z" },
    ];

    const active = list.filter((c) => !c.archived_at);
    const archived = list.filter((c) => Boolean(c.archived_at));

    expect(active.map((c) => c.name)).toEqual(["Kelas A", "Kelas C"]);
    expect(archived.map((c) => c.name)).toEqual(["Kelas B", "Kelas D"]);
  });

  it("handles case when all classes are active", () => {
    const list: ClassItem[] = [
      { id: "1", name: "Kelas A", archived_at: null },
      { id: "2", name: "Kelas B", archived_at: null },
    ];

    const active = list.filter((c) => !c.archived_at);
    const archived = list.filter((c) => Boolean(c.archived_at));

    expect(active).toHaveLength(2);
    expect(archived).toHaveLength(0);
  });

  it("handles case when all classes are archived", () => {
    const list: ClassItem[] = [
      { id: "1", name: "Kelas A", archived_at: "2026-10-01T00:00:00.000Z" },
    ];

    const active = list.filter((c) => !c.archived_at);
    const archived = list.filter((c) => Boolean(c.archived_at));

    expect(active).toHaveLength(0);
    expect(archived).toHaveLength(1);
  });
});

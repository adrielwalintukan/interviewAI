import { beforeEach, describe, expect, it, vi } from "vitest";

// Contract test for GET /kelas/[id]/tugas/[tugasId]/nilai-csv with the real loader; only Supabase and the session are faked.
type Result = { data: unknown; error: unknown };
const db: { tables: Record<string, Result>; queried: string[] } = { tables: {}, queried: [] };
const session: { user: Record<string, unknown> | null } = { user: null };

function query(table: string) {
  db.queried.push(table);
  const result = () => db.tables[table] ?? { data: null, error: null };
  const b: Record<string, unknown> = {
    select: () => b,
    eq: () => b,
    order: () => b,
    returns: () => b,
    maybeSingle: async () => result(),
    then: (ok: (r: Result) => unknown, ko: (e: unknown) => unknown) => Promise.resolve(result()).then(ok, ko),
  };
  return b;
}

vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ from: query }) }));
vi.mock("@/features/auth/dal", () => ({ getCurrentUser: async () => session.user }));

const { GET } = await import("@/app/(app)/kelas/[id]/tugas/[tugasId]/nilai-csv/route");

const CLASS = "00000000-0000-4000-8000-0000000000c1";
const TASK = "00000000-0000-4000-8000-0000000000f1";
const OWNER = "00000000-0000-4000-8000-0000000000a1";
const user = (over: Record<string, unknown> = {}) => ({ id: OWNER, role: "pengajar", status: "active", mustChangePassword: false, ...over });
const get = (classId = CLASS, taskId = TASK) =>
  GET(new Request("http://x") as never, { params: Promise.resolve({ id: classId, tugasId: taskId }) } as never);

beforeEach(() => {
  session.user = user();
  db.queried = [];
  db.tables = {
    assignments: {
      data: { id: TASK, due_at: null, max_attempts: 3, scenario_version_id: "v1", classes: { name: "K", owner_id: OWNER }, v: { title: "Laundry", scenarios: null } },
      error: null,
    },
    class_members: {
      data: [
        { user_id: "s1", profiles: { display_name: "Ani", username: "ani" } },
        { user_id: "s2", profiles: { display_name: "=Budi", username: null } },
      ],
      error: null,
    },
    sessions: { data: [{ id: "x1", user_id: "s1", status: "graded", started_at: "2026-10-18T00:00:00Z", profiles: null, evaluations: { final_score: 80, reviewer_id: null, ai_result: { facts: [] } } }], error: null },
    assignment_scores: { data: [{ user_id: "s1", attempts: 1, best_score: 80 }], error: null },
  };
});

describe("nilai-csv route", () => {
  it("gives the class owner every learner, including one who never started", async () => {
    const res = await get();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/csv; charset=utf-8");
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(res.headers.get("content-disposition")).toMatch(/^attachment; filename="nilai-laundry-\d{4}-\d{2}-\d{2}\.csv"$/);
    const body = await res.text();
    expect(body).toContain("Ani,ani,1,80,Dinilai");
    expect(body).toContain("'=Budi,,0,,Belum mulai");
  });

  it("lets an admin who doesn't own the class download", async () => {
    session.user = user({ id: "admin-1", role: "admin" });
    expect((await get()).status).toBe(200);
  });

  it("answers 404 to a teacher of another class", async () => {
    session.user = user({ id: "other-teacher" });
    const res = await get();
    expect(res.status).toBe(404);
    expect(await res.text()).not.toContain("Ani");
  });

  it("answers 404 without touching the database for learners, signed-out, disabled and must-change-password users", async () => {
    for (const u of [user({ role: "pelajar" }), null, user({ status: "disabled" }), user({ status: "pending" }), user({ mustChangePassword: true })]) {
      session.user = u;
      expect((await get()).status).toBe(404);
    }
    expect(db.queried).toEqual([]);
  });

  it("answers 404 for a missing assignment and for malformed ids", async () => {
    db.tables.assignments = { data: null, error: null };
    expect((await get()).status).toBe(404);
    db.queried = [];
    for (const bad of ["bukan-uuid", "-".repeat(36), "0".repeat(36), `${CLASS.slice(0, -1)}g`]) {
      expect((await get(bad)).status).toBe(404);
      expect((await get(CLASS, bad)).status).toBe(404);
    }
    expect(db.queried).toEqual([]);
  });

  it("answers 500, not an empty CSV, when a score query fails", async () => {
    db.tables.assignment_scores = { data: null, error: { message: "boom" } };
    const res = await get();
    expect(res.status).toBe(500);
    expect(res.headers.get("content-type")).not.toMatch(/csv/);
  });

  it("does not turn a failed assignment query into 404", async () => {
    db.tables.assignments = { data: null, error: { message: "boom" } };
    await expect(get()).rejects.toEqual({ message: "boom" });
  });
});

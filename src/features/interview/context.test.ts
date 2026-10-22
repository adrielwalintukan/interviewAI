import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
const { sessionMinutes } = await import("./context");

describe("sessionMinutes", () => {
  const started_at = "2026-10-22T10:00:00Z";

  it("is the planned total, whatever time it is now", () => {
    vi.useFakeTimers({ now: Date.parse("2026-10-22T10:03:00Z") });
    expect(sessionMinutes({ started_at, ends_at: "2026-10-22T10:05:00Z" })).toBe(5);
    vi.useRealTimers();
  });

  it("rounds to whole minutes", () => {
    expect(sessionMinutes({ started_at, ends_at: "2026-10-22T10:09:59.400Z" })).toBe(10);
    expect(sessionMinutes({ started_at, ends_at: "2026-10-22T10:15:29Z" })).toBe(15);
  });
});

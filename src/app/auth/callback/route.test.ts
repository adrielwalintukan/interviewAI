import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = { verifyOtp: vi.fn(), exchangeCodeForSession: vi.fn() };
const rpc = vi.fn();
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth, rpc }) }));
const { GET } = await import("./route");

const call = async (query: string) => (await GET(new NextRequest(`http://localhost:3000/auth/callback?${query}`))).headers.get("location");

beforeEach(() => {
  auth.verifyOtp.mockReset().mockResolvedValue({ error: null });
  auth.exchangeCodeForSession.mockReset().mockResolvedValue({ error: null });
  rpc.mockReset();
});

describe("auth callback", () => {
  it("confirms an email link by token hash, on any device (no PKCE verifier needed)", async () => {
    expect(await call("token_hash=h1")).toBe("http://localhost:3000/dashboard");
    expect(auth.verifyOtp).toHaveBeenCalledWith({ type: "email", token_hash: "h1" });
  });

  it("sends a dead confirmation link to the sign-in page with its own message", async () => {
    auth.verifyOtp.mockResolvedValue({ error: new Error("expired") });
    expect(await call("token_hash=h1")).toBe("http://localhost:3000/masuk?error=konfirmasi");
  });

  it("asks for the teacher role only when the sign-up picked Pengajar before Google", async () => {
    await call("code=c1&next=%2Fdashboard");
    expect(rpc).not.toHaveBeenCalled();
    await call("code=c1&next=%2Fdashboard&peran=pengajar");
    expect(rpc).toHaveBeenCalledWith("request_teacher_role");
  });

  it("never asks for the role when the Google exchange failed", async () => {
    auth.exchangeCodeForSession.mockResolvedValue({ error: new Error("bad code") });
    expect(await call("code=c1&peran=pengajar")).toBe("http://localhost:3000/masuk?error=google");
    expect(rpc).not.toHaveBeenCalled();
  });
});

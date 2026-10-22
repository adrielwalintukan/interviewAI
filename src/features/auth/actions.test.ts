import { beforeEach, describe, expect, it, vi } from "vitest";

const reqHeaders = new Headers();
const auth = { signUp: vi.fn(), signInWithOAuth: vi.fn() };
const redirect = vi.fn((to: string) => {
  throw new Error(`redirect:${to}`);
});
vi.mock("next/headers", () => ({ headers: async () => reqHeaders }));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth }) }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("./dal", () => ({ loadCurrentUser: vi.fn() }));
const { signUp, signInWithGoogle } = await import("./actions");

const form = (fields: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
};
const signUpForm = form({ displayName: "Guru Uji", email: "guru@test.local", password: "rahasia123", role: "pengajar" });

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_AUTH_GOOGLE_ENABLED", "true");
  reqHeaders.delete("origin");
  auth.signUp.mockReset().mockResolvedValue({ data: { session: null }, error: null });
  auth.signInWithOAuth.mockReset().mockResolvedValue({ data: { url: "https://accounts.example/o" }, error: null });
});

describe("redirect links use the request's own origin", () => {
  it("confirmation email comes back to the origin that signed up (staging stays staging)", async () => {
    reqHeaders.set("origin", "https://staging.example.app");
    expect(await signUp(undefined, signUpForm)).toEqual({ ok: "Cek email Anda untuk konfirmasi, lalu masuk." });
    expect(auth.signUp.mock.calls[0]![0].options.emailRedirectTo).toBe("https://staging.example.app/auth/callback");
  });

  it("refuses to sign up without an Origin instead of sending a relative link", async () => {
    expect((await signUp(undefined, signUpForm))?.error).toBe("Pendaftaran gagal. Coba lagi sebentar lagi.");
    expect(auth.signUp).not.toHaveBeenCalled();
  });

  it("Google carries the chosen role to the callback", async () => {
    reqHeaders.set("origin", "https://app.example");
    await expect(signInWithGoogle(form({ next: "/dashboard", role: "pengajar" }))).rejects.toThrow("redirect:https://accounts.example/o");
    expect(auth.signInWithOAuth.mock.calls[0]![0].options.redirectTo).toBe("https://app.example/auth/callback?next=%2Fdashboard&peran=pengajar");
  });

  it("refuses Google without an Origin", async () => {
    await expect(signInWithGoogle(form({}))).rejects.toThrow("redirect:/masuk?error=google");
    expect(auth.signInWithOAuth).not.toHaveBeenCalled();
  });
});

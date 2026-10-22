import { NextResponse, type NextRequest } from "next/server";
import { safeNextPath } from "@/features/auth/identifier";
import { createClient } from "@/lib/supabase/server";

// Two returns land here: the Google (OAuth PKCE) `code`, and the confirmation-email link's `token_hash`.
// The email template links to {{ .RedirectTo }}?token_hash=…, so confirming works on any device and on staging.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const next = safeNextPath(searchParams.get("next"));
  const supabase = await createClient();

  if (tokenHash) {
    const { error } = await supabase.auth.verifyOtp({ type: "email", token_hash: tokenHash });
    return NextResponse.redirect(error ? `${origin}/masuk?error=konfirmasi` : `${origin}${next}`);
  }
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // workflow §1: the role picked on /daftar before Google. The RPC only moves a brand-new account to pending,
      // and answers false for an existing pelajar. Never leave a silent pelajar behind a "Pengajar" choice.
      if (searchParams.get("peran") === "pengajar") {
        const { data, error: roleError } = await supabase.rpc("request_teacher_role");
        if (roleError || data !== true) {
          await supabase.auth.signOut();
          return NextResponse.redirect(`${origin}/masuk?error=${roleError ? "peran-gagal" : "peran-ditolak"}`);
        }
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }
  return NextResponse.redirect(`${origin}/masuk?error=google`);
}

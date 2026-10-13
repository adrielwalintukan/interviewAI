import { NextResponse, type NextRequest } from "next/server";
import { safeNextPath } from "@/features/auth/identifier";
import { createClient } from "@/lib/supabase/server";

// OAuth (Google) PKCE return: swap the one-time code for a session cookie.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }
  return NextResponse.redirect(`${origin}/masuk?error=google`);
}

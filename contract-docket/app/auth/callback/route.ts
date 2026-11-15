import { NextResponse } from "next/server";
import { isAllowedEmail } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

function redirectTo(request: Request, path: string) {
  return NextResponse.redirect(new URL(path, request.url));
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  if (!code) {
    return redirectTo(request, "/login?error=invalid-link");
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;

    if (!data.user?.email || !isAllowedEmail(data.user.email)) {
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) throw signOutError;
      return redirectTo(request, "/login?error=not-authorized");
    }

    const requestedPath = url.searchParams.get("next");
    const nextPath =
      requestedPath?.startsWith("/") && !requestedPath.startsWith("//")
        ? requestedPath
        : "/";
    return redirectTo(request, nextPath);
  } catch (error) {
    console.error("Could not complete authentication.", error);
    return redirectTo(request, "/login?error=authentication-failed");
  }
}

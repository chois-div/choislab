import { NextResponse } from "next/server";
import { isAllowedEmail } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

function getCallbackUrl() {
  const appUrl = process.env.APP_URL?.trim();
  if (!appUrl) throw new Error("APP_URL_MISSING");
  const baseUrl = new URL(appUrl);
  if (baseUrl.protocol !== "https:" && baseUrl.hostname !== "localhost") {
    throw new Error("APP_URL_MUST_USE_HTTPS");
  }
  return new URL("/auth/callback", baseUrl).toString();
}

export async function POST(request: Request) {
  try {
    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return NextResponse.json({ error: "이메일 주소를 확인해 주세요." }, { status: 400 });
    }
    if (!payload || typeof payload !== "object") {
      return NextResponse.json({ error: "이메일 주소를 확인해 주세요." }, { status: 400 });
    }

    const email = (payload as { email?: unknown }).email;
    if (
      typeof email !== "string" ||
      email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
    ) {
      return NextResponse.json({ error: "이메일 주소를 확인해 주세요." }, { status: 400 });
    }
    if (!isAllowedEmail(email)) {
      return NextResponse.json({
        message: "접근 권한이 있는 이메일이면 로그인 링크를 보냈습니다.",
      });
    }

    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: {
        shouldCreateUser: false,
        emailRedirectTo: getCallbackUrl(),
      },
    });
    if (error) {
      console.error("Could not send an authentication link.", error);
      return NextResponse.json(
        { error: "로그인 링크를 보내지 못했습니다. 인증 메일 설정을 확인해 주세요." },
        { status: 502 },
      );
    }

    return NextResponse.json({
      message: "접근 권한이 있는 이메일이면 로그인 링크를 보냈습니다.",
    });
  } catch (error) {
    console.error("Could not start authentication.", error);
    return NextResponse.json({ error: "로그인을 시작하지 못했습니다." }, { status: 500 });
  }
}

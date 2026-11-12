import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST() {
  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    return NextResponse.json({ signedOut: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Could not sign out.", error);
    return NextResponse.json({ error: "로그아웃하지 못했습니다." }, { status: 500 });
  }
}

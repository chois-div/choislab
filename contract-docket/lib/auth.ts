import { createSupabaseServerClient } from "@/lib/supabase/server";

function getAllowedEmails() {
  const value = process.env.CONTRACT_ACCESS_EMAILS?.trim();
  if (!value) {
    throw new Error("CONTRACT_ACCESS_EMAILS_MISSING");
  }

  const emails = value
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  if (emails.length === 0 || emails.some((email) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
    throw new Error("CONTRACT_ACCESS_EMAILS_INVALID");
  }
  return new Set(emails);
}

export function isAllowedEmail(email: string) {
  return getAllowedEmails().has(email.trim().toLowerCase());
}

export async function getDashboardUser() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error && error.name !== "AuthSessionMissingError") {
    throw error;
  }

  const user = data.user;
  if (!user?.email || !isAllowedEmail(user.email)) {
    return null;
  }
  return { id: user.id, email: user.email };
}

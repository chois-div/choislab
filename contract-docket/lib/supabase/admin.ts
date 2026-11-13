import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getSupabasePublicConfig, getSupabaseServiceRoleKey } from "@/lib/supabase/env";
import type { Database } from "@/lib/supabase/types";

export function createSupabaseAdminClient() {
  const { url } = getSupabasePublicConfig();
  return createClient<Database>(url, getSupabaseServiceRoleKey(), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

import { createClient } from "@supabase/supabase-js";
import { env } from "./env";

/**
 * Server-side Supabase client for import scripts.
 * Uses the service role key — full write access. Do NOT bundle this into the app.
 */
export const db = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

import { createClient } from "@supabase/supabase-js"

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim()
const supabaseKey = (
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY
)?.trim()

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey)

// A local placeholder keeps static builds working before environment variables
// are configured. Authentication is disabled while configuration is missing.
export const supabase = createClient(
  supabaseUrl || "http://127.0.0.1:54321",
  supabaseKey || "supabase-not-configured",
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  }
)

export function getSupabaseConfigurationError() {
  if (isSupabaseConfigured) return null
  return "Configure VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY para acessar a plataforma."
}

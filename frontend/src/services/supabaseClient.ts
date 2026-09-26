import { createClient } from '@supabase/supabase-js'
import { authStorage } from './authStorage'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  { auth: { storage: authStorage } },
)

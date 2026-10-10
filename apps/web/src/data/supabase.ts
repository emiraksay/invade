import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** Read-only client (RLS allows selects only). All writes go through /api. */
export const supabase: SupabaseClient | null = url && anonKey ? createClient(url, anonKey) : null;

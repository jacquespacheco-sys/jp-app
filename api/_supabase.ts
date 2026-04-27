import './_env.js'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../src/types/database.js'

let _client: SupabaseClient<Database> | null = null

export function getSupabase(): SupabaseClient<Database> {
  if (!_client) {
    const url = process.env['SUPABASE_URL']
    const key = process.env['SUPABASE_SERVICE_KEY']
    if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY are required')
    _client = createClient<Database>(url, key)
  }
  return _client
}

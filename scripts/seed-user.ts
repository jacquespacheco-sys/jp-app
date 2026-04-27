/**
 * Cria ou atualiza o usuário principal no Supabase.
 * Uso: npx tsx scripts/seed-user.ts <senha>
 * Requer SUPABASE_URL e SUPABASE_SERVICE_KEY no .env.local
 */
import { createClient } from '@supabase/supabase-js'
import bcrypt from 'bcryptjs'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

function loadEnv() {
  const path = resolve(process.cwd(), '.env.local')
  if (!existsSync(path)) {
    console.error('❌  .env.local não encontrado')
    process.exit(1)
  }
  const content = readFileSync(path, 'utf-8')
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx === -1) continue
    const key = trimmed.slice(0, idx).trim()
    const raw = trimmed.slice(idx + 1)
    // strip inline comments and surrounding whitespace/quotes
    const val = raw.replace(/#.*$/, '').trim().replace(/^['"]|['"]$/g, '')
    if (key && val && !(key in process.env)) process.env[key] = val
  }
}

loadEnv()

const url = process.env['SUPABASE_URL']
const key = process.env['SUPABASE_SERVICE_KEY']
const password = process.argv[2]

if (!url || !key) {
  console.error('❌  SUPABASE_URL e SUPABASE_SERVICE_KEY são obrigatórias no .env.local')
  process.exit(1)
}
if (!password) {
  console.error('Uso: npx tsx scripts/seed-user.ts <senha>')
  process.exit(1)
}

const supabase = createClient(url, key)
const hash = await bcrypt.hash(password, 12)

const { data, error } = await supabase
  .from('users')
  .upsert(
    {
      email: 'jp@state.is',
      password_hash: hash,
      name: 'Jorge',
      timezone: 'America/Sao_Paulo',
      theme: 'dark',
    },
    { onConflict: 'email' }
  )
  .select('id, email, name')
  .single()

if (error) {
  console.error('❌  Erro:', error.message)
  process.exit(1)
}

console.log('✅  Usuário criado/atualizado:', data.id, data.email)

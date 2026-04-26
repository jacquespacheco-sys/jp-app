import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

function loadEnvFile(p: string) {
  if (!existsSync(p)) return
  const content = readFileSync(p, 'utf-8')
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx === -1) continue
    const key = trimmed.slice(0, idx).trim()
    const val = trimmed.slice(idx + 1).trim()
    if (key && !(key in process.env)) process.env[key] = val
  }
}

// Load all env files — later files don't override earlier ones
loadEnvFile(resolve(process.cwd(), '.vercel', '.env.development.local'))
loadEnvFile(resolve(process.cwd(), '.env.local'))

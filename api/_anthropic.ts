import './_env.js'
import Anthropic from '@anthropic-ai/sdk'

let _client: Anthropic | null = null

export function getAnthropic(): Anthropic {
  if (_client) return _client
  const apiKey = process.env['ANTHROPIC_API_KEY']
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY não configurada')
  _client = new Anthropic({ apiKey })
  return _client
}

// LLMs often wrap JSON in prose or markdown fences. Find the first top-level
// balanced {...} and parse it. Returns null on failure.
export function parseJsonFromLlm<T = unknown>(raw: string): T | null {
  if (!raw) return null
  const stripped = raw.trim().replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '')
  const start = stripped.indexOf('{')
  if (start === -1) return null
  let depth = 0
  let end = -1
  for (let i = start; i < stripped.length; i++) {
    const ch = stripped[i]
    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) { end = i; break }
    }
  }
  if (end === -1) return null
  try {
    return JSON.parse(stripped.slice(start, end + 1)) as T
  } catch {
    return null
  }
}

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

export function htmlEscape(s: string): string {
  return s.replace(/[&<>"']/g, c => HTML_ESCAPES[c] ?? c)
}

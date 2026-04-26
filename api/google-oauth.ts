import { requireAuth } from './_middleware.ts'
import { getOAuthClient, getOAuthUrl } from './_google.ts'
import { getSupabase } from './_supabase.ts'
import jwt from 'jsonwebtoken'
import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).end()

  // Return auth URL for frontend to redirect to
  if (req.query['action'] === 'url') {
    const user = requireAuth(req, res)
    if (!user) return
    const secret = process.env['JWT_SECRET']!
    const state = jwt.sign({ userId: user.id }, secret, { expiresIn: '10m' })
    const url = getOAuthUrl(state)
    return res.status(200).json({ url })
  }

  // OAuth callback from Google — cookie not available on cross-site redirect, use state instead
  const code = req.query['code']
  const stateParam = req.query['state']
  if (typeof code === 'string' && typeof stateParam === 'string') {
    const appUrl = process.env['APP_URL'] ?? 'http://localhost:3000'
    try {
      const secret = process.env['JWT_SECRET']!
      const { userId } = jwt.verify(stateParam, secret) as { userId: string }

      const client = getOAuthClient()
      const { tokens } = await client.getToken(code)
      const refreshToken = tokens.refresh_token

      if (refreshToken) {
        const supabase = getSupabase()
        await supabase
          .from('users')
          .update({ google_refresh_token: refreshToken, updated_at: new Date().toISOString() })
          .eq('id', userId)
      }

      return res.redirect(302, `${appUrl}/config?connected=google`)
    } catch {
      return res.redirect(302, `${appUrl}/config?error=google`)
    }
  }

  return res.status(400).json({ error: 'parâmetro inválido' })
}

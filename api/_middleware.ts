import './_env.ts'
import jwt from 'jsonwebtoken'
import { parse } from 'cookie'
import type { VercelRequest, VercelResponse } from '@vercel/node'

export interface AuthUser {
  id: string
  email: string
  name: string
  timezone: string
  theme: string
}

export function requireAuth(req: VercelRequest, res: VercelResponse): AuthUser | null {
  try {
    const cookies = parse(req.headers.cookie ?? '')
    const token = cookies['token']
    if (!token) {
      res.status(401).json({ error: 'não autenticado' })
      return null
    }
    const secret = process.env['JWT_SECRET']
    if (!secret) throw new Error('JWT_SECRET not configured')
    const user = jwt.verify(token, secret) as AuthUser
    return user
  } catch {
    res.status(401).json({ error: 'token inválido' })
    return null
  }
}

export function requireCron(req: VercelRequest, res: VercelResponse): boolean {
  const auth = req.headers['authorization']
  const expected = `Bearer ${process.env['CRON_SECRET'] ?? ''}`
  if (auth !== expected) {
    res.status(401).end()
    return false
  }
  return true
}

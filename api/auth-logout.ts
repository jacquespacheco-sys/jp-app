import { serialize } from 'cookie'
import type { VercelRequest, VercelResponse } from '@vercel/node'

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const cookie = serialize('token', '', {
    httpOnly: true,
    secure: process.env['NODE_ENV'] === 'production',
    sameSite: 'strict',
    maxAge: 0,
    path: '/',
  })

  res.setHeader('Set-Cookie', cookie)
  return res.status(200).json({ ok: true })
}

import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { serialize } from 'cookie'
import { z } from 'zod'
import { getSupabase } from './_supabase.ts'
import type { VercelRequest, VercelResponse } from '@vercel/node'

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const parsed = LoginSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: 'email e senha obrigatórios' })
  }

  const { email, password } = parsed.data
  const supabase = getSupabase()

  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('email', email)
    .single()

  if (error) return res.status(401).json({ error: 'credenciais inválidas' })
  if (!data) return res.status(401).json({ error: 'credenciais inválidas' })
  const user = data

  const valid = await bcrypt.compare(password, user.password_hash)
  if (!valid) {
    return res.status(401).json({ error: 'credenciais inválidas' })
  }

  const secret = process.env['JWT_SECRET']
  if (!secret) return res.status(500).json({ error: 'configuração inválida' })

  const payload = {
    id: user.id,
    email: user.email,
    name: user.name,
    timezone: user.timezone,
    theme: user.theme,
  }

  const token = jwt.sign(payload, secret, { expiresIn: '7d' })

  const cookie = serialize('token', token, {
    httpOnly: true,
    secure: process.env['NODE_ENV'] === 'production',
    sameSite: 'strict',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  })

  res.setHeader('Set-Cookie', cookie)
  return res.status(200).json({ user: payload })
}

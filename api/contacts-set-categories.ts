import { requireAuth } from './_middleware.js'
import { getSupabase } from './_supabase.js'
import { ContactSetCategoriesSchema } from './_schemas/contact-category.js'
import { mapContact } from './contacts-list.js'
import { mapCategory } from './categories-list.js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const user = requireAuth(req, res)
  if (!user) return

  const parsed = ContactSetCategoriesSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'dados inválidos' })
  }

  const { contactId, categoryIds } = parsed.data
  const supabase = getSupabase()

  const { data: contact } = await supabase
    .from('contacts')
    .select('id')
    .eq('id', contactId)
    .eq('user_id', user.id)
    .single()
  if (!contact) return res.status(404).json({ error: 'contato não encontrado' })

  if (categoryIds.length > 0) {
    const { data: cats } = await supabase
      .from('categories')
      .select('id')
      .in('id', categoryIds)
      .eq('user_id', user.id)
    if (!cats || cats.length !== new Set(categoryIds).size) {
      return res.status(400).json({ error: 'categoria(s) não encontrada(s) ou de outro user' })
    }
  }

  const { error: delErr } = await supabase
    .from('contact_categories')
    .delete()
    .eq('contact_id', contactId)
    .eq('user_id', user.id)
  if (delErr) return res.status(500).json({ error: delErr.message })

  if (categoryIds.length > 0) {
    const rows = categoryIds.map(category_id => ({
      user_id: user.id,
      contact_id: contactId,
      category_id,
    }))
    const { error: insErr } = await supabase.from('contact_categories').insert(rows)
    if (insErr) return res.status(500).json({ error: insErr.message })
  }

  const { data: catRows } = await supabase
    .from('categories')
    .select('*, category_dimensions:dimension_id(label, slug)')
    .in('id', categoryIds.length > 0 ? categoryIds : ['00000000-0000-0000-0000-000000000000'])
    .eq('user_id', user.id)

  const { data: cRow } = await supabase
    .from('contacts')
    .select('*')
    .eq('id', contactId)
    .eq('user_id', user.id)
    .single()

  const contactDto = cRow ? mapContact(cRow as Record<string, unknown>) : null
  const categories = (catRows ?? []).map(r => mapCategory(r as Record<string, unknown>))

  return res.status(200).json({
    contact: contactDto ? { ...contactDto, categories } : null,
  })
}

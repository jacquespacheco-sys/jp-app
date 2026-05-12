import { requireAuth } from './_middleware.js'
import { getSupabase } from './_supabase.js'
import Anthropic from '@anthropic-ai/sdk'
import { TaskClassifyRequestSchema, TaskClassifyResponseSchema } from './_schemas/task-classify.js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

const MODEL = 'claude-haiku-4-5-20251001'

const SYSTEM_PROMPT = `Você é um classificador AQAL/GTD para tasks pessoais do Jorge (founder do STATE Innovation Center).

Sua função: dado o título de uma task e a lista de áreas de vida ativas do usuário, sugerir a classificação AQAL.

ÁREAS DISPONÍVEIS (com seus quadrantes):
{{AREAS}}

DIMENSÕES:
- areaId: uuid de uma das áreas acima (string), ou null se ambíguo
- context: tipo de atenção exigido — deep (foco profundo, criativo cognitivo), shallow (administrativo), social (interação com pessoas), criativo (não-cognitivo), somatico (corpo/movimento), offline (sem tela)
- energy: 1-5 — energia mental requerida (1=baixíssima, 5=máxima)
- timeEstimateMin: estimativa em minutos
- rationale: frase curta justificando
- confidence: high | medium | low

Responda EXCLUSIVAMENTE com JSON válido conforme o schema. Sem markdown, sem prosa. Use null para campos que não conseguir estimar com segurança.`

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const user = requireAuth(req, res)
  if (!user) return

  const parsed = TaskClassifyRequestSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: 'taskId ou inboxItemId obrigatório' })
  }

  const supabase = getSupabase()

  let title: string
  let inputId: string
  let isTask = false

  if ('taskId' in parsed.data) {
    inputId = parsed.data.taskId
    const { data, error } = await supabase
      .from('tasks').select('title').eq('id', inputId).eq('user_id', user.id).single()
    if (error || !data) return res.status(404).json({ error: 'task não encontrada' })
    title = data.title
    isTask = true
  } else {
    inputId = parsed.data.inboxItemId
    const { data, error } = await supabase
      .from('inbox_items').select('raw_text').eq('id', inputId).eq('user_id', user.id).single()
    if (error || !data) return res.status(404).json({ error: 'inbox_item não encontrado' })
    title = data.raw_text
  }

  const { data: areas, error: areasErr } = await supabase
    .from('areas')
    .select('id,name,quadrant')
    .eq('user_id', user.id)
    .is('archived_at', null)

  if (areasErr) return res.status(500).json({ error: areasErr.message })

  const areasText = (areas ?? [])
    .map(a => `- ${a.id} | ${a.name} (quadrante ${a.quadrant})`)
    .join('\n') || '(nenhuma área cadastrada)'

  const apiKey = process.env['ANTHROPIC_API_KEY']
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY não configurada' })

  const anthropic = new Anthropic({ apiKey })

  let raw: string
  try {
    const resp = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 400,
      system: SYSTEM_PROMPT.replace('{{AREAS}}', areasText),
      messages: [{ role: 'user', content: `Classifique: "${title}"` }],
    })
    raw = resp.content
      .filter(b => b.type === 'text')
      .map(b => (b as { text: string }).text)
      .join('')
  } catch (e) {
    console.error('[tasks-classify] Haiku call failed:', e instanceof Error ? e.message : e)
    return res.status(502).json({ error: 'Haiku indisponível' })
  }

  let parsedJson: unknown
  try {
    const stripped = raw.trim().replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
    parsedJson = JSON.parse(stripped)
  } catch {
    console.error('[tasks-classify] resposta não-JSON:', raw)
    return res.status(200).json({
      classification: {
        areaId: null, context: null, energy: null, timeEstimateMin: null,
        rationale: 'parsing falhou', confidence: 'low' as const,
      },
    })
  }

  const validated = TaskClassifyResponseSchema.safeParse(parsedJson)
  if (!validated.success) {
    console.error('[tasks-classify] resposta inválida:', validated.error.issues)
    return res.status(200).json({
      classification: {
        areaId: null, context: null, energy: null, timeEstimateMin: null,
        rationale: 'schema falhou', confidence: 'low' as const,
      },
    })
  }

  if (isTask) {
    const { data: updated } = await supabase
      .from('tasks')
      .update({ ai_classified: true })
      .eq('id', inputId)
      .eq('user_id', user.id)
      .select()
      .single()
    return res.status(200).json({ classification: validated.data, task: updated })
  }

  await supabase
    .from('inbox_items')
    .update({ ai_suggestion: validated.data })
    .eq('id', inputId)
    .eq('user_id', user.id)

  return res.status(200).json({ classification: validated.data })
}

import { requireAuth } from './_middleware.js'
import { getSupabase } from './_supabase.js'
import { getAnthropic, parseJsonFromLlm } from './_anthropic.js'
import { ContactSuggestMessageSchema } from './_schemas/suggest-message.js'
import { formatInTimeZone } from 'date-fns-tz'
import type { VercelRequest, VercelResponse } from '@vercel/node'

export const maxDuration = 30

const MODEL = 'claude-haiku-4-5-20251001'

const INTENT_HINT: Record<string, string> = {
  reconnect: 'reaproximação após silêncio — sem pesar a outra pessoa pelo gap',
  thank: 'agradecimento concreto e específico, não genérico',
  follow_up: 'sequência de uma conversa anterior, mantém momentum',
  ask: 'pedido específico, respeitando o tempo da pessoa',
  congratulate: 'celebração de conquista — específico ao que aconteceu',
  condolences: 'tom sóbrio, não performático, sem clichês',
  other: 'tom apropriado ao contexto',
}

interface SuggestionAngle {
  tone: string
  message: string
  rationale: string
}

interface ContactRow {
  id: string
  first_name: string
  last_name: string | null
  preferred_name: string | null
  pronunciation: string | null
  company: string | null
  role: string | null
  tier: string | null
  preferred_channel: string | null
  interests: string[] | null
  conversation_hooks: string[] | null
  what_they_value: string | null
  their_goals: string | null
  family: { spouse?: string; children?: string[]; pets?: string[] } | null
  last_interaction_at: string | null
}

interface InteractionRow {
  date: string
  type: string
  note: string | null
  sentiment: string | null
  topics_discussed: string[] | null
  carnegie_tags: string[] | null
  new_learning: string | null
}

interface ComplimentRow {
  text: string
  received_at: string
  reciprocated: boolean
}

interface UpcomingSpecialDate {
  label: string
  type: string
  date_anniversary: string | null
  date_full: string | null
}

function buildPrompt(params: {
  contact: ContactRow
  interactions: InteractionRow[]
  compliments: ComplimentRow[]
  upcoming: UpcomingSpecialDate[]
  userContext: string
  intent: string | undefined
}): string {
  const { contact, interactions, compliments, upcoming, userContext, intent } = params

  const nameLine = contact.preferred_name
    ? `${contact.preferred_name} (registrado como ${contact.first_name}${contact.last_name ? ' ' + contact.last_name : ''})`
    : `${contact.first_name}${contact.last_name ? ' ' + contact.last_name : ''}`

  const bio: string[] = [`Nome: ${nameLine}`]
  if (contact.pronunciation) bio.push(`Pronúncia: ${contact.pronunciation}`)
  if (contact.role || contact.company) bio.push(`Trabalho: ${[contact.role, contact.company].filter(Boolean).join(' @ ')}`)
  if (contact.tier) bio.push(`Tier relacional: ${contact.tier}`)
  if (contact.preferred_channel) bio.push(`Canal preferido: ${contact.preferred_channel}`)
  if ((contact.interests ?? []).length > 0) bio.push(`Interesses: ${contact.interests!.join(', ')}`)
  if ((contact.conversation_hooks ?? []).length > 0) bio.push(`Hooks de conversa: ${contact.conversation_hooks!.join(', ')}`)
  if (contact.what_they_value) bio.push(`O que valorizam: ${contact.what_they_value}`)
  if (contact.their_goals) bio.push(`Querem: ${contact.their_goals}`)
  if (contact.family) {
    const fam: string[] = []
    if (contact.family.spouse) fam.push(`cônjuge ${contact.family.spouse}`)
    if (contact.family.children?.length) fam.push(`filhos: ${contact.family.children.join(', ')}`)
    if (contact.family.pets?.length) fam.push(`pets: ${contact.family.pets.join(', ')}`)
    if (fam.length) bio.push(`Família: ${fam.join('; ')}`)
  }
  if (contact.last_interaction_at) {
    const daysAgo = Math.floor((Date.now() - new Date(contact.last_interaction_at).getTime()) / 86400000)
    bio.push(`Último contato: ${daysAgo} dias atrás`)
  } else {
    bio.push(`Último contato: sem registro`)
  }

  const intLines = interactions.length === 0
    ? '(nenhuma interação registrada)'
    : interactions.map(i => {
        const date = i.date.slice(0, 10)
        const parts = [`${date} · ${i.type}`]
        if (i.sentiment) parts.push(`(${i.sentiment})`)
        if (i.note) parts.push(`— ${i.note.slice(0, 200)}`)
        if (i.new_learning) parts.push(`[aprendi: ${i.new_learning}]`)
        return parts.join(' ')
      }).join('\n')

  const compLines = compliments.length === 0
    ? '(nenhum elogio registrado)'
    : compliments.map(c => `${c.received_at.slice(0, 10)} (${c.reciprocated ? 'retribuído' : 'pendente'}): ${c.text.slice(0, 200)}`).join('\n')

  const upcomingLines = upcoming.length === 0
    ? '(nenhuma)'
    : upcoming.map(d => `${d.label} (${d.type}) — ${d.date_anniversary ?? d.date_full ?? '?'}`).join('\n')

  return `Você está ajudando o Jorge a redigir uma mensagem para ${nameLine}.

CONTEXTO DA PESSOA:
${bio.join('\n')}

ÚLTIMAS INTERAÇÕES:
${intLines}

ELOGIOS RECEBIDOS RECENTEMENTE:
${compLines}

DATAS PRÓXIMAS:
${upcomingLines}

PEDIDO DO JORGE:
"${userContext}"
${intent ? `Intenção: ${intent} — ${INTENT_HINT[intent] ?? ''}` : ''}

Gere DOIS ângulos de mensagem distintos, aplicando princípios de Dale Carnegie (interesse genuíno, eager want, hooks pessoais, especificidade > generalidade). Cada um deve:
- Soar humano, não corporativo
- Ser curto (1-3 parágrafos)
- Usar o nome preferido se houver
- Ancorar em algo específico desse contato (interesse / hook / família / última interação) quando aplicável
- Adaptar tom ao canal e tier

Responda APENAS com JSON exato:
{
  "angles": [
    { "tone": "ex: caloroso e direto", "message": "...", "rationale": "por que esse tom, em uma linha" },
    { "tone": "ex: profissional respeitoso", "message": "...", "rationale": "..." }
  ]
}`
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const user = requireAuth(req, res)
  if (!user) return

  const parsed = ContactSuggestMessageSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'dados inválidos' })
  }

  const d = parsed.data
  const supabase = getSupabase()

  const [contactRes, intRes, compRes, userRes] = await Promise.all([
    supabase
      .from('contacts')
      .select('id, first_name, last_name, preferred_name, pronunciation, company, role, tier, preferred_channel, interests, conversation_hooks, what_they_value, their_goals, family, last_interaction_at')
      .eq('id', d.contactId)
      .eq('user_id', user.id)
      .single(),
    supabase
      .from('interactions')
      .select('date, type, note, sentiment, topics_discussed, carnegie_tags, new_learning')
      .eq('contact_id', d.contactId)
      .order('date', { ascending: false })
      .limit(3),
    supabase
      .from('compliments_received')
      .select('text, received_at, reciprocated')
      .eq('user_id', user.id)
      .eq('contact_id', d.contactId)
      .order('received_at', { ascending: false })
      .limit(3),
    supabase.from('users').select('timezone').eq('id', user.id).single(),
  ])

  if (contactRes.error || !contactRes.data) {
    return res.status(404).json({ error: 'contato não encontrado' })
  }
  const contact = contactRes.data as unknown as ContactRow
  const interactions = (intRes.data ?? []) as unknown as InteractionRow[]
  const compliments = (compRes.data ?? []) as unknown as ComplimentRow[]
  const tz = (userRes.data?.timezone as string | undefined) ?? 'America/Sao_Paulo'

  const ddmmList: string[] = []
  const dateMap = new Map<string, string>()
  for (let i = 0; i < 14; i++) {
    const dt = new Date(Date.now() + i * 86400000)
    const k = formatInTimeZone(dt, tz, 'dd/MM')
    const iso = formatInTimeZone(dt, tz, 'yyyy-MM-dd')
    ddmmList.push(k)
    if (!dateMap.has(k)) dateMap.set(k, iso)
  }
  const todayIso = formatInTimeZone(new Date(), tz, 'yyyy-MM-dd')
  const endIso = formatInTimeZone(new Date(Date.now() + 14 * 86400000), tz, 'yyyy-MM-dd')

  const { data: sdData } = await supabase
    .from('special_dates')
    .select('label, type, date_anniversary, date_full')
    .eq('user_id', user.id)
    .eq('contact_id', d.contactId)
    .or(`date_anniversary.in.(${ddmmList.map(x => `"${x}"`).join(',')}),and(date_full.gte.${todayIso},date_full.lte.${endIso})`)

  const upcoming = (sdData ?? []) as unknown as UpcomingSpecialDate[]

  const prompt = buildPrompt({
    contact, interactions, compliments, upcoming,
    userContext: d.context,
    intent: d.intent,
  })

  const anthropic = getAnthropic()
  const msg = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1500,
    messages: [{ role: 'user', content: prompt }],
  })
  const raw = msg.content[0]?.type === 'text' ? msg.content[0].text : ''
  const parsedOut = parseJsonFromLlm<{ angles: SuggestionAngle[] }>(raw)
  if (!parsedOut || !Array.isArray(parsedOut.angles)) {
    return res.status(500).json({ error: 'não foi possível gerar sugestões' })
  }

  return res.status(200).json({
    angles: parsedOut.angles.slice(0, 2),
    tokensIn: msg.usage.input_tokens,
    tokensOut: msg.usage.output_tokens,
  })
}

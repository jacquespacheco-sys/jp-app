import { getAnthropic, parseJsonFromLlm } from './_anthropic.js'
import type { Database } from '../src/types/database.js'

type CounselorRow = Database['public']['Tables']['hill_mastermind_counselors']['Row']
type SessionRow = Database['public']['Tables']['hill_mastermind_sessions']['Row']

export function mapCounselor(r: CounselorRow) {
  return {
    id: r.id,
    name: r.name,
    shortLabel: r.short_label,
    archetype: r.archetype,
    isRealPerson: r.is_real_person,
    contextPrompt: r.context_prompt ?? undefined,
    isActive: r.is_active,
    displayOrder: r.display_order,
    createdAt: r.created_at,
  }
}

export function mapSession(r: SessionRow) {
  return {
    id: r.id,
    question: r.question,
    counselorResponses: r.counselor_responses,
    userDecision: r.user_decision ?? undefined,
    decisionReason: r.decision_reason ?? undefined,
    heldAt: r.held_at,
    createdAt: r.created_at,
  }
}

interface CounselorLite { id: string; name: string; archetype: string; context_prompt: string | null }

export interface CounselorResponse { counselorId: string; name: string; response: string }

const SYSTEM = `Você orquestra um mastermind no estilo dos "Invisible Counselors" de Napoleon Hill: um conselho de vozes distintas que o usuário convoca para deliberar uma decisão.

Para CADA conselheiro listado, escreva a resposta dele à pergunta — na perspectiva, no tom e nos valores daquele conselheiro. Regras:
- 2 a 4 frases por conselheiro. Denso, direto, sem floreio motivacional.
- Vozes genuinamente distintas entre si. Conselheiros PODEM e DEVEM discordar quando faz sentido — um mastermind real tem tensão.
- Nada de "que ótima pergunta" ou validação vazia. Vá direto ao conselho.
- Português brasileiro.

Saída: APENAS JSON, sem texto fora dele:
{"responses":[{"counselor_id":"<id exato>","response":"<fala do conselheiro>"}]}`

export async function generateMastermindResponses(counselors: CounselorLite[], question: string): Promise<CounselorResponse[]> {
  const roster = counselors
    .map(c => `- [id=${c.id}] ${c.name} — ${c.archetype}${c.context_prompt ? `. Como pensa: ${c.context_prompt}` : ''}`)
    .join('\n')
  const userMsg = `<counselors>\n${roster}\n</counselors>\n\n<question>${question}</question>`

  const msg = await getAnthropic().messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1400,
    system: SYSTEM,
    messages: [{ role: 'user', content: userMsg }],
  })
  const raw = msg.content[0]?.type === 'text' ? msg.content[0].text : ''
  const parsed = parseJsonFromLlm<{ responses: { counselor_id: string; response: string }[] }>(raw)

  const nameById = new Map(counselors.map(c => [c.id, c.name]))
  return (parsed?.responses ?? [])
    .filter(r => nameById.has(r.counselor_id) && typeof r.response === 'string')
    .map(r => ({ counselorId: r.counselor_id, name: nameById.get(r.counselor_id) ?? '', response: r.response }))
}

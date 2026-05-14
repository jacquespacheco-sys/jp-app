import { useState } from 'react'
import { api } from '../../api.ts'
import { SUGGEST_INTENTS } from '../../../api/_schemas/suggest-message.ts'
import type { Contact } from '../../types/domain.ts'

interface Props {
  contact: Contact
  onClose: () => void
}

interface Angle {
  tone: string
  message: string
  rationale: string
}

const INTENT_LABEL: Record<typeof SUGGEST_INTENTS[number], string> = {
  reconnect: 'Reaproximação',
  thank: 'Agradecimento',
  follow_up: 'Follow-up',
  ask: 'Pedido',
  congratulate: 'Parabéns',
  condolences: 'Condolências',
  other: 'Outro',
}

export function SuggestMessageModal({ contact, onClose }: Props) {
  const [context, setContext] = useState('')
  const [intent, setIntent] = useState<typeof SUGGEST_INTENTS[number] | ''>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [angles, setAngles] = useState<Angle[] | null>(null)
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null)

  const handleGenerate = async () => {
    if (context.trim().length < 5) { setError('Diga um pouco mais sobre o contexto (5+ chars)'); return }
    setLoading(true)
    setError('')
    setAngles(null)
    try {
      const res = await api.post<{ angles: Angle[] }>('/api/contacts-suggest-message', {
        contactId: contact.id,
        context: context.trim(),
        ...(intent ? { intent } : {}),
      })
      setAngles(res.angles ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao gerar sugestões')
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = async (text: string, idx: number) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedIdx(idx)
      setTimeout(() => setCopiedIdx(prev => prev === idx ? null : prev), 1500)
    } catch {
      setError('Não consegui copiar (clipboard bloqueado)')
    }
  }

  return (
    <div className="task-panel-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="task-panel">
        <div className="task-panel-header">
          <span className="task-panel-label">
            Sugerir mensagem · {contact.preferredName ?? contact.firstName}
          </span>
          <button className="task-panel-close" onClick={onClose}>×</button>
        </div>

        <div className="task-panel-body" style={{ overflowY: 'auto' }}>
          {!angles && (
            <>
              <label className="task-panel-notes-label" style={{ display: 'block', marginTop: 0 }}>Contexto</label>
              <textarea
                className="task-panel-notes"
                value={context}
                onChange={e => setContext(e.target.value)}
                placeholder="Ex: vou ligar amanhã pra falar do pitch / quero reaproximar depois de 6 meses sem falar"
                style={{ minHeight: '70px', marginBottom: '4px' }}
                autoFocus
              />
              <div style={{
                fontFamily: 'Space Mono, monospace', fontSize: '9px', letterSpacing: '1px',
                color: context.trim().length < 5 ? 'var(--fg-dim)' : 'var(--accent)',
                textAlign: 'right', marginBottom: '12px',
              }}>
                {context.trim().length < 5
                  ? `digite ao menos ${5 - context.trim().length} char${5 - context.trim().length === 1 ? '' : 's'} para gerar`
                  : `${context.length}/500`}
              </div>
              <label className="task-panel-notes-label" style={{ display: 'block', marginTop: 0 }}>Intenção (opcional)</label>
              <select
                className="input"
                value={intent}
                onChange={e => setIntent(e.target.value as typeof SUGGEST_INTENTS[number] | '')}
                style={{ marginBottom: '12px' }}
              >
                <option value="">—</option>
                {SUGGEST_INTENTS.map(i => <option key={i} value={i}>{INTENT_LABEL[i]}</option>)}
              </select>
              {error && (
                <div style={{ fontSize: '11px', color: 'var(--danger)', marginBottom: '8px', fontFamily: 'Space Mono, monospace', letterSpacing: '0.5px' }}>
                  {error}
                </div>
              )}
            </>
          )}

          {angles && angles.length === 0 && (
            <div style={{ fontSize: '12px', color: 'var(--fg-dim)' }}>
              Sem sugestões geradas. Tente outro contexto.
            </div>
          )}

          {angles && angles.map((a, idx) => (
            <div key={idx} style={{ border: '1px solid var(--border)', padding: '14px', marginBottom: '12px', background: 'var(--bg-elevated)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <div style={{ fontFamily: 'Space Mono, monospace', fontSize: '10px', color: 'var(--fg-muted)', letterSpacing: '1.5px', textTransform: 'uppercase' }}>
                  Ângulo {idx + 1} · {a.tone}
                </div>
                <button
                  className="btn btn-ghost"
                  style={{ fontSize: '9px', padding: '4px 8px' }}
                  onClick={() => { void handleCopy(a.message, idx) }}
                >
                  {copiedIdx === idx ? 'Copiado' : 'Copiar'}
                </button>
              </div>
              <div style={{ fontSize: '13px', color: 'var(--fg)', whiteSpace: 'pre-wrap', lineHeight: 1.5, marginBottom: '8px' }}>
                {a.message}
              </div>
              {a.rationale && (
                <div style={{ fontSize: '10px', color: 'var(--fg-dim)', fontStyle: 'italic', borderTop: '1px solid var(--border-light)', paddingTop: '6px' }}>
                  {a.rationale}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="task-panel-actions" style={{ flexDirection: 'column', gap: '8px' }}>
          {!angles ? (
            <button
              className="btn btn-accent"
              style={{ width: '100%', justifyContent: 'center' }}
              onClick={() => { void handleGenerate() }}
              disabled={loading || context.trim().length < 5}
            >
              {loading ? 'Gerando…' : 'Gerar 2 ângulos'}
            </button>
          ) : (
            <button
              className="btn btn-ghost"
              style={{ width: '100%', justifyContent: 'center' }}
              onClick={() => { setAngles(null); setError('') }}
            >
              Gerar outras
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

import { useState } from 'react'
import type { ChiefAim } from '../../types/domain.ts'
import type { ChiefAimCreateInput, ChiefAimPatchInput } from '../../../api/_schemas/hill.ts'

interface ChiefAimEditorProps {
  existing?: ChiefAim
  onCreate: (input: ChiefAimCreateInput) => Promise<void>
  onUpdateMeta: (input: ChiefAimPatchInput) => Promise<void>
  onCancel: () => void
}

const labelStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: '4px',
  fontSize: '11px', color: 'var(--fg-muted)',
  fontFamily: 'var(--font-mono)', letterSpacing: '0.5px', textTransform: 'uppercase',
}
const fieldStyle: React.CSSProperties = {
  padding: '10px', background: 'var(--bg)', border: '1px solid var(--border)',
  color: 'var(--fg)', fontFamily: 'inherit', fontSize: '14px', borderRadius: '8px',
}

export function ChiefAimEditor({ existing, onCreate, onUpdateMeta, onCancel }: ChiefAimEditorProps) {
  const isEdit = existing !== undefined
  const [aimText, setAimText] = useState(existing?.aimText ?? '')
  const [deadline, setDeadline] = useState(existing?.deadline ?? '')
  const [exchangeText, setExchangeText] = useState(existing?.exchangeText ?? '')
  const [planText, setPlanText] = useState(existing?.planText ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const canSubmit = isEdit
    ? exchangeText.trim().length > 0
    : aimText.trim().length > 0 && deadline !== '' && exchangeText.trim().length > 0

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    setSaving(true)
    setError('')
    try {
      if (isEdit && existing) {
        await onUpdateMeta({
          id: existing.id,
          exchangeText: exchangeText.trim(),
          ...(planText.trim() ? { planText: planText.trim() } : {}),
        })
      } else {
        await onCreate({
          aimText: aimText.trim(),
          deadline,
          exchangeText: exchangeText.trim(),
          ...(planText.trim() ? { planText: planText.trim() } : {}),
        })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form
      onSubmit={e => { void handleSubmit(e) }}
      style={{ display: 'flex', flexDirection: 'column', gap: '14px', background: 'var(--bg-subtle)', padding: '18px', borderRadius: '14px' }}
    >
      <label style={labelStyle}>
        Chief Aim {isEdit && '(imutável — crie um novo para mudar)'}
        <textarea
          value={aimText}
          onChange={e => setAimText(e.target.value)}
          rows={4}
          disabled={isEdit}
          autoFocus={!isEdit}
          placeholder="Em [data], terei [resultado claro e específico], oferecendo em troca [serviço/valor]..."
          style={{ ...fieldStyle, resize: 'vertical', fontFamily: 'var(--font-display)', fontSize: '16px', lineHeight: 1.4, opacity: isEdit ? 0.6 : 1 }}
        />
      </label>

      <label style={labelStyle}>
        Prazo {isEdit && '(imutável)'}
        <input
          type="date"
          value={deadline}
          onChange={e => setDeadline(e.target.value)}
          disabled={isEdit}
          style={{ ...fieldStyle, opacity: isEdit ? 0.6 : 1 }}
        />
      </label>

      <label style={labelStyle}>
        O que estou disposto a dar em troca
        <textarea
          value={exchangeText}
          onChange={e => setExchangeText(e.target.value)}
          rows={3}
          placeholder="O preço que pagarei: disciplina, foco, sacrifícios concretos..."
          style={{ ...fieldStyle, resize: 'vertical' }}
        />
      </label>

      <label style={labelStyle}>
        Plano definido (opcional)
        <textarea
          value={planText}
          onChange={e => setPlanText(e.target.value)}
          rows={4}
          placeholder="Os passos organizados para chegar lá..."
          style={{ ...fieldStyle, resize: 'vertical' }}
        />
      </label>

      {error && <div style={{ color: 'var(--danger)', fontSize: '12px' }}>{error}</div>}

      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancelar</button>
        <button type="submit" className="btn btn-accent" disabled={saving || !canSubmit}>
          {saving ? 'Salvando…' : isEdit ? 'Salvar' : 'Selar Chief Aim'}
        </button>
      </div>
    </form>
  )
}

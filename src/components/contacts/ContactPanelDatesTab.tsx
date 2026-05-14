import { useState } from 'react'
import { useSpecialDates } from '../../hooks/useSpecialDates.ts'
import { SPECIAL_DATE_TYPES } from '../../../api/_schemas/special-date.ts'
import type { SpecialDateSaveInput } from '../../../api/_schemas/special-date.ts'

const TYPE_LABEL: Record<string, string> = {
  celebrate: 'Celebrar',
  acknowledge: 'Reconhecer',
  silence: 'Silenciar',
  check_in: 'Check-in',
}

const DATE_MODES = [
  { value: 'anniversary', label: 'Recorrente DD/MM' },
  { value: 'full', label: 'Data única' },
] as const

interface Props { contactId: string }

export function ContactPanelDatesTab({ contactId }: Props) {
  const { specialDates, loading, save, remove } = useSpecialDates(contactId)
  const [showForm, setShowForm] = useState(false)
  const [label, setLabel] = useState('')
  const [type, setType] = useState<SpecialDateSaveInput['type']>('celebrate')
  const [mode, setMode] = useState<'anniversary' | 'full'>('anniversary')
  const [dateAnniversary, setDateAnniversary] = useState('')
  const [dateFull, setDateFull] = useState('')
  const [leadDays, setLeadDays] = useState(2)
  const [privateNote, setPrivateNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const reset = () => {
    setLabel(''); setType('celebrate'); setMode('anniversary')
    setDateAnniversary(''); setDateFull(''); setLeadDays(2); setPrivateNote('')
    setError('')
  }

  const handleAdd = async () => {
    if (!label.trim()) { setError('Label obrigatório'); return }
    if (mode === 'anniversary' && !dateAnniversary) { setError('Data DD/MM obrigatória'); return }
    if (mode === 'full' && !dateFull) { setError('Data obrigatória'); return }
    setSaving(true)
    setError('')
    try {
      await save({
        contactId,
        label: label.trim(),
        type,
        ...(mode === 'anniversary' ? { dateAnniversary } : { dateFull }),
        recurring: mode === 'anniversary',
        leadDays,
        ...(privateNote.trim() ? { privateNote: privateNote.trim() } : {}),
        source: 'manual',
      })
      reset()
      setShowForm(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <span className="task-panel-notes-label" style={{ display: 'inline', marginTop: 0 }}>Datas especiais</span>
        <button className="btn btn-ghost" style={{ fontSize: '9px', padding: '4px 10px' }} onClick={() => setShowForm(v => !v)}>
          {showForm ? 'Cancelar' : '+ Adicionar'}
        </button>
      </div>

      {showForm && (
        <div style={{ border: '1px solid var(--border)', padding: '12px', marginBottom: '12px' }}>
          <input
            className="input" placeholder="Label (ex: aniversário do filho, casamento)"
            value={label} onChange={e => setLabel(e.target.value)}
            style={{ marginBottom: '8px' }}
          />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
            <select className="task-field-select input" value={type} onChange={e => setType(e.target.value as typeof type)}>
              {SPECIAL_DATE_TYPES.map(t => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
            </select>
            <select className="task-field-select input" value={mode} onChange={e => setMode(e.target.value as typeof mode)}>
              {DATE_MODES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
            {mode === 'anniversary' ? (
              <input
                className="input" placeholder="DD/MM" maxLength={5}
                value={dateAnniversary} onChange={e => setDateAnniversary(e.target.value)}
              />
            ) : (
              <input
                className="input" type="date"
                value={dateFull} onChange={e => setDateFull(e.target.value)}
              />
            )}
            <input
              className="input" type="number" min="0" max="60"
              value={leadDays} onChange={e => setLeadDays(parseInt(e.target.value, 10) || 0)}
              placeholder="Lembrar X dias antes"
            />
          </div>
          <input
            className="input" placeholder="Nota privada (não vai pra IA)"
            value={privateNote} onChange={e => setPrivateNote(e.target.value)}
            style={{ marginBottom: '8px' }}
          />
          {error && (
            <div style={{ fontSize: '10px', color: 'var(--danger)', marginBottom: '8px', fontFamily: 'var(--font-mono)', letterSpacing: '0.5px' }}>
              {error}
            </div>
          )}
          <button
            className="btn btn-accent" style={{ width: '100%', justifyContent: 'center', fontSize: '10px' }}
            onClick={() => { void handleAdd() }} disabled={saving}
          >
            {saving ? 'Salvando…' : 'Salvar data'}
          </button>
        </div>
      )}

      {loading && (
        <div style={{ fontSize: '11px', color: 'var(--fg-dim)', fontFamily: 'var(--font-mono)', letterSpacing: '1px' }}>
          Carregando…
        </div>
      )}

      {!loading && specialDates.length === 0 && (
        <div style={{ fontSize: '11px', color: 'var(--fg-dim)', fontFamily: 'var(--font-mono)', letterSpacing: '1px' }}>
          Nenhuma data registrada
        </div>
      )}

      {specialDates.map(d => (
        <div key={d.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--border-light)', display: 'grid', gridTemplateColumns: '1fr auto', gap: '10px', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--fg)', marginBottom: '2px' }}>{d.label}</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--fg-muted)', letterSpacing: '1px', textTransform: 'uppercase' }}>
              {TYPE_LABEL[d.type]} · {d.dateAnniversary ?? d.dateFull}
              {d.leadDays != null ? ` · -${d.leadDays}d` : ''}
            </div>
            {d.privateNote && (
              <div style={{ fontSize: '11px', color: 'var(--fg-dim)', marginTop: '4px', fontStyle: 'italic' }}>
                {d.privateNote}
              </div>
            )}
          </div>
          <button
            className="btn btn-ghost" style={{ fontSize: '9px', padding: '4px 8px', color: 'var(--danger)' }}
            onClick={() => { void remove(d.id) }}
          >
            Remover
          </button>
        </div>
      ))}
    </div>
  )
}

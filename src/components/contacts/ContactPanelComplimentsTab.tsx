import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useCompliments } from '../../hooks/useCompliments.ts'

interface Props { contactId: string }

export function ContactPanelComplimentsTab({ contactId }: Props) {
  const { compliments, loading, save, reciprocate } = useCompliments({ contactId })
  const [showForm, setShowForm] = useState(false)
  const [text, setText] = useState('')
  const [context, setContext] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleAdd = async () => {
    if (!text.trim()) { setError('Texto obrigatório'); return }
    setSaving(true)
    setError('')
    try {
      await save({
        contactId,
        text: text.trim(),
        ...(context.trim() ? { context: context.trim() } : {}),
      })
      setText(''); setContext(''); setShowForm(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <span className="task-panel-notes-label" style={{ display: 'inline', marginTop: 0 }}>Elogios recebidos</span>
        <button className="btn btn-ghost" style={{ fontSize: '9px', padding: '4px 10px' }} onClick={() => setShowForm(v => !v)}>
          {showForm ? 'Cancelar' : '+ Registrar'}
        </button>
      </div>

      {showForm && (
        <div style={{ border: '1px solid var(--border)', padding: '12px', marginBottom: '12px' }}>
          <textarea
            className="task-panel-notes" placeholder="O elogio na íntegra…"
            value={text} onChange={e => setText(e.target.value)}
            style={{ marginBottom: '8px', minHeight: '60px' }}
          />
          <input
            className="input" placeholder="Contexto (onde/quando, opcional)"
            value={context} onChange={e => setContext(e.target.value)}
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
            {saving ? 'Salvando…' : 'Salvar elogio'}
          </button>
          <div style={{ fontSize: '9px', color: 'var(--fg-dim)', marginTop: '8px', fontFamily: 'var(--font-mono)', letterSpacing: '1px' }}>
            Sistema vai te lembrar de retribuir entre 4 e 6 meses depois — não imediato.
          </div>
        </div>
      )}

      {loading && (
        <div style={{ fontSize: '11px', color: 'var(--fg-dim)', fontFamily: 'var(--font-mono)', letterSpacing: '1px' }}>
          Carregando…
        </div>
      )}

      {!loading && compliments.length === 0 && (
        <div style={{ fontSize: '11px', color: 'var(--fg-dim)', fontFamily: 'var(--font-mono)', letterSpacing: '1px' }}>
          Nenhum elogio registrado
        </div>
      )}

      {compliments.map(c => (
        <div key={c.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--border-light)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '10px', alignItems: 'flex-start', marginBottom: '4px' }}>
            <div style={{ fontSize: '12px', color: 'var(--fg)' }}>{c.text}</div>
            {!c.reciprocated && (
              <button
                className="btn btn-ghost" style={{ fontSize: '9px', padding: '4px 8px' }}
                onClick={() => { void reciprocate({ id: c.id }) }}
              >
                Retribuído
              </button>
            )}
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--fg-muted)', letterSpacing: '1px', textTransform: 'uppercase' }}>
            {format(parseISO(c.receivedAt), 'd MMM yy', { locale: ptBR })}
            {c.context ? ` · ${c.context}` : ''}
            {c.reciprocated && c.reciprocatedAt
              ? ` · retribuído ${format(parseISO(c.reciprocatedAt), 'd MMM yy', { locale: ptBR })}`
              : c.remindToReciprocateAt
                ? ` · lembrar ${format(parseISO(c.remindToReciprocateAt), 'd MMM', { locale: ptBR })}`
                : ''}
          </div>
        </div>
      ))}
    </div>
  )
}

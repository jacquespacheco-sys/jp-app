import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Topbar } from '../components/layout/Topbar.tsx'
import { api } from '../api.ts'
import type { MastermindCounselor, MastermindSession } from '../types/domain.ts'
import { SUGGESTED_COUNSELORS } from '../types/domain.ts'
import type {
  MastermindCounselorsResponse, MastermindCounselorSaveResponse,
  MastermindSessionsResponse, MastermindSessionResponse,
} from '../types/api.ts'
import type { CounselorSaveInput } from '../../api/_schemas/hill.ts'

function Avatar({ label }: { label: string }) {
  return (
    <span style={{
      width: '38px', height: '38px', borderRadius: '50%', flexShrink: 0,
      background: 'var(--accent-soft)', color: 'var(--accent)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 700,
    }}>{label}</span>
  )
}

export function HillMastermindPage() {
  const navigate = useNavigate()
  const [counselors, setCounselors] = useState<MastermindCounselor[]>([])
  const [sessions, setSessions] = useState<MastermindSession[]>([])
  const [loading, setLoading] = useState(true)

  const [form, setForm] = useState<{ name: string; shortLabel: string; archetype: string; contextPrompt: string } | null>(null)
  const [busy, setBusy] = useState(false)

  const [question, setQuestion] = useState('')
  const [convening, setConvening] = useState(false)
  const [current, setCurrent] = useState<MastermindSession | null>(null)
  const [decision, setDecision] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const [c, s] = await Promise.all([
          api.get<MastermindCounselorsResponse>('/api/hill-mastermind-counselors'),
          api.get<MastermindSessionsResponse>('/api/hill-mastermind-session'),
        ])
        if (cancelled) return
        setCounselors(c.counselors)
        setSessions(s.sessions)
      } catch { /* estado vazio */ } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  const addCounselor = async (input: CounselorSaveInput) => {
    setBusy(true)
    try {
      const res = await api.post<MastermindCounselorSaveResponse>('/api/hill-mastermind-counselors', input)
      setCounselors(prev => [...prev, res.counselor])
      setForm(null)
    } catch (e) { setError(e instanceof Error ? e.message : 'erro ao adicionar') } finally { setBusy(false) }
  }

  const removeCounselor = async (id: string) => {
    setCounselors(prev => prev.filter(c => c.id !== id))
    try { await api.delete('/api/hill-mastermind-counselors', { id }) } catch { /* otimista */ }
  }

  const convene = async () => {
    const q = question.trim()
    if (!q || convening) return
    setConvening(true)
    setError('')
    try {
      const res = await api.post<MastermindSessionResponse>('/api/hill-mastermind-session', { question: q })
      setCurrent(res.session)
      setSessions(prev => [res.session, ...prev])
      setQuestion('')
      setDecision('')
    } catch (e) { setError(e instanceof Error ? e.message : 'o conselho não respondeu') } finally { setConvening(false) }
  }

  const recordDecision = async () => {
    if (!current || !decision.trim()) return
    setBusy(true)
    try {
      const res = await api.patch<MastermindSessionResponse>('/api/hill-mastermind-session', { id: current.id, userDecision: decision.trim() })
      setCurrent(res.session)
      setSessions(prev => prev.map(s => s.id === res.session.id ? res.session : s))
    } catch (e) { setError(e instanceof Error ? e.message : 'erro ao registrar') } finally { setBusy(false) }
  }

  const actions = <button className="btn btn-ghost" onClick={() => navigate('/hill')} style={{ fontSize: '11px' }}>← Compass</button>
  const fieldStyle: React.CSSProperties = { padding: '10px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--fg)', fontFamily: 'inherit', fontSize: '13px', width: '100%' }
  const existingNames = new Set(counselors.map(c => c.name))

  if (loading) {
    return <div><Topbar title="Mastermind" actions={actions} /><div className="empty-state" style={{ paddingTop: '30vh' }}>Carregando…</div></div>
  }

  return (
    <div>
      <Topbar title="Mastermind" actions={actions} />
      <div className="content">
        {/* Conselho */}
        <div className="section">
          <div className="section-title">Seu conselho<span className="count">{counselors.length}</span></div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {counselors.map(c => (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 0', borderBottom: '1px solid var(--border-light)' }}>
                <Avatar label={c.shortLabel} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '14px', fontWeight: 600 }}>{c.name}</div>
                  <div style={{ fontSize: '11px', color: 'var(--fg-muted)' }}>{c.archetype}</div>
                </div>
                <button onClick={() => { void removeCounselor(c.id) }} title="Remover" style={{ background: 'none', border: 'none', color: 'var(--fg-dim)', cursor: 'pointer', fontSize: '18px' }}>×</button>
              </div>
            ))}
          </div>

          {form ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', background: 'var(--bg-subtle)', padding: '16px', borderRadius: '12px', marginTop: '12px' }}>
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Nome (ex: Marco Aurélio)" style={fieldStyle} autoFocus />
              <input value={form.shortLabel} onChange={e => setForm({ ...form, shortLabel: e.target.value.slice(0, 4) })} placeholder="Sigla (ex: MA)" style={fieldStyle} />
              <input value={form.archetype} onChange={e => setForm({ ...form, archetype: e.target.value })} placeholder="Arquétipo (ex: Disciplina · Serenidade)" style={fieldStyle} />
              <textarea value={form.contextPrompt} onChange={e => setForm({ ...form, contextPrompt: e.target.value })} rows={3} placeholder="Como esta voz pensa, fala e decide…" style={{ ...fieldStyle, resize: 'vertical' }} />
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button className="btn btn-ghost" onClick={() => setForm(null)}>Cancelar</button>
                <button className="btn btn-accent" disabled={busy || !form.name.trim() || !form.shortLabel.trim() || !form.archetype.trim()}
                  onClick={() => { void addCounselor({ name: form.name.trim(), shortLabel: form.shortLabel.trim(), archetype: form.archetype.trim(), ...(form.contextPrompt.trim() ? { contextPrompt: form.contextPrompt.trim() } : {}) }) }}>
                  {busy ? 'Salvando…' : 'Adicionar'}
                </button>
              </div>
            </div>
          ) : (
            <button className="btn btn-ghost" style={{ fontSize: '11px', marginTop: '12px' }} onClick={() => setForm({ name: '', shortLabel: '', archetype: '', contextPrompt: '' })}>+ Adicionar conselheiro</button>
          )}

          {SUGGESTED_COUNSELORS.some(s => !existingNames.has(s.name)) && (
            <div style={{ marginTop: '14px' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--fg-dim)', marginBottom: '8px' }}>Sugestões</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {SUGGESTED_COUNSELORS.filter(s => !existingNames.has(s.name)).map(s => (
                  <button key={s.name} className="chip chip-mono" style={{ cursor: 'pointer' }} disabled={busy}
                    onClick={() => { void addCounselor({ name: s.name, shortLabel: s.shortLabel, archetype: s.archetype, contextPrompt: s.contextPrompt }) }}>
                    + {s.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Convocar */}
        <div className="section">
          <div className="section-title">Convocar o conselho</div>
          <textarea value={question} onChange={e => setQuestion(e.target.value)} rows={3}
            placeholder="A pauta da reunião — a decisão que você está enfrentando…"
            style={{ ...fieldStyle, resize: 'vertical', marginBottom: '10px' }} />
          <button className="btn btn-accent" disabled={convening || !question.trim() || counselors.length === 0} onClick={() => { void convene() }}>
            {convening ? 'O conselho delibera…' : 'Convocar reunião'}
          </button>
          {counselors.length === 0 && <div style={{ fontSize: '12px', color: 'var(--fg-muted)', marginTop: '8px' }}>Adicione ao menos um conselheiro primeiro.</div>}
          {error && <div style={{ color: 'var(--danger)', fontSize: '12px', marginTop: '8px' }}>{error}</div>}
        </div>

        {/* Resultado da reunião atual */}
        {current && (
          <div className="section">
            <div className="section-title">A reunião</div>
            <div className="hill-aim" style={{ marginBottom: '14px', padding: '16px' }}>
              <div className="hill-aim-meta" style={{ marginBottom: '6px' }}>Pauta</div>
              <div style={{ fontSize: '14px', color: 'var(--fg)' }}>{current.question}</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {current.counselorResponses.map((r, i) => (
                <div key={i} style={{ display: 'flex', gap: '12px' }}>
                  <Avatar label={(counselors.find(c => c.id === r.counselorId)?.shortLabel) ?? r.name.slice(0, 2).toUpperCase()} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>{r.name}</div>
                    <div style={{ fontSize: '14px', lineHeight: 1.55, color: 'var(--fg)', whiteSpace: 'pre-wrap' }}>{r.response}</div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: '18px', paddingTop: '16px', borderTop: '1px solid var(--border-light)' }}>
              <div className="hill-aim-meta" style={{ marginBottom: '8px' }}>Sua decisão</div>
              {current.userDecision ? (
                <div style={{ fontSize: '14px', color: 'var(--fg)' }}>{current.userDecision}</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <textarea value={decision} onChange={e => setDecision(e.target.value)} rows={2} placeholder="Ouvi o conselho. Decido…" style={{ ...fieldStyle, resize: 'vertical' }} />
                  <button className="btn btn-accent" style={{ alignSelf: 'flex-start' }} disabled={busy || !decision.trim()} onClick={() => { void recordDecision() }}>
                    {busy ? 'Registrando…' : 'Registrar decisão'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Histórico */}
        {sessions.filter(s => s.id !== current?.id).length > 0 && (
          <div className="section">
            <div className="section-title">Reuniões anteriores</div>
            {sessions.filter(s => s.id !== current?.id).map(s => (
              <button key={s.id} onClick={() => { setCurrent(s); setDecision('') }} style={{ display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: '12px 0', borderBottom: '1px solid var(--border-light)' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--fg-dim)', marginBottom: '4px' }}>{format(parseISO(s.heldAt), "d MMM", { locale: ptBR })}</div>
                <div style={{ fontSize: '13px', color: 'var(--fg)' }}>{s.question}</div>
                {s.userDecision && <div style={{ fontSize: '12px', color: 'var(--fg-muted)', marginTop: '4px' }}>→ {s.userDecision}</div>}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Topbar } from '../components/layout/Topbar.tsx'
import { BeliefDots } from '../components/hill/BeliefDots.tsx'
import { ChiefAimEditor } from '../components/hill/ChiefAimEditor.tsx'
import { api } from '../api.ts'
import type {
  ChiefAim, Affirmation, AffirmationUsageStat, QuarterlyReview,
  HillAimDecision, AffirmationReviewDecision, ReviewAffirmationDecision,
} from '../types/domain.ts'
import { AFFIRMATION_DIMENSION_LABELS } from '../types/domain.ts'
import type {
  ReviewResponse, ChiefAimResponse, AffirmationsListResponse,
  AffirmationUsageStatsResponse, AffirmationSaveResponse,
} from '../types/api.ts'

const STEPS = ['opening', 'aim', 'affirmations', 'seal', 'manifesto'] as const

export function HillReviewPage() {
  const navigate = useNavigate()
  const [review, setReview] = useState<QuarterlyReview | null>(null)
  const [chiefAim, setChiefAim] = useState<ChiefAim | null>(null)
  const [affirmations, setAffirmations] = useState<Affirmation[]>([])
  const [usage, setUsage] = useState<Record<string, AffirmationUsageStat>>({})
  const [loading, setLoading] = useState(true)
  const [step, setStep] = useState(0)

  const [aimDecision, setAimDecision] = useState<HillAimDecision | null>(null)
  const [affChoice, setAffChoice] = useState<Record<string, AffirmationReviewDecision>>({})
  const [refineDraft, setRefineDraft] = useState<Record<string, { text: string; beliefScore: number }>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [sealing, setSealing] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const [rev, aim, aff, stats] = await Promise.all([
          api.post<ReviewResponse>('/api/hill-review-start'),
          api.get<ChiefAimResponse>('/api/hill-chief-aim'),
          api.get<AffirmationsListResponse>('/api/hill-affirmations-list'),
          api.get<AffirmationUsageStatsResponse>('/api/hill-affirmations-usage-stats'),
        ])
        if (cancelled) return
        setReview(rev.review)
        setChiefAim(aim.chiefAim)
        setAffirmations(aff.affirmations)
        setUsage(Object.fromEntries(stats.stats.map(s => [s.id, s])))
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'erro ao abrir revisão')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  const stepKey = STEPS[step] ?? 'opening'
  const stats = review?.ritualStats

  const setChoice = (affId: string, decision: AffirmationReviewDecision) => {
    setAffChoice(prev => ({ ...prev, [affId]: decision }))
    if (decision === 'refined') {
      const a = affirmations.find(x => x.id === affId)
      if (a && !refineDraft[affId]) setRefineDraft(prev => ({ ...prev, [affId]: { text: a.text, beliefScore: a.beliefScore } }))
    }
  }

  const applyRefine = async (affId: string) => {
    const draft = refineDraft[affId]
    if (!draft?.text.trim()) return
    setBusy(affId)
    try {
      const res = await api.post<AffirmationSaveResponse>('/api/hill-affirmations-refine', { id: affId, text: draft.text.trim(), beliefScore: draft.beliefScore })
      setAffirmations(prev => prev.map(a => a.id === affId ? res.affirmation : a))
      setAffChoice(prev => ({ ...prev, [res.affirmation.id]: 'refined', ...(affId !== res.affirmation.id ? { [affId]: undefined as never } : {}) }))
    } catch (e) { setError(e instanceof Error ? e.message : 'erro ao refinar') } finally { setBusy(null) }
  }

  const applyRetire = async (affId: string) => {
    setBusy(affId)
    try {
      await api.post('/api/hill-affirmations-retire', { id: affId, retiredReason: 'revisão trimestral' })
      setAffirmations(prev => prev.filter(a => a.id !== affId))
    } catch (e) { setError(e instanceof Error ? e.message : 'erro ao aposentar') } finally { setBusy(null) }
  }

  const seal = async () => {
    if (!review) return
    setSealing(true)
    setError('')
    try {
      const decisions: ReviewAffirmationDecision[] = Object.entries(affChoice)
        .filter(([, d]) => d != null)
        .map(([affId, decision]) => ({ affId, decision }))
      await api.patch('/api/hill-review-save', {
        id: review.id,
        ...(aimDecision ? { aimDecision } : {}),
        affirmationDecisions: decisions,
        complete: true,
      })
      const aff = await api.get<AffirmationsListResponse>('/api/hill-affirmations-list')
      setAffirmations(aff.affirmations)
      setStep(STEPS.indexOf('manifesto'))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'erro ao selar')
    } finally {
      setSealing(false)
    }
  }

  const actions = <button className="btn btn-ghost" onClick={() => navigate('/hill')} style={{ fontSize: '11px' }}>← Compass</button>

  if (loading) {
    return <div><Topbar title="Revisão trimestral" actions={actions} /><div className="empty-state" style={{ paddingTop: '30vh' }}>Abrindo revisão…</div></div>
  }

  return (
    <div>
      <Topbar title="Revisão trimestral" actions={actions} />
      <div className="content">
        {stepKey === 'opening' && (
          <div className="section">
            <div className="section-title">O trimestre que passou</div>
            {stats ? (
              <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
                <div className="hill-stat"><div className="hill-stat-value">{stats.morning.adherencePct}%</div><div className="hill-stat-label">manhã 90d</div></div>
                <div className="hill-stat"><div className="hill-stat-value">{stats.night.adherencePct}%</div><div className="hill-stat-label">noite 90d</div></div>
                <div className="hill-stat"><div className="hill-stat-value">{stats.morning.streak}</div><div className="hill-stat-label">streak atual</div></div>
              </div>
            ) : <div className="empty-state" style={{ textAlign: 'left' }}>Sem dados de ritual ainda.</div>}
            <p style={{ fontSize: '14px', lineHeight: 1.6, color: 'var(--fg-muted)' }}>
              Este é o único momento legítimo para mexer nas afirmações. Murphy era categórico: mudar antes mata o efeito.
              Reveja com calma — o que ainda te acende, o que cumpriu seu papel, o que não toca mais.
            </p>
          </div>
        )}

        {stepKey === 'aim' && chiefAim && (
          <div className="section">
            <div className="section-title">Seu Chief Aim</div>
            <div className="hill-aim" style={{ marginBottom: '16px' }}><div className="hill-aim-text">{chiefAim.aimText}</div></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {([['kept', 'Mantenho — ainda me acende'], ['adjusted', 'Ajusto o plano / a troca'], ['rewritten', 'Preciso reescrever']] as const).map(([val, label]) => (
                <button key={val} onClick={() => setAimDecision(val)} className="hill-affirmation"
                  style={{ textAlign: 'left', cursor: 'pointer', borderLeftColor: aimDecision === val ? 'var(--accent)' : 'var(--border)', background: aimDecision === val ? 'var(--accent-soft)' : 'var(--bg-elevated)' }}>
                  <div style={{ fontSize: '14px', fontWeight: 600 }}>{label}</div>
                </button>
              ))}
            </div>
            {aimDecision === 'adjusted' && (
              <div style={{ marginTop: '14px' }}>
                <ChiefAimEditor existing={chiefAim}
                  onCreate={async () => {}}
                  onUpdateMeta={async input => { const r = await api.patch<ChiefAimResponse>('/api/hill-chief-aim', input); setChiefAim(r.chiefAim) }}
                  onCancel={() => setAimDecision(null)} />
              </div>
            )}
            {aimDecision === 'rewritten' && (
              <div style={{ marginTop: '14px', fontSize: '13px', color: 'var(--fg-muted)', lineHeight: 1.5 }}>
                Reescrever é uma mudança grande — conclua a revisão e crie o novo Chief Aim no Compass (ele arquiva este e pede afirmações novas).
              </div>
            )}
          </div>
        )}

        {stepKey === 'affirmations' && (
          <div className="section">
            <div className="section-title">Suas afirmações<span className="count">{affirmations.length}</span></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {affirmations.map(a => {
                const u = usage[a.id]
                const choice = affChoice[a.id]
                return (
                  <div key={a.id} className="hill-affirmation">
                    <div className="hill-affirmation-dim">{AFFIRMATION_DIMENSION_LABELS[a.dimension]}{u ? ` · ${u.reads} leituras · ${u.skipRate}% skip` : ''}</div>
                    <div className="hill-affirmation-text">“{a.text}”</div>
                    <div style={{ display: 'flex', gap: '6px', marginTop: '12px', flexWrap: 'wrap' }}>
                      {([['kept', 'Manter'], ['refined', 'Refinar'], ['retired', 'Aposentar']] as const).map(([val, label]) => (
                        <button key={val} onClick={() => setChoice(a.id, val)} className={`chip chip-mono${choice === val ? ' chip-active' : ''}`} style={{ cursor: 'pointer' }}>{label}</button>
                      ))}
                    </div>
                    {choice === 'refined' && refineDraft[a.id] && (
                      <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <textarea value={refineDraft[a.id]!.text} onChange={e => setRefineDraft(prev => ({ ...prev, [a.id]: { ...prev[a.id]!, text: e.target.value } }))} rows={3}
                          style={{ padding: '12px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '10px', color: 'var(--fg)', fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: '16px', resize: 'vertical' }} />
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <BeliefDots score={refineDraft[a.id]!.beliefScore} onChange={v => setRefineDraft(prev => ({ ...prev, [a.id]: { ...prev[a.id]!, beliefScore: v } }))} />
                          <button className="btn btn-accent" style={{ fontSize: '11px' }} disabled={busy === a.id} onClick={() => { void applyRefine(a.id) }}>{busy === a.id ? 'Salvando…' : 'Salvar refino'}</button>
                        </div>
                      </div>
                    )}
                    {choice === 'retired' && (
                      <div style={{ marginTop: '12px' }}>
                        <button className="btn btn-danger" style={{ fontSize: '11px' }} disabled={busy === a.id} onClick={() => { void applyRetire(a.id) }}>{busy === a.id ? 'Aposentando…' : 'Confirmar aposentadoria'}</button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {stepKey === 'seal' && (
          <div className="section">
            <div className="section-title">Selar o próximo trimestre</div>
            <p style={{ fontSize: '14px', lineHeight: 1.6, color: 'var(--fg-muted)', marginBottom: '16px' }}>
              Ao selar, suas afirmações ficam travadas de novo até a próxima revisão (em 90 dias). Hill + Murphy: constância é o que programa o subconsciente.
            </p>
            {error && <div style={{ color: 'var(--danger)', fontSize: '12px', marginBottom: '12px' }}>{error}</div>}
            <button className="btn btn-accent" disabled={sealing} onClick={() => { void seal() }}>{sealing ? 'Selando…' : 'Selar revisão e abrir Q2'}</button>
          </div>
        )}

        {stepKey === 'manifesto' && chiefAim && (
          <div className="section">
            <div className="section-title">Manifesto</div>
            <div className="hill-aim" style={{ marginBottom: '16px' }}>
              <div className="hill-aim-text">{chiefAim.aimText}</div>
              <div className="hill-aim-meta" style={{ marginTop: '14px' }}>prazo {chiefAim.deadline} · próxima revisão {review?.nextReviewDate}</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '18px' }}>
              {affirmations.map(a => (
                <div key={a.id} className="hill-affirmation"><div className="hill-affirmation-dim">{AFFIRMATION_DIMENSION_LABELS[a.dimension]}</div><div className="hill-affirmation-text">“{a.text}”</div></div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn" onClick={() => window.print()}>Imprimir / PDF</button>
              <button className="btn btn-accent" onClick={() => navigate('/hill')}>Concluir</button>
            </div>
          </div>
        )}
      </div>

      {/* navegação entre passos (some no manifesto) */}
      {stepKey !== 'manifesto' && (
        <div className="content" style={{ display: 'flex', gap: '10px', paddingTop: 0 }}>
          <button className="btn btn-ghost" style={{ flex: 1, justifyContent: 'center' }}
            onClick={() => (step === 0 ? navigate('/hill') : setStep(step - 1))}>
            {step === 0 ? 'Sair' : 'Voltar'}
          </button>
          {stepKey !== 'seal' && (
            <button className="btn btn-accent" style={{ flex: 1, justifyContent: 'center' }}
              disabled={stepKey === 'aim' && !aimDecision}
              onClick={() => setStep(step + 1)}>
              Próximo
            </button>
          )}
        </div>
      )}
    </div>
  )
}

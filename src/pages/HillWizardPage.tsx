import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BeliefDots } from '../components/hill/BeliefDots.tsx'
import { useHill } from '../hooks/useHill.ts'
import { AFFIRMATION_DIMENSIONS } from '../types/domain.ts'
import type { AffirmationDimension } from '../types/domain.ts'

type Draft = { text: string; beliefScore: number }
const emptyDrafts = (): Record<AffirmationDimension, Draft> => ({
  identidade: { text: '', beliefScore: 3 },
  acao: { text: '', beliefScore: 3 },
  capacidade: { text: '', beliefScore: 3 },
  relacoes: { text: '', beliefScore: 3 },
  integracao: { text: '', beliefScore: 3 },
})

const DIMS = AFFIRMATION_DIMENSIONS
const LAST = DIMS.length + 1 // welcome(0) + 5 dims + review(LAST)

export function HillWizardPage() {
  const navigate = useNavigate()
  const { chiefAim, loading, runWizard } = useHill()
  const [step, setStep] = useState(0)
  const [drafts, setDrafts] = useState<Record<AffirmationDimension, Draft>>(emptyDrafts)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  if (loading) {
    return <div className="hill-ritual hill-ritual-morning"><div className="hill-step-body">Carregando…</div></div>
  }

  if (!chiefAim) {
    return (
      <div className="hill-ritual hill-ritual-morning">
        <div className="hill-step-body">
          <div className="hill-step-kicker">Wizard de afirmações</div>
          <div className="hill-step-title">Primeiro, o Chief Aim</div>
          <p style={{ color: 'var(--fg-muted)', lineHeight: 1.5 }}>
            Suas afirmações nascem do seu objetivo. Defina o Chief Aim antes de programá-las.
          </p>
          <button className="btn btn-accent" onClick={() => navigate('/hill')}>Voltar ao Compass</button>
        </div>
      </div>
    )
  }

  const dimIndex = step - 1
  const currentDim = dimIndex >= 0 && dimIndex < DIMS.length ? DIMS[dimIndex] : null

  const setDraft = (key: AffirmationDimension, patch: Partial<Draft>) =>
    setDrafts(prev => ({ ...prev, [key]: { ...prev[key], ...patch } }))

  const allFilled = DIMS.every(d => drafts[d.key].text.trim().length > 0)

  const handleSeal = async () => {
    setSaving(true)
    setError('')
    try {
      await runWizard({
        chiefAimId: chiefAim.id,
        affirmations: DIMS.map(d => ({
          dimension: d.key,
          text: drafts[d.key].text.trim(),
          beliefScore: drafts[d.key].beliefScore,
        })),
      })
      navigate('/hill')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'erro ao selar')
      setSaving(false)
    }
  }

  const segs = DIMS.map((_, i) => <span key={i} className={`hill-step-progress-seg${step > i ? ' done' : ''}`} />)

  return (
    <div className="hill-ritual hill-ritual-morning">
      <div className="hill-step-progress">{segs}</div>

      <div className="hill-step-body">
        {step === 0 && (
          <>
            <div className="hill-step-kicker">Wizard de afirmações</div>
            <div className="hill-step-title">5 afirmações, 5 dimensões</div>
            <p style={{ color: 'var(--fg-muted)', lineHeight: 1.6 }}>
              Você vai escrever uma afirmação para cada dimensão da sua identidade. Escreva no presente,
              como se já fosse verdade. A cada uma, marque o quanto realmente acredita nela hoje.
            </p>
            <p style={{ color: 'var(--fg-muted)', lineHeight: 1.6, fontSize: '13px' }}>
              Depois de seladas, mudá-las só na revisão trimestral — o subconsciente precisa de constância.
            </p>
          </>
        )}

        {currentDim && (
          <>
            <div className="hill-step-kicker">Dimensão {dimIndex + 1} de {DIMS.length} · {currentDim.label}</div>
            <div className="hill-step-title">{currentDim.prompt}</div>
            <textarea
              value={drafts[currentDim.key].text}
              onChange={e => setDraft(currentDim.key, { text: e.target.value })}
              rows={4}
              autoFocus
              placeholder="Eu sou… / Eu faço… (no presente, afirmativo)"
              style={{
                padding: '14px', background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                color: 'var(--fg)', fontFamily: 'var(--font-display)', fontStyle: 'italic',
                fontSize: '18px', lineHeight: 1.4, borderRadius: '12px', resize: 'vertical',
              }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '1px', color: 'var(--fg-muted)', textTransform: 'uppercase' }}>
                Quanto você acredita?
              </span>
              <BeliefDots score={drafts[currentDim.key].beliefScore} onChange={v => setDraft(currentDim.key, { beliefScore: v })} />
            </div>
          </>
        )}

        {step === LAST && (
          <>
            <div className="hill-step-kicker">Revisão final</div>
            <div className="hill-step-title">Selar suas afirmações</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {DIMS.map(d => (
                <div key={d.key} className="hill-affirmation">
                  <div className="hill-affirmation-dim">{d.label}</div>
                  <div className="hill-affirmation-text">
                    {drafts[d.key].text.trim() ? `“${drafts[d.key].text.trim()}”` : <span style={{ color: 'var(--fg-dim)', fontStyle: 'normal' }}>— vazia —</span>}
                  </div>
                </div>
              ))}
            </div>
            {!allFilled && (
              <div style={{ color: 'var(--danger)', fontSize: '12px' }}>Preencha todas as 5 dimensões antes de selar.</div>
            )}
            {error && <div style={{ color: 'var(--danger)', fontSize: '12px' }}>{error}</div>}
          </>
        )}
      </div>

      <div className="hill-ritual-footer">
        <button
          className="btn btn-ghost"
          style={{ flex: 1, justifyContent: 'center' }}
          onClick={() => (step === 0 ? navigate('/hill') : setStep(step - 1))}
        >
          {step === 0 ? 'Sair' : 'Voltar'}
        </button>
        {step < LAST ? (
          <button
            className="btn btn-accent"
            style={{ flex: 1, justifyContent: 'center' }}
            disabled={currentDim ? drafts[currentDim.key].text.trim().length === 0 : false}
            onClick={() => setStep(step + 1)}
          >
            {step === 0 ? 'Começar' : 'Próxima'}
          </button>
        ) : (
          <button
            className="btn btn-accent"
            style={{ flex: 1, justifyContent: 'center' }}
            disabled={!allFilled || saving}
            onClick={() => { void handleSeal() }}
          >
            {saving ? 'Selando…' : 'Selar'}
          </button>
        )}
      </div>
    </div>
  )
}

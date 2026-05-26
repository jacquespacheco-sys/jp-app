import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '../api.ts'
import { AffirmationCard } from '../components/hill/AffirmationCard.tsx'
import type { Affirmation, ChiefAim, Project, RitualType } from '../types/domain.ts'
import type {
  ChiefAimResponse, AffirmationsListResponse, ProjectsListResponse,
  RitualResponse, TaskSaveResponse,
} from '../types/api.ts'

type Reflection = { what_brought_closer: string; what_pushed_away: string; next_action: string }

export function HillRitualPage() {
  const navigate = useNavigate()
  const params = useParams<{ type: string }>()
  const type: RitualType = params.type === 'night' ? 'night' : 'morning'
  const isNight = type === 'night'

  const [ritualId, setRitualId] = useState<string | null>(null)
  const [chiefAim, setChiefAim] = useState<ChiefAim | null>(null)
  const [affirmations, setAffirmations] = useState<Affirmation[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [preparing, setPreparing] = useState(true)
  const [stepIdx, setStepIdx] = useState(0)
  const [completing, setCompleting] = useState(false)
  const [error, setError] = useState('')

  // dados coletados
  const [gratitude, setGratitude] = useState('')
  const [reflection, setReflection] = useState<Reflection>({ what_brought_closer: '', what_pushed_away: '', next_action: '' })
  const [actionText, setActionText] = useState('')
  const [actionProjectId, setActionProjectId] = useState('')

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const [startRes, aimRes, affRes] = await Promise.all([
          api.post<RitualResponse>('/api/hill-rituals-start', { type }),
          api.get<ChiefAimResponse>('/api/hill-chief-aim'),
          api.get<AffirmationsListResponse>('/api/hill-affirmations-list'),
        ])
        if (cancelled) return
        setRitualId(startRes.ritual.id)
        setChiefAim(aimRes.chiefAim)
        setAffirmations(affRes.affirmations)
        if (!isNight) {
          const projRes = await api.get<ProjectsListResponse>('/api/projects-list')
          if (!cancelled) {
            const active = projRes.projects.filter(p => !p.archived)
            setProjects(active)
            if (active[0]) setActionProjectId(active[0].id)
          }
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'erro ao iniciar ritual')
      } finally {
        if (!cancelled) setPreparing(false)
      }
    })()
    return () => { cancelled = true }
  }, [type, isNight])

  const steps: string[] = isNight
    ? ['gratitude', ...(affirmations.length ? ['affirmations'] : []), 'visualization', 'reflection', 'seal']
    : [...(chiefAim ? ['chief_aim_read'] : []), ...(affirmations.length ? ['affirmations'] : []), 'daily_action', 'seal']

  const stepKey = steps[stepIdx] ?? 'seal'

  const complete = useCallback(async () => {
    if (!ritualId) return
    setCompleting(true)
    setError('')
    try {
      let dailyActionTaskId: string | undefined
      if (!isNight && actionText.trim() && actionProjectId) {
        const taskRes = await api.post<TaskSaveResponse>('/api/tasks-save', {
          title: actionText.trim(),
          projectId: actionProjectId,
          status: 'next',
        })
        dailyActionTaskId = taskRes.task.id
      }
      const gratitudeItems = gratitude.split('\n').map(s => s.trim()).filter(Boolean)
      const reflectionData = Object.fromEntries(
        Object.entries(reflection).filter(([, v]) => v.trim()),
      )
      await api.patch<RitualResponse>('/api/hill-rituals-complete', {
        id: ritualId,
        stepsCompleted: steps.filter(s => s !== 'seal'),
        ...(affirmations.length ? { affirmationsRead: affirmations.map(a => a.id) } : {}),
        ...(isNight && gratitudeItems.length ? { gratitudeItems } : {}),
        ...(isNight && Object.keys(reflectionData).length ? { reflectionData } : {}),
        ...(dailyActionTaskId ? { dailyActionTaskId } : {}),
      })
      navigate('/hill')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'erro ao concluir')
      setCompleting(false)
    }
  }, [ritualId, isNight, actionText, actionProjectId, gratitude, reflection, steps, affirmations, navigate])

  const surface = isNight ? 'hill-ritual hill-ritual-night' : 'hill-ritual hill-ritual-morning'

  if (preparing) {
    return <div className={surface}><div className="hill-step-body">Preparando o ritual…</div></div>
  }

  const canAdvance = stepKey === 'daily_action'
    ? actionText.trim().length > 0
    : true

  const fieldStyle: React.CSSProperties = {
    padding: '14px', background: isNight ? '#241A12' : 'var(--bg-elevated)',
    border: `1px solid ${isNight ? '#3E3022' : 'var(--border)'}`,
    color: isNight ? '#F0E9DF' : 'var(--fg)',
    fontFamily: 'inherit', fontSize: '14px', borderRadius: '12px', resize: 'vertical', width: '100%',
  }

  return (
    <div className={surface}>
      <div className="hill-step-progress">
        {steps.map((_, i) => <span key={i} className={`hill-step-progress-seg${stepIdx > i ? ' done' : ''}`} />)}
      </div>

      <div className="hill-step-body">
        {stepKey === 'chief_aim_read' && chiefAim && (
          <>
            <div className="hill-step-kicker">Passo {stepIdx + 1} · Seu norte</div>
            <div className="hill-step-title">Releia seu Chief Aim</div>
            <div className="hill-affirmation"><div className="hill-affirmation-text" style={{ fontStyle: 'normal' }}>{chiefAim.aimText}</div></div>
          </>
        )}

        {stepKey === 'affirmations' && (
          <>
            <div className="hill-step-kicker">Passo {stepIdx + 1} · Programação</div>
            <div className="hill-step-title">{isNight ? 'Releia em voz baixa' : 'Diga em voz alta'}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {affirmations.map(a => <AffirmationCard key={a.id} affirmation={a} showBelief={false} />)}
            </div>
          </>
        )}

        {stepKey === 'daily_action' && (
          <>
            <div className="hill-step-kicker">Passo {stepIdx + 1} · Ação do dia</div>
            <div className="hill-step-title">Uma ação que te aproxima hoje</div>
            <textarea value={actionText} onChange={e => setActionText(e.target.value)} rows={3} autoFocus
              placeholder="A coisa mais importante que farei hoje rumo ao meu Chief Aim…" style={fieldStyle} />
            {projects.length > 0 ? (
              <label style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--fg-muted)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                Projeto (vira task no Kanban)
                <select value={actionProjectId} onChange={e => setActionProjectId(e.target.value)} style={fieldStyle}>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.title ?? p.name}</option>)}
                </select>
              </label>
            ) : (
              <div style={{ fontSize: '12px', color: 'var(--fg-muted)' }}>Sem projetos — a ação fica registrada no ritual, sem virar task.</div>
            )}
          </>
        )}

        {stepKey === 'gratitude' && (
          <>
            <div className="hill-step-kicker">Passo {stepIdx + 1} · Gratidão</div>
            <div className="hill-step-title">Pelo que você é grato hoje?</div>
            <textarea value={gratitude} onChange={e => setGratitude(e.target.value)} rows={4} autoFocus
              placeholder={'Um item por linha…\nPela energia da manhã\nPela conversa com…'} style={fieldStyle} />
          </>
        )}

        {stepKey === 'visualization' && (
          <>
            <div className="hill-step-kicker">Passo {stepIdx + 1} · Visualização</div>
            <div className="hill-step-title">Veja o resultado já realizado</div>
            <p style={{ color: isNight ? '#9A8A78' : 'var(--fg-muted)', lineHeight: 1.6 }}>
              Feche os olhos por um minuto. Respire fundo, devagar. Veja seu Chief Aim como se já fosse
              verdade — os detalhes, as sensações, as pessoas. Deixe a imagem ficar nítida antes de seguir.
            </p>
          </>
        )}

        {stepKey === 'reflection' && (
          <>
            <div className="hill-step-kicker">Passo {stepIdx + 1} · Reflexão</div>
            <div className="hill-step-title">Como foi o dia?</div>
            {([
              ['what_brought_closer', 'O que me aproximou do meu aim?'],
              ['what_pushed_away', 'O que me afastou?'],
              ['next_action', 'Próximo passo amanhã'],
            ] as const).map(([key, label]) => (
              <label key={key} style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', color: isNight ? '#9A8A78' : 'var(--fg-muted)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {label}
                <textarea value={reflection[key]} onChange={e => setReflection(prev => ({ ...prev, [key]: e.target.value }))} rows={2} style={fieldStyle} />
              </label>
            ))}
          </>
        )}

        {stepKey === 'seal' && (
          <>
            <div className="hill-step-kicker">{isNight ? 'Boa noite' : 'Vá em frente'}</div>
            <div className="hill-step-title">{isNight ? 'Ritual selado' : 'O dia é seu'}</div>
            <p style={{ color: isNight ? '#9A8A78' : 'var(--fg-muted)', lineHeight: 1.6 }}>
              {isNight
                ? 'Entregue o dia. Sua mente segue trabalhando enquanto você descansa.'
                : 'Você plantou a intenção. Agora aja.'}
            </p>
            {error && <div style={{ color: 'var(--danger)', fontSize: '12px' }}>{error}</div>}
          </>
        )}
      </div>

      <div className="hill-ritual-footer">
        <button className="btn btn-ghost" style={{ flex: 1, justifyContent: 'center' }}
          onClick={() => (stepIdx === 0 ? navigate('/hill') : setStepIdx(stepIdx - 1))}>
          {stepIdx === 0 ? 'Sair' : 'Voltar'}
        </button>
        {stepKey === 'seal' ? (
          <button className="btn btn-accent" style={{ flex: 1, justifyContent: 'center' }} disabled={completing} onClick={() => { void complete() }}>
            {completing ? 'Concluindo…' : 'Concluir ritual'}
          </button>
        ) : (
          <button className="btn btn-accent" style={{ flex: 1, justifyContent: 'center' }} disabled={!canAdvance} onClick={() => setStepIdx(stepIdx + 1)}>
            Próximo
          </button>
        )}
      </div>
    </div>
  )
}

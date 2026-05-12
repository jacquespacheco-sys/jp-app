import { useState, useEffect } from 'react'
import type { Task, Project, Area, TaskContext, Quadrant } from '../../types/domain.ts'
import type { TaskSaveInput } from '../../../api/_schemas/task.ts'
import { ConfirmDialog } from '../common/ConfirmDialog.tsx'
import { Chip } from '../common/Chip.tsx'
import { IconCalendar, IconClock, IconPause, IconRepeat, IconSparkle, EnergyDots } from '../common/Icon.tsx'
import { QUADRANT_COLORS } from '../../types/domain.ts'

function tinted(color: string): React.CSSProperties {
  return {
    background: `${color}33`,
    borderColor: `${color}88`,
    color: 'var(--fg)',
  }
}

interface ClassifyResult {
  areaId: string | null
  context: TaskContext | null
  energy: number | null
  timeEstimateMin: number | null
  rationale: string
  confidence: 'high' | 'medium' | 'low'
}

interface Props {
  task: Task
  projects: Project[]
  areas: Area[]
  onSave: (input: TaskSaveInput) => Promise<void>
  onArchive: (id: string) => Promise<void>
  onClassify?: (taskId: string) => Promise<ClassifyResult>
  onClose: () => void
  isCreate?: boolean
}

const STATUS_LABELS: Record<Task['status'], string> = {
  inbox: 'Inbox', next: 'Próxima', doing: 'Fazendo', blocked: 'Bloqueada',
  done: 'Concluída', waiting: 'Aguardando', scheduled: 'Agendada',
  someday: 'Algum dia', cancelled: 'Cancelada',
}

const PRIORITY_LABELS: Record<Task['priority'], string> = {
  high: '!alta', med: '!média', low: '!baixa',
}

const PRIORITY_COLORS: Record<Task['priority'], string> = {
  high: '#ef4444', med: '#fbbf24', low: '#94a3b8',
}

const CONTEXT_LABELS: Record<TaskContext, string> = {
  deep: 'deep', shallow: 'shallow', social: 'social',
  criativo: 'criativo', somatico: 'somático', offline: 'offline',
}

const CONTEXT_COLORS: Record<TaskContext, string> = {
  deep: '#a78bfa',
  shallow: '#9ca3af',
  social: '#fb923c',
  criativo: '#f472b6',
  somatico: '#34d399',
  offline: '#64748b',
}

const QUADRANT_LABELS_SHORT: Record<Quadrant, string> = {
  I: 'I · Interior', IT: 'IT · Comportamento', WE: 'WE · Coletivo', ITS: 'ITS · Sistemas',
}

function isoToLocalInput(iso?: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function localInputToIso(local: string): string | undefined {
  if (!local) return undefined
  const d = new Date(local)
  if (isNaN(d.getTime())) return undefined
  return d.toISOString()
}

export function TaskPanel({ task, projects, areas, onSave, onArchive, onClassify, onClose, isCreate }: Props) {
  const [title, setTitle] = useState(task.title)
  const [notes, setNotes] = useState(task.notes)
  const [status, setStatus] = useState(task.status)
  const [priority, setPriority] = useState(task.priority)
  const [projectId, setProjectId] = useState(task.projectId)
  const [areaId, setAreaId] = useState<string | undefined>(task.areaId)
  const [context, setContext] = useState<TaskContext | undefined>(task.context)
  const [energy, setEnergy] = useState<number | undefined>(task.energy)
  const [timeEst, setTimeEst] = useState<number | undefined>(task.timeEstimateMin)
  const [dueAt, setDueAt] = useState(isoToLocalInput(task.dueAt))
  const [scheduledAt, setScheduledAt] = useState(isoToLocalInput(task.scheduledAt))
  const [waitingFor, setWaitingFor] = useState(task.waitingFor ?? '')
  const [rrule, setRrule] = useState(task.rrule ?? '')
  const [tags, setTags] = useState(task.tags.join(', '))
  const [saving, setSaving] = useState(false)
  const [classifying, setClassifying] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [aiRationale, setAiRationale] = useState<string | null>(null)

  useEffect(() => {
    setTitle(task.title); setNotes(task.notes); setStatus(task.status)
    setPriority(task.priority); setProjectId(task.projectId)
    setAreaId(task.areaId); setContext(task.context); setEnergy(task.energy)
    setTimeEst(task.timeEstimateMin); setDueAt(isoToLocalInput(task.dueAt))
    setScheduledAt(isoToLocalInput(task.scheduledAt))
    setWaitingFor(task.waitingFor ?? ''); setRrule(task.rrule ?? '')
    setTags(task.tags.join(', '))
    setAiRationale(null)
  }, [task])

  const selectedArea = areas.find(a => a.id === areaId)
  const selectedProject = projects.find(p => p.id === projectId)
  const tagsList = tags.split(',').map(t => t.trim()).filter(Boolean)

  const handleSave = async () => {
    if (!title.trim()) return
    setSaving(true)
    try {
      const input: TaskSaveInput = {
        title: title.trim(),
        notes,
        status,
        priority,
        projectId,
        tags: tagsList,
        dependsOn: task.dependsOn,
      }
      if (!isCreate && task.id) input.id = task.id
      if (areaId) input.areaId = areaId
      if (context) input.context = context
      if (energy !== undefined) input.energy = energy
      if (timeEst !== undefined && timeEst > 0) input.timeEstimateMin = timeEst
      const dueIso = localInputToIso(dueAt)
      if (dueIso) input.dueAt = dueIso
      const schedIso = localInputToIso(scheduledAt)
      if (schedIso) input.scheduledAt = schedIso
      if (waitingFor.trim()) input.waitingFor = waitingFor.trim()
      if (rrule.trim()) input.rrule = rrule.trim()
      await onSave(input)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const handleArchive = async () => {
    if (!task.id) return
    setSaving(true)
    try {
      await onArchive(task.id)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const handleClassify = async () => {
    if (!onClassify || !task.id) return
    setClassifying(true)
    try {
      const r = await onClassify(task.id)
      if (r.areaId) setAreaId(r.areaId)
      if (r.context) setContext(r.context)
      if (r.energy != null) setEnergy(r.energy)
      if (r.timeEstimateMin != null) setTimeEst(r.timeEstimateMin)
      setAiRationale(`${r.confidence}: ${r.rationale}`)
    } finally {
      setClassifying(false)
    }
  }

  // EnergyDots component is used inline; keep helper for label fallback
  const energyLabel = (n?: number): string => n ? `${n}/5` : '+ energia'

  return (
    <>
      <div className="task-panel-overlay" onClick={onClose}>
        <div className="task-panel" onClick={e => e.stopPropagation()}>
          <div className="task-panel-header">
            <span className="task-panel-label">{isCreate ? 'Nova tarefa' : 'Tarefa'}</span>
            <button className="task-panel-close" onClick={onClose} aria-label="Fechar">×</button>
          </div>

          <div className="task-panel-body">
            <textarea
              className="task-panel-title-input"
              value={title}
              onChange={e => setTitle(e.target.value)}
              rows={2}
              placeholder="Título da tarefa"
              autoFocus={isCreate}
            />

            {/* Linha 1: status, prioridade, projeto */}
            <div className="chip-row">
              <Chip
                label={STATUS_LABELS[status]}
                active
                popover={(close) => (
                  <div className="popover-list">
                    {Object.entries(STATUS_LABELS).map(([k, label]) => (
                      <button key={k} className="popover-item" onClick={() => { setStatus(k as Task['status']); close() }}>
                        {label}
                      </button>
                    ))}
                  </div>
                )}
              />
              <Chip
                label={PRIORITY_LABELS[priority]}
                style={tinted(PRIORITY_COLORS[priority])}
                popover={(close) => (
                  <div className="popover-list">
                    {(Object.keys(PRIORITY_LABELS) as Task['priority'][]).map(p => (
                      <button
                        key={p}
                        className="popover-item"
                        onClick={() => { setPriority(p); close() }}
                        style={{ borderLeft: `3px solid ${PRIORITY_COLORS[p]}` }}
                      >
                        {PRIORITY_LABELS[p]}
                      </button>
                    ))}
                  </div>
                )}
              />
              <Chip
                label={selectedProject?.name ?? 'Sem projeto'}
                popover={(close) => (
                  <div className="popover-list">
                    {projects.map(p => (
                      <button key={p.id} className="popover-item" onClick={() => { setProjectId(p.id); close() }}>
                        {p.name}
                      </button>
                    ))}
                  </div>
                )}
              />
            </div>

            {/* Linha 2: AQAL — área, contexto, energia, tempo */}
            <div className="chip-row">
              <Chip
                label={selectedArea?.name ?? '+ área'}
                {...(selectedArea ? { style: tinted(QUADRANT_COLORS[selectedArea.quadrant]) } : {})}
                popover={(close) => (
                  <div className="popover-list">
                    <button className="popover-item" onClick={() => { setAreaId(undefined); close() }}>
                      sem área
                    </button>
                    {areas.map(a => (
                      <button
                        key={a.id}
                        className="popover-item"
                        onClick={() => { setAreaId(a.id); close() }}
                        style={{ borderLeft: `3px solid ${QUADRANT_COLORS[a.quadrant]}` }}
                      >
                        {a.name} <span className="popover-item-meta">{QUADRANT_LABELS_SHORT[a.quadrant]}</span>
                      </button>
                    ))}
                  </div>
                )}
              />
              <Chip
                label={context ? `@${CONTEXT_LABELS[context]}` : '+ contexto'}
                {...(context ? { style: tinted(CONTEXT_COLORS[context]) } : {})}
                popover={(close) => (
                  <div className="popover-list">
                    <button className="popover-item" onClick={() => { setContext(undefined); close() }}>sem contexto</button>
                    {(Object.keys(CONTEXT_LABELS) as TaskContext[]).map(c => (
                      <button
                        key={c}
                        className="popover-item"
                        onClick={() => { setContext(c); close() }}
                        style={{ borderLeft: `3px solid ${CONTEXT_COLORS[c]}` }}
                      >
                        @{CONTEXT_LABELS[c]}
                      </button>
                    ))}
                  </div>
                )}
              />
              <Chip
                label={energyLabel(energy)}
                icon={energy ? <EnergyDots value={energy} /> : undefined}
                popover={(close) => (
                  <div className="popover-row">
                    {[1, 2, 3, 4, 5].map(n => (
                      <button key={n} className="popover-item-small" onClick={() => { setEnergy(n); close() }}>
                        <EnergyDots value={n} />
                      </button>
                    ))}
                    <button className="popover-item-small" onClick={() => { setEnergy(undefined); close() }}>—</button>
                  </div>
                )}
              />
              <Chip
                label={timeEst ? `${timeEst}min` : '+ tempo'}
                popover={(close) => (
                  <div className="popover-input">
                    <input
                      type="number"
                      min="1"
                      placeholder="minutos"
                      defaultValue={timeEst ?? ''}
                      autoFocus
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          const v = parseInt(e.currentTarget.value, 10)
                          setTimeEst(isNaN(v) || v <= 0 ? undefined : v)
                          close()
                        }
                      }}
                    />
                  </div>
                )}
              />
            </div>

            {/* Linha 3: datas e waiting */}
            <div className="chip-row">
              <Chip
                label={dueAt ? dueAt.replace('T', ' ') : '+ due'}
                icon={<IconCalendar />}
                popover={(close) => (
                  <div className="popover-input">
                    <input
                      type="datetime-local"
                      value={dueAt}
                      onChange={e => setDueAt(e.target.value)}
                      autoFocus
                    />
                    {dueAt && <button className="popover-item-small" onMouseDown={() => { setDueAt(''); close() }}>limpar</button>}
                  </div>
                )}
              />
              <Chip
                label={scheduledAt ? scheduledAt.replace('T', ' ') : '+ scheduled'}
                icon={<IconClock />}
                popover={(close) => (
                  <div className="popover-input">
                    <input
                      type="datetime-local"
                      value={scheduledAt}
                      onChange={e => setScheduledAt(e.target.value)}
                      autoFocus
                    />
                    {scheduledAt && <button className="popover-item-small" onMouseDown={() => { setScheduledAt(''); close() }}>limpar</button>}
                  </div>
                )}
              />
              <Chip
                label={waitingFor || '+ waiting'}
                icon={<IconPause />}
                popover={(close) => (
                  <div className="popover-input">
                    <input
                      type="text"
                      placeholder="esperando quem/o que"
                      defaultValue={waitingFor}
                      autoFocus
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          setWaitingFor(e.currentTarget.value.trim())
                          close()
                        }
                      }}
                    />
                  </div>
                )}
              />
            </div>

            {/* Linha 4: AI, recorrência, tags */}
            <div className="chip-row">
              {onClassify && task.id && (
                <Chip
                  label={classifying ? 'classificando…' : 'classificar IA'}
                  icon={<IconSparkle />}
                  variant="ai"
                  onClick={() => { void handleClassify() }}
                />
              )}
              <Chip
                label={rrule ? rruleLabel(rrule) : '+ recorrência'}
                icon={<IconRepeat />}
                popover={(close) => (
                  <div className="popover-list">
                    {RRULE_PRESETS.map(p => (
                      <button key={p.label} className="popover-item" onClick={() => { setRrule(p.value); close() }}>
                        {p.label}
                      </button>
                    ))}
                    <button className="popover-item" onClick={() => { setRrule(''); close() }}>nenhuma</button>
                    <div style={{ marginTop: '8px', borderTop: '1px solid var(--border-light)', paddingTop: '8px' }}>
                      <input
                        type="text"
                        className="popover-input-text"
                        placeholder="custom: FREQ=..."
                        defaultValue={rrule}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            setRrule(e.currentTarget.value.trim())
                            close()
                          }
                        }}
                      />
                    </div>
                  </div>
                )}
              />
            </div>

            {/* Tags chips inline */}
            <div className="chip-row">
              {tagsList.map(tag => (
                <Chip
                  key={tag}
                  label={`#${tag}`}
                  onClick={() => setTags(tagsList.filter(t => t !== tag).join(', '))}
                />
              ))}
              <Chip
                label="+ tag"
                popover={(close) => (
                  <div className="popover-input">
                    <input
                      type="text"
                      placeholder="nova tag"
                      autoFocus
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          const v = e.currentTarget.value.trim()
                          if (v && !tagsList.includes(v)) {
                            setTags([...tagsList, v].join(', '))
                          }
                          close()
                        }
                      }}
                    />
                  </div>
                )}
              />
            </div>

            {aiRationale && (
              <div className="ai-rationale">
                <IconSparkle size={12} /> {aiRationale}
              </div>
            )}

            <span className="task-panel-notes-label">Notas</span>
            <textarea
              className="task-panel-notes"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Anotações…"
            />
          </div>

          <div className="task-panel-actions">
            {!isCreate && task.id && (
              <button className="btn btn-ghost" onClick={() => setConfirmOpen(true)} disabled={saving}>
                Arquivar
              </button>
            )}
            <button className="btn btn-accent" onClick={() => { void handleSave() }} disabled={saving || !title.trim()}>
              {saving ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Arquivar tarefa"
        message="Esta tarefa será removida da lista."
        detail={task.title}
        confirmLabel="Arquivar"
        onConfirm={() => { void handleArchive() }}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  )
}

const RRULE_PRESETS = [
  { label: 'diária', value: 'FREQ=DAILY' },
  { label: 'dias úteis', value: 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR' },
  { label: 'semanal (mesma sem.)', value: 'FREQ=WEEKLY' },
  { label: 'quinzenal', value: 'FREQ=WEEKLY;INTERVAL=2' },
  { label: 'mensal', value: 'FREQ=MONTHLY' },
]

function rruleLabel(rrule: string): string {
  const preset = RRULE_PRESETS.find(p => p.value === rrule)
  if (preset) return preset.label
  return 'custom'
}

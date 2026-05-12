import { useState, useEffect } from 'react'
import type { Project, Area, HorizonLvl, ProjectKind, ProjectStatusType } from '../../types/domain.ts'
import type { ProjectSaveInput } from '../../../api/_schemas/project.ts'
import { ConfirmDialog } from '../common/ConfirmDialog.tsx'
import { Chip } from '../common/Chip.tsx'
import { IconCalendar } from '../common/Icon.tsx'
import { QUADRANT_COLORS } from '../../types/domain.ts'

const STATUS_LABELS: Record<ProjectStatusType, string> = {
  active: 'ativo', on_hold: 'pausado', someday: 'algum dia', done: 'concluído', archived: 'arquivado',
}
const STATUS_COLORS: Record<ProjectStatusType, string> = {
  active: '#7dd3fc', on_hold: '#9ca3af', someday: '#a78bfa', done: '#34d399', archived: '#64748b',
}
const KIND_LABELS: Record<ProjectKind, string> = { outcome: 'outcome', evergreen: 'evergreen' }
const KIND_COLORS: Record<ProjectKind, string> = { outcome: '#7dd3fc', evergreen: '#9ca3af' }
const HORIZON_LABELS: Record<HorizonLvl, string> = {
  H0: 'H0 · agora', H1: 'H1 · esta semana', H2: 'H2 · trimestre',
  H3: 'H3 · 1-2 anos', H4: 'H4 · 3-5 anos', H5: 'H5 · vida',
}

function tinted(color: string): React.CSSProperties {
  return { background: `${color}33`, borderColor: `${color}88`, color: 'var(--fg)' }
}

interface Props {
  project: Project
  areas: Area[]
  allProjects: Project[]
  onSave: (input: ProjectSaveInput) => Promise<void>
  onArchive: (id: string) => Promise<void>
  onComplete?: (id: string) => Promise<void>
  onClose: () => void
  isCreate?: boolean
}

export function ProjectPanel({ project, areas, allProjects, onSave, onArchive, onComplete, onClose, isCreate }: Props) {
  const [name, setName] = useState(project.name)
  const [outcome, setOutcome] = useState(project.outcome ?? '')
  const [status, setStatus] = useState<ProjectStatusType>(project.status)
  const [kind, setKind] = useState<ProjectKind>(project.kind)
  const [horizon, setHorizon] = useState<HorizonLvl>(project.horizon)
  const [areaId, setAreaId] = useState<string | undefined>(project.areaId)
  const [parentId, setParentId] = useState<string | undefined>(project.parentId)
  const [targetDate, setTargetDate] = useState(project.targetDate ?? '')
  const [saving, setSaving] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  useEffect(() => {
    setName(project.name); setOutcome(project.outcome ?? ''); setStatus(project.status)
    setKind(project.kind); setHorizon(project.horizon); setAreaId(project.areaId)
    setParentId(project.parentId); setTargetDate(project.targetDate ?? '')
  }, [project])

  const selectedArea = areas.find(a => a.id === areaId)
  const possibleParents = allProjects.filter(p => !p.parentId && p.id !== project.id)
  const selectedParent = possibleParents.find(p => p.id === parentId)

  const handleSave = async () => {
    if (!name.trim()) return
    setSaving(true)
    try {
      const input: ProjectSaveInput = {
        name: name.trim(),
        kind,
        status,
        horizon,
        color: project.color,
      }
      if (!isCreate && project.id) input.id = project.id
      if (outcome.trim()) input.outcome = outcome.trim()
      if (areaId) input.areaId = areaId
      if (parentId) input.parentId = parentId
      if (targetDate) input.targetDate = targetDate
      await onSave(input)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const handleArchive = async () => {
    if (!project.id) return
    setSaving(true)
    try { await onArchive(project.id); onClose() }
    finally { setSaving(false) }
  }

  const handleComplete = async () => {
    if (!project.id || !onComplete) return
    setSaving(true)
    try { await onComplete(project.id); onClose() }
    finally { setSaving(false) }
  }

  return (
    <>
      <div className="task-panel-overlay" onClick={onClose}>
        <div className="task-panel" onClick={e => e.stopPropagation()}>
          <div className="task-panel-header">
            <span className="task-panel-label">{isCreate ? 'Novo projeto' : 'Projeto'}</span>
            <button className="task-panel-close" onClick={onClose} aria-label="Fechar">×</button>
          </div>

          <div className="task-panel-body">
            <textarea
              className="task-panel-title-input"
              value={name}
              onChange={e => setName(e.target.value)}
              rows={2}
              placeholder="Nome do projeto"
              autoFocus={isCreate}
            />

            <div className="chip-row">
              <Chip
                label={STATUS_LABELS[status]}
                style={tinted(STATUS_COLORS[status])}
                popover={(close) => (
                  <div className="popover-list">
                    {(Object.keys(STATUS_LABELS) as ProjectStatusType[]).filter(s => s !== 'archived').map(s => (
                      <button key={s} className="popover-item" onClick={() => { setStatus(s); close() }}
                        style={{ borderLeft: `3px solid ${STATUS_COLORS[s]}` }}>
                        {STATUS_LABELS[s]}
                      </button>
                    ))}
                  </div>
                )}
              />
              <Chip
                label={KIND_LABELS[kind]}
                style={tinted(KIND_COLORS[kind])}
                popover={(close) => (
                  <div className="popover-list">
                    {(Object.keys(KIND_LABELS) as ProjectKind[]).map(k => (
                      <button key={k} className="popover-item" onClick={() => { setKind(k); close() }}>
                        {KIND_LABELS[k]}
                      </button>
                    ))}
                  </div>
                )}
              />
              <Chip
                label={HORIZON_LABELS[horizon]}
                popover={(close) => (
                  <div className="popover-list">
                    {(Object.keys(HORIZON_LABELS) as HorizonLvl[]).map(h => (
                      <button key={h} className="popover-item" onClick={() => { setHorizon(h); close() }}>
                        {HORIZON_LABELS[h]}
                      </button>
                    ))}
                  </div>
                )}
              />
            </div>

            <div className="chip-row">
              <Chip
                label={selectedArea?.name ?? '+ área'}
                {...(selectedArea ? { style: tinted(QUADRANT_COLORS[selectedArea.quadrant]) } : {})}
                popover={(close) => (
                  <div className="popover-list">
                    <button className="popover-item" onClick={() => { setAreaId(undefined); close() }}>sem área</button>
                    {areas.map(a => (
                      <button key={a.id} className="popover-item"
                        onClick={() => { setAreaId(a.id); close() }}
                        style={{ borderLeft: `3px solid ${QUADRANT_COLORS[a.quadrant]}` }}>
                        {a.name}
                      </button>
                    ))}
                  </div>
                )}
              />
              <Chip
                label={targetDate || '+ target'}
                icon={<IconCalendar />}
                popover={(close) => (
                  <div className="popover-input">
                    <input type="date" value={targetDate}
                      onChange={e => setTargetDate(e.target.value)} autoFocus />
                    {targetDate && <button className="popover-item-small"
                      onMouseDown={() => { setTargetDate(''); close() }}>limpar</button>}
                  </div>
                )}
              />
              <Chip
                label={selectedParent ? `pai: ${selectedParent.name}` : '+ parent'}
                popover={(close) => (
                  <div className="popover-list">
                    <button className="popover-item" onClick={() => { setParentId(undefined); close() }}>sem pai</button>
                    {possibleParents.map(p => (
                      <button key={p.id} className="popover-item" onClick={() => { setParentId(p.id); close() }}>
                        {p.name}
                      </button>
                    ))}
                    {possibleParents.length === 0 && (
                      <span className="popover-item" style={{ color: 'var(--fg-muted)', fontStyle: 'italic' }}>
                        nenhum pai disponível
                      </span>
                    )}
                  </div>
                )}
              />
            </div>

            <span className="task-panel-notes-label">Outcome</span>
            <textarea
              className="task-panel-notes"
              value={outcome}
              onChange={e => setOutcome(e.target.value)}
              placeholder="o resultado esperado é..."
            />
          </div>

          <div className="task-panel-actions">
            {!isCreate && project.id && (
              <button className="btn btn-ghost" onClick={() => setConfirmOpen(true)} disabled={saving}>
                Arquivar
              </button>
            )}
            {!isCreate && project.id && kind === 'outcome' && status !== 'done' && onComplete && (
              <button className="btn btn-ghost" onClick={() => { void handleComplete() }} disabled={saving}>
                Marcar concluído
              </button>
            )}
            <button className="btn btn-accent" onClick={() => { void handleSave() }} disabled={saving || !name.trim()}>
              {saving ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Arquivar projeto"
        message="Este projeto será removido da lista (tasks dele continuam visíveis)."
        detail={project.name}
        confirmLabel="Arquivar"
        onConfirm={() => { void handleArchive() }}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  )
}

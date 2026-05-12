import type { Project, Area, HorizonLvl } from '../../types/domain.ts'
import { QUADRANT_COLORS } from '../../types/domain.ts'
import { ProjectRow } from './ProjectRow.tsx'

type Mode = 'horizon' | 'area' | 'flat'

interface Props {
  projects: Project[]
  areas: Area[]
  mode: Mode
  onSelect: (project: Project) => void
}

const HORIZON_ORDER: HorizonLvl[] = ['H0', 'H1', 'H2', 'H3', 'H4', 'H5']
const HORIZON_LABELS: Record<HorizonLvl, string> = {
  H0: 'H0 · agora', H1: 'H1 · esta semana', H2: 'H2 · trimestre',
  H3: 'H3 · 1-2 anos', H4: 'H4 · 3-5 anos', H5: 'H5 · vida',
}

interface Group {
  id: string
  label: string
  accent?: string
  projects: Project[]
}

function groupProjects(projects: Project[], areas: Area[], mode: Mode): Group[] {
  const parents = projects.filter(p => !p.parentId)

  if (mode === 'horizon') {
    return HORIZON_ORDER
      .map(h => ({
        id: h,
        label: HORIZON_LABELS[h],
        projects: parents.filter(p => p.horizon === h),
      }))
      .filter(g => g.projects.length > 0)
  }

  if (mode === 'area') {
    const groups: Group[] = []
    for (const a of areas) {
      const ps = parents.filter(p => p.areaId === a.id)
      if (ps.length > 0) {
        groups.push({ id: a.id, label: a.name, accent: QUADRANT_COLORS[a.quadrant], projects: ps })
      }
    }
    const noArea = parents.filter(p => !p.areaId)
    if (noArea.length > 0) groups.push({ id: 'none', label: 'sem área', projects: noArea })
    return groups
  }

  return [{ id: 'all', label: '', projects: parents }]
}

export function ProjectsView({ projects, areas, mode, onSelect }: Props) {
  const groups = groupProjects(projects, areas, mode)
  const childrenByParent = new Map<string, Project[]>()
  for (const p of projects) {
    if (p.parentId) {
      const arr = childrenByParent.get(p.parentId) ?? []
      arr.push(p)
      childrenByParent.set(p.parentId, arr)
    }
  }

  if (groups.length === 0) {
    return <div className="empty-state">Nenhum projeto neste filtro</div>
  }

  return (
    <div className="content">
      {groups.map(g => (
        <div key={g.id} className="task-group">
          {g.label && (
            <div className="task-group-title" style={g.accent ? { color: g.accent } : undefined}>
              {g.label}
              <span className="task-group-count">{g.projects.length}</span>
            </div>
          )}
          {g.projects.map(p => (
            <div key={p.id}>
              <ProjectRow project={p} areas={areas} onSelect={onSelect} />
              {(childrenByParent.get(p.id) ?? []).map(child => (
                <ProjectRow key={child.id} project={child} areas={areas} isChild onSelect={onSelect} />
              ))}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Topbar } from '../components/layout/Topbar.tsx'
import { ThemeToggle } from '../components/common/ThemeToggle.tsx'
import { ConfirmDialog } from '../components/common/ConfirmDialog.tsx'
import { useAreas } from '../hooks/useAreas.ts'
import type { Area, Quadrant } from '../types/domain.ts'
import { QUADRANT_LABELS, QUADRANT_COLORS } from '../types/domain.ts'
import type { AreaSaveInput } from '../../api/_schemas/area.ts'

const QUADRANT_ORDER: Quadrant[] = ['I', 'IT', 'WE', 'ITS']

function slugify(s: string): string {
  return s.toLowerCase()
    .normalize('NFD').replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    .slice(0, 60) || 'area'
}

interface EditorProps {
  area?: Area
  parentOptions: Area[]
  onSave: (input: AreaSaveInput) => Promise<void>
  onCancel: () => void
}

function AreaEditor({ area, parentOptions, onSave, onCancel }: EditorProps) {
  const [name, setName] = useState(area?.name ?? '')
  const [slug, setSlug] = useState(area?.slug ?? '')
  const [quadrant, setQuadrant] = useState<Quadrant>(area?.quadrant ?? 'IT')
  const [parentId, setParentId] = useState(area?.parentId ?? '')
  const [color, setColor] = useState(area?.color ?? '')
  const [icon, setIcon] = useState(area?.icon ?? '')
  const [visionH4, setVisionH4] = useState(area?.visionH4 ?? '')
  const [saving, setSaving] = useState(false)

  const slugTouched = slug !== '' && slug !== slugify(name)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    try {
      const finalSlug = (slug || slugify(name)).trim()
      const input: AreaSaveInput = {
        name: name.trim(),
        slug: finalSlug,
        quadrant,
        parentId: parentId || null,
        color: color || null,
        icon: icon || null,
        visionH4: visionH4.trim() || null,
      }
      if (area) input.id = area.id
      await onSave(input)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={e => { void handleSubmit(e) }} style={{ background: 'var(--bg-subtle)', padding: '16px', marginBottom: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11px', color: 'var(--fg-muted)' }}>
        Nome
        <input
          value={name}
          onChange={e => {
            setName(e.target.value)
            if (!slugTouched) setSlug(slugify(e.target.value))
          }}
          placeholder="Ex: Plantas"
          autoFocus
          style={{ padding: '8px', background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--fg)', fontFamily: 'inherit', fontSize: '13px' }}
        />
      </label>

      <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11px', color: 'var(--fg-muted)' }}>
        Slug
        <input value={slug} onChange={e => setSlug(e.target.value)} placeholder="kebab-case"
          style={{ padding: '8px', background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--fg)', fontFamily: 'inherit', fontSize: '13px' }} />
      </label>

      <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11px', color: 'var(--fg-muted)' }}>
        Quadrante
        <select value={quadrant} onChange={e => setQuadrant(e.target.value as Quadrant)}
          style={{ padding: '8px', background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--fg)', fontFamily: 'inherit', fontSize: '13px' }}>
          {QUADRANT_ORDER.map(q => (
            <option key={q} value={q}>{q} — {QUADRANT_LABELS[q]}</option>
          ))}
        </select>
      </label>

      <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11px', color: 'var(--fg-muted)' }}>
        Sub-área de
        <select value={parentId} onChange={e => setParentId(e.target.value)}
          style={{ padding: '8px', background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--fg)', fontFamily: 'inherit', fontSize: '13px' }}>
          <option value="">(top-level)</option>
          {parentOptions.filter(o => o.id !== area?.id).map(o => (
            <option key={o.id} value={o.id}>{o.name}</option>
          ))}
        </select>
      </label>

      <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11px', color: 'var(--fg-muted)' }}>
        Cor (hex)
        <input value={color} onChange={e => setColor(e.target.value)} placeholder="#DFD0EC"
          style={{ padding: '8px', background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--fg)', fontFamily: 'inherit', fontSize: '13px' }} />
      </label>

      <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11px', color: 'var(--fg-muted)' }}>
        Ícone (lucide)
        <input value={icon} onChange={e => setIcon(e.target.value)} placeholder="leaf, home, brain…"
          style={{ padding: '8px', background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--fg)', fontFamily: 'inherit', fontSize: '13px' }} />
      </label>

      <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11px', color: 'var(--fg-muted)' }}>
        Visão (H4) — onde quero estar nessa área em 3-5 anos
        <textarea value={visionH4} onChange={e => setVisionH4(e.target.value)} rows={3}
          style={{ padding: '8px', background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--fg)', fontFamily: 'inherit', fontSize: '13px', resize: 'vertical' }}
          placeholder="Texto livre…" />
      </label>

      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancelar</button>
        <button type="submit" className="btn btn-accent" disabled={saving || !name.trim()}>
          {saving ? 'Salvando…' : area ? 'Salvar' : 'Criar'}
        </button>
      </div>
    </form>
  )
}

export function AreasPage() {
  const navigate = useNavigate()
  const { areas, loading, save, archive } = useAreas()
  const [editing, setEditing] = useState<Area | 'new' | null>(null)
  const [confirmArchive, setConfirmArchive] = useState<Area | null>(null)

  const grouped = QUADRANT_ORDER.map(q => ({
    quadrant: q,
    areas: areas.filter(a => a.quadrant === q && !a.parentId).sort((a, b) => a.position - b.position),
  }))

  const childrenOf = (parentId: string) =>
    areas.filter(a => a.parentId === parentId).sort((a, b) => a.position - b.position)

  if (loading) {
    return (
      <div>
        <Topbar title="Áreas de vida" actions={<ThemeToggle />} />
        <div className="empty-state" style={{ paddingTop: '30vh' }}>Carregando…</div>
      </div>
    )
  }

  return (
    <div>
      <Topbar
        title="Áreas de vida"
        actions={(
          <>
            <button className="btn btn-ghost" onClick={() => navigate('/config')} style={{ fontSize: '11px' }}>← Config</button>
            <ThemeToggle />
          </>
        )}
      />

      <div className="content">
        <div style={{ marginBottom: '24px' }}>
          {editing === 'new' ? (
            <AreaEditor
              parentOptions={areas}
              onSave={async input => { await save(input); setEditing(null) }}
              onCancel={() => setEditing(null)}
            />
          ) : (
            <button className="btn btn-accent" onClick={() => setEditing('new')} style={{ fontSize: '12px' }}>+ Nova área</button>
          )}
        </div>

        {grouped.map(({ quadrant, areas: qAreas }) => (
          <div key={quadrant} className="section">
            <div className="section-title" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: QUADRANT_COLORS[quadrant], display: 'inline-block' }} />
              <span>{quadrant} — {QUADRANT_LABELS[quadrant]}</span>
              <span className="count">{qAreas.length}</span>
            </div>

            {qAreas.length === 0 && (
              <div className="empty-state" style={{ padding: '12px 0', textAlign: 'left', fontSize: '12px' }}>—</div>
            )}

            {qAreas.map(a => (
              <div key={a.id}>
                {editing && editing !== 'new' && editing.id === a.id ? (
                  <AreaEditor
                    area={a}
                    parentOptions={areas}
                    onSave={async input => { await save(input); setEditing(null) }}
                    onCancel={() => setEditing(null)}
                  />
                ) : (
                  <div style={{ padding: '12px 0', borderBottom: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '13px', fontWeight: 600 }}>{a.name}</div>
                      <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--fg-dim)', letterSpacing: '0.5px' }}>
                        /{a.slug}{a.icon ? ` · ${a.icon}` : ''}
                      </div>
                      {a.visionH4 && (
                        <div style={{ fontSize: '11px', color: 'var(--fg-muted)', marginTop: '4px', fontStyle: 'italic' }}>
                          “{a.visionH4.slice(0, 100)}{a.visionH4.length > 100 ? '…' : ''}”
                        </div>
                      )}
                    </div>
                    <button className="btn btn-ghost" onClick={() => setEditing(a)} style={{ fontSize: '10px' }}>Editar</button>
                    <button onClick={() => setConfirmArchive(a)} title="Arquivar" style={{ background: 'none', border: 'none', color: 'var(--fg-dim)', cursor: 'pointer', fontSize: '16px' }}>×</button>
                  </div>
                )}

                {childrenOf(a.id).map(child => (
                  <div key={child.id} style={{ paddingLeft: '20px' }}>
                    {editing && editing !== 'new' && editing.id === child.id ? (
                      <AreaEditor
                        area={child}
                        parentOptions={areas}
                        onSave={async input => { await save(input); setEditing(null) }}
                        onCancel={() => setEditing(null)}
                      />
                    ) : (
                      <div style={{ padding: '10px 0', borderBottom: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ fontSize: '11px', color: 'var(--fg-muted)' }}>↳</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '12px', fontWeight: 500 }}>{child.name}</div>
                          <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--fg-dim)' }}>/{child.slug}</div>
                        </div>
                        <button className="btn btn-ghost" onClick={() => setEditing(child)} style={{ fontSize: '10px' }}>Editar</button>
                        <button onClick={() => setConfirmArchive(child)} title="Arquivar" style={{ background: 'none', border: 'none', color: 'var(--fg-dim)', cursor: 'pointer', fontSize: '16px' }}>×</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        ))}
      </div>

      <ConfirmDialog
        open={confirmArchive !== null}
        title="Arquivar área"
        message="A área será ocultada. Tasks e projetos associados continuam existindo."
        detail={confirmArchive?.name ?? ''}
        confirmLabel="Arquivar"
        onConfirm={() => {
          if (confirmArchive) { void archive(confirmArchive.id) }
          setConfirmArchive(null)
        }}
        onCancel={() => setConfirmArchive(null)}
      />
    </div>
  )
}

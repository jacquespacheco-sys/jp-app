import { useState } from 'react'
import { useCategoryDimensions } from '../../hooks/useCategoryDimensions.ts'
import { useCategories } from '../../hooks/useCategories.ts'
import { CategoryChip } from '../shared/CategoryChip.tsx'
import { api } from '../../api.ts'
import { CATEGORY_COLORS } from '../../../api/_schemas/category.ts'
import type { CategoryColor, CategoryDimension, Category } from '../../types/domain.ts'

function slugify(s: string): string {
  return s.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

export function CategoriesConfigSection() {
  const { dimensions, loading: lDim, save: saveDim, archive: archiveDim, refetch: refetchDim } = useCategoryDimensions()
  const { categories, loading: lCat, save: saveCat, archive: archiveCat, refetch: refetchCat } = useCategories()
  const [editingDim, setEditingDim] = useState<CategoryDimension | 'new' | null>(null)
  const [editingCat, setEditingCat] = useState<{ dim: CategoryDimension; cat: Category | 'new' } | null>(null)
  const [reseeding, setReseeding] = useState(false)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const handleReseed = async () => {
    setReseeding(true)
    try {
      await api.post('/api/categories-reseed')
      await Promise.all([refetchDim(), refetchCat()])
    } finally {
      setReseeding(false)
    }
  }

  const moveDimension = async (idx: number, dir: -1 | 1) => {
    const target = idx + dir
    if (target < 0 || target >= dimensions.length) return
    const a = dimensions[idx]
    const b = dimensions[target]
    if (!a || !b) return
    await Promise.all([
      saveDim({ id: a.id, label: a.label, slug: a.slug, sortOrder: b.sortOrder, ...(a.description ? { description: a.description } : {}) }),
      saveDim({ id: b.id, label: b.label, slug: b.slug, sortOrder: a.sortOrder, ...(b.description ? { description: b.description } : {}) }),
    ])
    await refetchDim()
  }

  const moveCategory = async (list: Category[], idx: number, dir: -1 | 1) => {
    const target = idx + dir
    if (target < 0 || target >= list.length) return
    const a = list[idx]
    const b = list[target]
    if (!a || !b) return
    await Promise.all([
      saveCat({
        id: a.id, dimensionId: a.dimensionId, label: a.label, slug: a.slug, sortOrder: b.sortOrder,
        ...(a.color ? { color: a.color } : { color: null }),
        ...(a.description ? { description: a.description } : {}),
      }),
      saveCat({
        id: b.id, dimensionId: b.dimensionId, label: b.label, slug: b.slug, sortOrder: a.sortOrder,
        ...(b.color ? { color: b.color } : { color: null }),
        ...(b.description ? { description: b.description } : {}),
      }),
    ])
    await refetchCat()
  }

  if (lDim || lCat) {
    return <div style={{ fontSize: '12px', color: 'var(--fg-dim)' }}>Carregando…</div>
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
        <div style={{ fontFamily: 'Space Mono, monospace', fontSize: '10px', color: 'var(--fg-muted)', letterSpacing: '1.5px', textTransform: 'uppercase' }}>
          {dimensions.length} dimensões · {categories.length} categorias
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button className="btn btn-ghost" style={{ fontSize: '10px' }} onClick={() => setEditingDim('new')}>
            + Dimensão
          </button>
          <button
            className="btn btn-ghost"
            style={{ fontSize: '10px' }}
            onClick={() => { void handleReseed() }}
            disabled={reseeding}
            title="Recriar seed Carnegie (idempotente)"
          >
            {reseeding ? '...' : 'Reseed'}
          </button>
        </div>
      </div>

      {dimensions.map((dim, dimIdx) => {
        const opts = categories.filter(c => c.dimensionId === dim.id).sort((a, b) => a.sortOrder - b.sortOrder)
        const isOpen = expanded.has(dim.id)
        return (
          <div key={dim.id} style={{ border: '1px solid var(--border)', marginBottom: '10px' }}>
            <div
              onClick={() => toggleExpand(dim.id)}
              style={{
                padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                cursor: 'pointer', background: 'var(--bg-elevated)',
              }}
            >
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600 }}>{dim.label}</div>
                <div style={{ fontFamily: 'Space Mono, monospace', fontSize: '9px', color: 'var(--fg-muted)', letterSpacing: '1px', marginTop: '2px' }}>
                  {opts.length} categorias · slug: {dim.slug}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                <ReorderArrows
                  canUp={dimIdx > 0}
                  canDown={dimIdx < dimensions.length - 1}
                  onUp={e => { e.stopPropagation(); void moveDimension(dimIdx, -1) }}
                  onDown={e => { e.stopPropagation(); void moveDimension(dimIdx, 1) }}
                />
                <button
                  className="btn btn-ghost"
                  style={{ fontSize: '9px', padding: '4px 8px' }}
                  onClick={e => { e.stopPropagation(); setEditingDim(dim) }}
                >
                  Editar
                </button>
                <span style={{ fontFamily: 'Space Mono, monospace', fontSize: '10px', color: 'var(--fg-muted)', minWidth: '10px', textAlign: 'center' }}>
                  {isOpen ? '−' : '+'}
                </span>
              </div>
            </div>
            {isOpen && (
              <div style={{ padding: '12px', borderTop: '1px solid var(--border-light)' }}>
                <div style={{ display: 'grid', gap: '6px', marginBottom: '10px' }}>
                  {opts.map((c, catIdx) => (
                    <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <ReorderArrows
                        canUp={catIdx > 0}
                        canDown={catIdx < opts.length - 1}
                        onUp={e => { e.stopPropagation(); void moveCategory(opts, catIdx, -1) }}
                        onDown={e => { e.stopPropagation(); void moveCategory(opts, catIdx, 1) }}
                      />
                      <div
                        onClick={() => setEditingCat({ dim, cat: c })}
                        style={{ cursor: 'pointer', flex: 1 }}
                      >
                        <CategoryChip category={c} size="md" />
                      </div>
                    </div>
                  ))}
                </div>
                <button
                  className="btn btn-ghost"
                  style={{ fontSize: '10px' }}
                  onClick={() => setEditingCat({ dim, cat: 'new' })}
                >
                  + Categoria
                </button>
              </div>
            )}
          </div>
        )
      })}

      {editingDim && (
        <DimensionModal
          dimension={editingDim === 'new' ? null : editingDim}
          onClose={() => setEditingDim(null)}
          onSave={async data => {
            await saveDim(data)
            setEditingDim(null)
          }}
          {...(editingDim !== 'new' ? {
            onArchive: async () => {
              await archiveDim(editingDim.id, true)
              setEditingDim(null)
            },
          } : {})}
        />
      )}

      {editingCat && (
        <CategoryModal
          dimension={editingCat.dim}
          category={editingCat.cat === 'new' ? null : editingCat.cat}
          onClose={() => setEditingCat(null)}
          onSave={async data => {
            await saveCat(data)
            setEditingCat(null)
          }}
          {...(editingCat.cat !== 'new' ? {
            onArchive: async () => {
              await archiveCat((editingCat.cat as Category).id, true)
              setEditingCat(null)
            },
          } : {})}
        />
      )}
    </>
  )
}

function DimensionModal({
  dimension, onClose, onSave, onArchive,
}: {
  dimension: CategoryDimension | null
  onClose: () => void
  onSave: (data: { id?: string; label: string; slug: string; description?: string; sortOrder: number }) => Promise<void>
  onArchive?: () => Promise<void>
}) {
  const [label, setLabel] = useState(dimension?.label ?? '')
  const [slug, setSlug] = useState(dimension?.slug ?? '')
  const [description, setDescription] = useState(dimension?.description ?? '')
  const [sortOrder, setSortOrder] = useState(dimension?.sortOrder ?? 0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSave = async () => {
    if (!label.trim()) { setError('Label obrigatório'); return }
    const finalSlug = slug.trim() || slugify(label)
    setSaving(true)
    setError('')
    try {
      await onSave({
        ...(dimension ? { id: dimension.id } : {}),
        label: label.trim(),
        slug: finalSlug,
        ...(description.trim() ? { description: description.trim() } : {}),
        sortOrder,
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="task-panel-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="task-panel">
        <div className="task-panel-header">
          <span className="task-panel-label">{dimension ? 'Editar dimensão' : 'Nova dimensão'}</span>
          <button className="task-panel-close" onClick={onClose}>×</button>
        </div>
        <div className="task-panel-body">
          <Label>Label</Label>
          <input
            className="input" value={label}
            onChange={e => { setLabel(e.target.value); if (!dimension) setSlug(slugify(e.target.value)) }}
            placeholder="Ex: Setor" style={{ marginBottom: '12px' }}
          />
          <Label>Slug</Label>
          <input
            className="input" value={slug}
            onChange={e => setSlug(slugify(e.target.value))}
            placeholder="ex: setor" style={{ marginBottom: '12px' }}
          />
          <Label>Descrição</Label>
          <textarea
            className="task-panel-notes" value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="O que essa dimensão classifica?" style={{ minHeight: '60px' }}
          />
          <Label>Ordem</Label>
          <input
            className="input" type="number" min="0"
            value={sortOrder} onChange={e => setSortOrder(parseInt(e.target.value, 10) || 0)}
            style={{ marginBottom: '12px' }}
          />
          {error && <div style={{ color: 'var(--danger)', fontSize: '11px', marginBottom: '8px' }}>{error}</div>}
        </div>
        <div className="task-panel-actions" style={{ flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
            {onArchive && (
              <button className="btn btn-ghost" style={{ color: 'var(--danger)' }} onClick={() => { void onArchive() }}>
                Arquivar
              </button>
            )}
            <button
              className="btn btn-accent"
              style={{ flex: 1, justifyContent: 'center' }}
              onClick={() => { void handleSave() }}
              disabled={saving || !label.trim()}
            >
              {saving ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function CategoryModal({
  dimension, category, onClose, onSave, onArchive,
}: {
  dimension: CategoryDimension
  category: Category | null
  onClose: () => void
  onSave: (data: { id?: string; dimensionId: string; label: string; slug: string; color?: CategoryColor | null; description?: string; sortOrder: number }) => Promise<void>
  onArchive?: () => Promise<void>
}) {
  const [label, setLabel] = useState(category?.label ?? '')
  const [slug, setSlug] = useState(category?.slug ?? '')
  const [color, setColor] = useState<CategoryColor | null>(category?.color ?? null)
  const [description, setDescription] = useState(category?.description ?? '')
  const [sortOrder, setSortOrder] = useState(category?.sortOrder ?? 0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSave = async () => {
    if (!label.trim()) { setError('Label obrigatório'); return }
    const finalSlug = slug.trim() || slugify(label)
    setSaving(true)
    setError('')
    try {
      await onSave({
        ...(category ? { id: category.id } : {}),
        dimensionId: dimension.id,
        label: label.trim(),
        slug: finalSlug,
        color,
        ...(description.trim() ? { description: description.trim() } : {}),
        sortOrder,
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="task-panel-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="task-panel">
        <div className="task-panel-header">
          <span className="task-panel-label">
            {category ? 'Editar categoria' : `Nova categoria em ${dimension.label}`}
          </span>
          <button className="task-panel-close" onClick={onClose}>×</button>
        </div>
        <div className="task-panel-body">
          <Label>Label</Label>
          <input
            className="input" value={label}
            onChange={e => { setLabel(e.target.value); if (!category) setSlug(slugify(e.target.value)) }}
            placeholder="Ex: Finanças" style={{ marginBottom: '12px' }}
          />
          <Label>Slug</Label>
          <input
            className="input" value={slug}
            onChange={e => setSlug(slugify(e.target.value))}
            placeholder="ex: financas" style={{ marginBottom: '12px' }}
          />
          <Label>Cor</Label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
            <button
              type="button"
              onClick={() => setColor(null)}
              style={{
                width: '28px', height: '28px',
                border: color === null ? '2px solid var(--accent)' : '1px solid var(--border)',
                background: 'transparent', cursor: 'pointer',
                fontFamily: 'Space Mono, monospace', fontSize: '14px', color: 'var(--fg-muted)',
              }}
              title="Sem cor"
            >
              —
            </button>
            {CATEGORY_COLORS.map(c => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                style={{
                  width: '28px', height: '28px',
                  background: `var(--chip-${c}-bg)`,
                  border: color === c ? '2px solid var(--accent)' : '1px solid var(--border)',
                  cursor: 'pointer',
                }}
                title={c}
              />
            ))}
          </div>
          <Label>Descrição</Label>
          <textarea
            className="task-panel-notes" value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Opcional" style={{ minHeight: '50px' }}
          />
          <Label>Ordem</Label>
          <input
            className="input" type="number" min="0"
            value={sortOrder} onChange={e => setSortOrder(parseInt(e.target.value, 10) || 0)}
            style={{ marginBottom: '12px' }}
          />
          {error && <div style={{ color: 'var(--danger)', fontSize: '11px', marginBottom: '8px' }}>{error}</div>}
        </div>
        <div className="task-panel-actions" style={{ flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
            {onArchive && (
              <button className="btn btn-ghost" style={{ color: 'var(--danger)' }} onClick={() => { void onArchive() }}>
                Arquivar
              </button>
            )}
            <button
              className="btn btn-accent"
              style={{ flex: 1, justifyContent: 'center' }}
              onClick={() => { void handleSave() }}
              disabled={saving || !label.trim()}
            >
              {saving ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function ReorderArrows({
  canUp, canDown, onUp, onDown,
}: {
  canUp: boolean; canDown: boolean
  onUp: (e: React.MouseEvent) => void
  onDown: (e: React.MouseEvent) => void
}) {
  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column' }}>
      <button
        type="button" onClick={onUp} disabled={!canUp}
        style={{
          background: 'transparent', border: 'none',
          cursor: canUp ? 'pointer' : 'default',
          padding: '0 4px', lineHeight: 1,
          color: canUp ? 'var(--fg-muted)' : 'var(--fg-dim)',
          fontSize: '10px',
        }}
        title="Subir"
      >▲</button>
      <button
        type="button" onClick={onDown} disabled={!canDown}
        style={{
          background: 'transparent', border: 'none',
          cursor: canDown ? 'pointer' : 'default',
          padding: '0 4px', lineHeight: 1,
          color: canDown ? 'var(--fg-muted)' : 'var(--fg-dim)',
          fontSize: '10px',
        }}
        title="Descer"
      >▼</button>
    </div>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return <label className="task-panel-notes-label" style={{ display: 'block', marginTop: 0 }}>{children}</label>
}

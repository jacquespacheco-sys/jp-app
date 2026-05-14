import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useCategoryDimensions } from '../../hooks/useCategoryDimensions.ts'
import { useCategories } from '../../hooks/useCategories.ts'
import { useContacts } from '../../hooks/useContacts.ts'
import { CategoryChip } from '../shared/CategoryChip.tsx'
import type { Category, CategoryDimension } from '../../types/domain.ts'

interface Props {
  contactId: string
  initialCategoryIds: string[]
}

export function ContactPanelCategoriesTab({ contactId, initialCategoryIds }: Props) {
  const { dimensions, loading: loadingDim } = useCategoryDimensions()
  const { categories, loading: loadingCat, byDimension } = useCategories()
  const { setContactCategories } = useContacts()
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(initialCategoryIds))
  const [saving, setSaving] = useState<string | null>(null)

  useEffect(() => {
    setSelectedIds(new Set(initialCategoryIds))
  }, [initialCategoryIds.join(',')])

  const selectedById = useMemo(() => {
    const map = new Map<string, Category>()
    for (const c of categories) if (selectedIds.has(c.id)) map.set(c.id, c)
    return map
  }, [categories, selectedIds])

  const commit = async (nextIds: Set<string>, signature: string) => {
    setSaving(signature)
    try {
      await setContactCategories(contactId, [...nextIds])
      setSelectedIds(nextIds)
    } finally {
      setSaving(null)
    }
  }

  const toggle = (categoryId: string) => {
    const next = new Set(selectedIds)
    if (next.has(categoryId)) next.delete(categoryId)
    else next.add(categoryId)
    void commit(next, categoryId)
  }

  const remove = (categoryId: string) => {
    const next = new Set(selectedIds)
    next.delete(categoryId)
    void commit(next, categoryId)
  }

  if (loadingDim || loadingCat) {
    return <div style={{ fontSize: '11px', color: 'var(--fg-dim)' }}>Carregando…</div>
  }

  if (dimensions.length === 0) {
    return (
      <div>
        <div style={{ fontSize: '12px', color: 'var(--fg-dim)', marginBottom: '12px' }}>
          Nenhuma dimensão criada ainda.
        </div>
        <Link to="/config?tab=categories" style={{ fontSize: '10px', color: 'var(--accent)' }}>
          Gerenciar categorias →
        </Link>
      </div>
    )
  }

  return (
    <div>
      {dimensions.map(dim => (
        <DimensionSection
          key={dim.id}
          dim={dim}
          available={byDimension(dim.id)}
          selectedById={selectedById}
          saving={saving}
          onToggle={toggle}
          onRemove={remove}
        />
      ))}
      <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid var(--border-light)' }}>
        <Link to="/config?tab=categories" style={{ fontSize: '10px', color: 'var(--accent)', fontFamily: 'Space Mono, monospace', letterSpacing: '1px', textTransform: 'uppercase' }}>
          Gerenciar categorias →
        </Link>
      </div>
    </div>
  )
}

function DimensionSection({
  dim, available, selectedById, saving, onToggle, onRemove,
}: {
  dim: CategoryDimension
  available: Category[]
  selectedById: Map<string, Category>
  saving: string | null
  onToggle: (id: string) => void
  onRemove: (id: string) => void
}) {
  const [picking, setPicking] = useState(false)
  const selected = available.filter(c => selectedById.has(c.id))
  const unselected = available.filter(c => !selectedById.has(c.id))

  return (
    <div style={{ marginBottom: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <span style={{ fontFamily: 'Space Mono, monospace', fontSize: '10px', color: 'var(--fg-muted)', letterSpacing: '1.5px', textTransform: 'uppercase' }}>
          {dim.label}
        </span>
        <button
          className="btn btn-ghost"
          style={{ fontSize: '9px', padding: '4px 8px' }}
          onClick={() => setPicking(v => !v)}
          disabled={unselected.length === 0}
          title={unselected.length === 0 ? 'Nada a adicionar' : 'Adicionar categoria'}
        >
          {picking ? 'Fechar' : '+ Adicionar'}
        </button>
      </div>

      {selected.length === 0 ? (
        <div style={{ fontSize: '11px', color: 'var(--fg-dim)', fontFamily: 'Space Mono, monospace', letterSpacing: '1px' }}>
          Nenhuma
        </div>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {selected.map(c => (
            <CategoryChip
              key={c.id}
              category={c}
              size="md"
              onRemove={() => onRemove(c.id)}
            />
          ))}
        </div>
      )}

      {picking && unselected.length > 0 && (
        <div style={{ marginTop: '10px', padding: '10px', border: '1px solid var(--border)', background: 'var(--bg-elevated)' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {unselected.map(c => (
              <button
                key={c.id}
                onClick={() => onToggle(c.id)}
                disabled={saving === c.id}
                style={{
                  background: 'transparent', border: 'none', padding: 0, cursor: 'pointer',
                  opacity: saving === c.id ? 0.5 : 1,
                }}
              >
                <CategoryChip category={c} size="md" clickable />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

import { useState, useEffect, useMemo, useRef } from 'react'
import { useCategoryDimensions } from '../../hooks/useCategoryDimensions.ts'
import { useCategories } from '../../hooks/useCategories.ts'
import { CategoryChip } from './CategoryChip.tsx'
import type { ContactFilter, ContactTier, Category } from '../../types/domain.ts'

interface Props {
  storageKey: string
  value: ContactFilter
  onChange: (filter: ContactFilter) => void
  showTier?: boolean
  showPhase?: boolean
  showCategories?: boolean
  showPromises?: boolean
}

const TIERS: ContactTier[] = ['inner', 'strong', 'network', 'weak', 'dormant']
const PHASES = [
  { v: 'prospect', l: 'Prospect' }, { v: 'first', l: '1º Contato' },
  { v: 'talking', l: 'Conversando' }, { v: 'proposal', l: 'Proposta' },
  { v: 'active', l: 'Ativo' }, { v: 'dormant', l: 'Adormecido' },
]

export function persistedFilter(storageKey: string): ContactFilter {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(storageKey)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as ContactFilter
    return parsed ?? {}
  } catch {
    return {}
  }
}

export function FilterBar({
  storageKey, value, onChange,
  showTier = true, showPhase = true, showCategories = true, showPromises = false,
}: Props) {
  const { dimensions } = useCategoryDimensions()
  const { categories } = useCategories()
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    try { window.localStorage.setItem(storageKey, JSON.stringify(value)) }
    catch { /* ignore quota */ }
  }, [storageKey, value])

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('mousedown', handler)
    return () => window.removeEventListener('mousedown', handler)
  }, [open])

  const catsById = useMemo(() => new Map(categories.map(c => [c.id, c])), [categories])

  const tierSet = new Set(value.tier ?? [])
  const phaseSet = new Set(value.phase ?? [])
  const catSet = new Set(value.categoryIds ?? [])

  const toggleTier = (t: ContactTier) => {
    const next = new Set(tierSet)
    if (next.has(t)) next.delete(t); else next.add(t)
    onChange({ ...value, tier: next.size > 0 ? [...next] : undefined as never } as ContactFilter)
  }
  const togglePhase = (p: string) => {
    const next = new Set(phaseSet)
    if (next.has(p)) next.delete(p); else next.add(p)
    onChange({ ...value, phase: next.size > 0 ? [...next] : undefined as never } as ContactFilter)
  }
  const toggleCategory = (id: string) => {
    const next = new Set(catSet)
    if (next.has(id)) next.delete(id); else next.add(id)
    onChange({ ...value, categoryIds: next.size > 0 ? [...next] : undefined as never } as ContactFilter)
  }
  const togglePromises = () => {
    onChange({ ...value, hasPromisesOverdue: !value.hasPromisesOverdue })
  }
  const clear = () => onChange({})

  const activeCount =
    (value.tier?.length ?? 0) +
    (value.phase?.length ?? 0) +
    (value.categoryIds?.length ?? 0) +
    (value.hasPromisesOverdue ? 1 : 0)

  const activeChips = (
    <>
      {value.tier?.map(t => (
        <Chip key={`tier-${t}`} label={`tier · ${t}`} onRemove={() => toggleTier(t)} />
      ))}
      {value.phase?.map(p => (
        <Chip key={`phase-${p}`} label={`fase · ${PHASES.find(x => x.v === p)?.l ?? p}`} onRemove={() => togglePhase(p)} />
      ))}
      {value.categoryIds?.map(id => {
        const c = catsById.get(id)
        if (!c) return null
        return (
          <CategoryChip key={`cat-${id}`} category={c} size="sm" onRemove={() => toggleCategory(id)} />
        )
      })}
      {value.hasPromisesOverdue && (
        <Chip label="promessas atrasadas" onRemove={togglePromises} />
      )}
    </>
  )

  return (
    <div ref={wrapRef} style={{
      padding: '10px 16px',
      borderBottom: '1px solid var(--border)',
      background: 'var(--bg)',
      position: 'relative',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        {activeChips}
        <button
          className="btn btn-ghost"
          style={{ fontSize: '9px', padding: '4px 10px' }}
          onClick={() => setOpen(v => !v)}
        >
          {activeCount > 0 ? `+ Filtro (${activeCount})` : '+ Filtro'}
        </button>
        {activeCount > 0 && (
          <button
            className="btn btn-ghost"
            style={{ fontSize: '9px', padding: '4px 10px', color: 'var(--danger)' }}
            onClick={clear}
          >
            Limpar
          </button>
        )}
      </div>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% - 1px)', right: '16px', zIndex: 30,
          background: 'var(--bg-elevated)', border: '1px solid var(--border)',
          padding: '14px', minWidth: '280px', maxWidth: '380px',
          maxHeight: '60vh', overflowY: 'auto',
          boxShadow: 'var(--shadow)',
        }}>
          {showTier && (
            <FilterSection title="Tier">
              {TIERS.map(t => (
                <OptionRow key={t} checked={tierSet.has(t)} onToggle={() => toggleTier(t)}>
                  {t}
                </OptionRow>
              ))}
            </FilterSection>
          )}

          {showPhase && (
            <FilterSection title="Fase">
              {PHASES.map(p => (
                <OptionRow key={p.v} checked={phaseSet.has(p.v)} onToggle={() => togglePhase(p.v)}>
                  {p.l}
                </OptionRow>
              ))}
            </FilterSection>
          )}

          {showCategories && dimensions.map(dim => {
            const opts = categories.filter(c => c.dimensionId === dim.id)
            if (opts.length === 0) return null
            return (
              <FilterSection key={dim.id} title={dim.label}>
                {opts.map((c: Category) => (
                  <OptionRow key={c.id} checked={catSet.has(c.id)} onToggle={() => toggleCategory(c.id)}>
                    <CategoryChip category={c} size="sm" />
                  </OptionRow>
                ))}
              </FilterSection>
            )
          })}

          {showPromises && (
            <FilterSection title="Outros">
              <OptionRow checked={!!value.hasPromisesOverdue} onToggle={togglePromises}>
                Promessas atrasadas
              </OptionRow>
            </FilterSection>
          )}
        </div>
      )}
    </div>
  )
}

function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '4px',
      padding: '3px 8px', fontSize: '10px',
      fontFamily: 'var(--font-mono)', letterSpacing: '1px', textTransform: 'uppercase',
      background: 'var(--bg-elevated)', color: 'var(--fg-muted)',
      border: '1px solid var(--border)',
    }}>
      {label}
      <button
        onClick={onRemove}
        style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0, fontSize: 'inherit', opacity: 0.6 }}
        title="Remover"
      >
        ×
      </button>
    </span>
  )
}

function FilterSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '12px' }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--fg-muted)', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '6px' }}>
        {title}
      </div>
      <div style={{ display: 'grid', gap: '4px' }}>{children}</div>
    </div>
  )
}

function OptionRow({ checked, onToggle, children }: { checked: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <label style={{
      display: 'flex', alignItems: 'center', gap: '8px',
      fontSize: '12px', color: 'var(--fg)',
      cursor: 'pointer', padding: '3px 0',
    }}>
      <input type="checkbox" checked={checked} onChange={onToggle} />
      {children}
    </label>
  )
}

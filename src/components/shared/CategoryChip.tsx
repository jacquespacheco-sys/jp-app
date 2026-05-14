import type { Category, CategoryColor } from '../../types/domain.ts'

interface Props {
  category: Category
  onRemove?: () => void
  size?: 'sm' | 'md'
  clickable?: boolean
  onClick?: () => void
}

function chipStyle(color: CategoryColor | undefined, size: 'sm' | 'md'): React.CSSProperties {
  const bg = color ? `var(--chip-${color}-bg)` : 'var(--bg-elevated)'
  const fg = color ? `var(--chip-${color}-fg)` : 'var(--fg-muted)'
  const padding = size === 'sm' ? '2px 6px' : '4px 9px'
  const fontSize = size === 'sm' ? '9px' : '10px'
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding,
    fontSize,
    fontFamily: 'Space Mono, monospace',
    letterSpacing: '1px',
    textTransform: 'uppercase',
    background: bg,
    color: fg,
    border: color ? '1px solid transparent' : '1px solid var(--border)',
    borderRadius: '2px',
    whiteSpace: 'nowrap',
  }
}

export function CategoryChip({ category, onRemove, size = 'sm', clickable, onClick }: Props) {
  const style = chipStyle(category.color, size)
  const cursor = onClick || clickable ? 'pointer' : 'default'

  return (
    <span style={{ ...style, cursor }} onClick={onClick} title={category.dimensionLabel ?? category.label}>
      {category.label}
      {onRemove && (
        <button
          onClick={e => { e.stopPropagation(); onRemove() }}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'inherit',
            cursor: 'pointer',
            padding: 0,
            fontSize: 'inherit',
            opacity: 0.6,
            lineHeight: 1,
          }}
          title="Remover"
        >
          ×
        </button>
      )}
    </span>
  )
}

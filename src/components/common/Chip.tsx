import { useState, useRef, useEffect, type ReactNode, type CSSProperties } from 'react'

interface ChipProps {
  label: string
  icon?: ReactNode
  active?: boolean
  variant?: 'default' | 'accent' | 'ai'
  ariaLabel?: string
  // se popover for fornecido, click no chip abre popover
  popover?: (close: () => void) => ReactNode
  // se onClick for fornecido (e popover não), chip vira botão de ação direta
  onClick?: () => void
  style?: CSSProperties
}

export function Chip({ label, icon, active, variant = 'default', ariaLabel, popover, onClick, style }: ChipProps) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const handleClick = () => {
    if (popover) setOpen(o => !o)
    else onClick?.()
  }

  const className = [
    'chip',
    active ? 'chip-active' : '',
    variant === 'accent' ? 'chip-accent' : '',
    variant === 'ai' ? 'chip-ai' : '',
    open ? 'chip-open' : '',
  ].filter(Boolean).join(' ')

  return (
    <span ref={wrapRef} className="chip-wrap" style={style}>
      <button
        type="button"
        className={className}
        onClick={handleClick}
        aria-label={ariaLabel ?? label}
        aria-expanded={popover ? open : undefined}
      >
        {icon && <span className="chip-icon">{icon}</span>}
        <span className="chip-label">{label}</span>
      </button>
      {popover && open && (
        <div className="chip-popover" role="dialog">
          <div className="chip-popover-inner">
            {popover(() => setOpen(false))}
          </div>
        </div>
      )}
    </span>
  )
}

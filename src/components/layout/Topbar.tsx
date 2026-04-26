import type { ReactNode } from 'react'

interface TopbarProps {
  title: string
  actions?: ReactNode
}

export function Topbar({ title, actions }: TopbarProps) {
  return (
    <header className="topbar">
      <div className="topbar-left">
        <span className="logo-mark">
          JP<span className="dot" />
        </span>
        <span className="page-title">{title}</span>
      </div>
      {actions && <div className="topbar-actions">{actions}</div>}
    </header>
  )
}

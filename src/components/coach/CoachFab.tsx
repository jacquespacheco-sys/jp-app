import { useState } from 'react'
import { CoachSheet } from './CoachSheet.tsx'
import { useCoach } from '../../hooks/useCoach.ts'

interface Props {
  onOpenProfile?: () => void
}

export function CoachFab({ onOpenProfile }: Props) {
  const { unread } = useCoach()
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        aria-label="abrir coach"
        onClick={() => setOpen(true)}
        style={{
          position: 'fixed',
          bottom: '88px',
          right: '16px',
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          border: 'none',
          background: 'var(--accent)',
          color: 'var(--bg)',
          boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
          cursor: 'pointer',
          zIndex: 100,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        {unread > 0 && (
          <span style={{
            position: 'absolute',
            top: '-2px',
            right: '-2px',
            minWidth: '20px',
            height: '20px',
            padding: '0 6px',
            borderRadius: '10px',
            background: '#ef4444',
            color: '#fff',
            fontSize: '11px',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '2px solid var(--bg)',
          }}>{unread > 99 ? '99+' : unread}</span>
        )}
      </button>
      <CoachSheet
        open={open}
        onClose={() => setOpen(false)}
        {...(onOpenProfile !== undefined ? { onOpenProfile } : {})}
      />
    </>
  )
}

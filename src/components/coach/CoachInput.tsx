import { useState, useRef, type KeyboardEvent } from 'react'

export function CoachInput({ onSend, disabled }: {
  onSend: (content: string) => void
  disabled?: boolean
}) {
  const [value, setValue] = useState('')
  const taRef = useRef<HTMLTextAreaElement>(null)

  const submit = () => {
    const v = value.trim()
    if (!v || disabled) return
    onSend(v)
    setValue('')
    if (taRef.current) taRef.current.style.height = 'auto'
  }

  const handleKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  const handleInput = () => {
    if (!taRef.current) return
    taRef.current.style.height = 'auto'
    taRef.current.style.height = Math.min(taRef.current.scrollHeight, 200) + 'px'
  }

  return (
    <div style={{
      display: 'flex',
      gap: '8px',
      alignItems: 'flex-end',
      padding: '12px',
      borderTop: '1px solid var(--border-light)',
      background: 'var(--bg-elevated)',
    }}>
      <textarea
        ref={taRef}
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={handleKey}
        onInput={handleInput}
        placeholder="fala aí…"
        disabled={disabled}
        rows={1}
        style={{
          flex: 1,
          resize: 'none',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          padding: '10px 12px',
          fontSize: '14px',
          fontFamily: 'inherit',
          background: 'var(--bg)',
          color: 'var(--fg)',
          minHeight: '40px',
          maxHeight: '200px',
          outline: 'none',
        }}
      />
      <button
        type="button"
        onClick={submit}
        disabled={disabled || !value.trim()}
        aria-label="enviar"
        style={{
          width: '40px',
          height: '40px',
          borderRadius: '50%',
          border: 'none',
          background: value.trim() && !disabled ? 'var(--accent)' : 'var(--border)',
          color: 'var(--bg)',
          cursor: value.trim() && !disabled ? 'pointer' : 'default',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      </button>
    </div>
  )
}

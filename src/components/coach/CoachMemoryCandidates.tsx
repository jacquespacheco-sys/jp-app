import { useState } from 'react'
import type { CoachMemoryCandidate, MemoryKind } from '../../types/domain.ts'
import { COACH_KIND_LABEL } from '../../lib/coach.ts'

export function CoachMemoryCandidates({ candidates, onAccept, onDismiss }: {
  candidates: CoachMemoryCandidate[]
  onAccept: (input: { candidateId: string; content?: string; kind?: MemoryKind; relevance?: number }) => Promise<void>
  onDismiss: (id: string) => Promise<void>
}) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')

  if (candidates.length === 0) return null

  return (
    <div style={{
      borderBottom: '1px solid var(--border-light)',
      padding: '12px',
      background: 'var(--bg-secondary)',
    }}>
      <div style={{
        fontFamily: 'var(--font-mono)',
        fontSize: '9px',
        letterSpacing: '2px',
        color: 'var(--fg-dim)',
        textTransform: 'uppercase',
        marginBottom: '10px',
      }}>
        coach propõe lembrar
      </div>
      {candidates.map(c => (
        <div key={c.id} style={{
          padding: '10px 0',
          borderBottom: '1px solid var(--border-light)',
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            marginBottom: '4px',
          }}>
            <span style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '9px',
              color: 'var(--accent)',
              textTransform: 'uppercase',
              letterSpacing: '1px',
            }}>
              {COACH_KIND_LABEL[c.kind]} · {c.relevance}
            </span>
          </div>
          {editingId === c.id ? (
            <textarea
              value={editText}
              onChange={e => setEditText(e.target.value)}
              rows={2}
              style={{
                width: '100%',
                fontSize: '13px',
                padding: '6px 8px',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                background: 'var(--bg)',
                color: 'var(--fg)',
                resize: 'vertical',
              }}
            />
          ) : (
            <div style={{ fontSize: '13px', color: 'var(--fg)', marginBottom: '8px' }}>
              {c.content}
            </div>
          )}
          <div style={{ display: 'flex', gap: '8px', marginTop: editingId === c.id ? '8px' : 0 }}>
            <button
              type="button"
              onClick={async () => {
                const input = editingId === c.id
                  ? { candidateId: c.id, content: editText }
                  : { candidateId: c.id }
                await onAccept(input)
                setEditingId(null)
              }}
              style={{
                padding: '4px 10px',
                fontSize: '11px',
                border: 'none',
                borderRadius: '4px',
                background: 'var(--accent)',
                color: 'var(--bg)',
                cursor: 'pointer',
              }}
            >
              aceitar
            </button>
            <button
              type="button"
              onClick={() => {
                if (editingId === c.id) {
                  setEditingId(null)
                } else {
                  setEditingId(c.id)
                  setEditText(c.content)
                }
              }}
              style={{
                padding: '4px 10px',
                fontSize: '11px',
                border: '1px solid var(--border)',
                borderRadius: '4px',
                background: 'transparent',
                color: 'var(--fg-dim)',
                cursor: 'pointer',
              }}
            >
              {editingId === c.id ? 'cancelar' : 'editar'}
            </button>
            <button
              type="button"
              onClick={() => { void onDismiss(c.id) }}
              style={{
                padding: '4px 10px',
                fontSize: '11px',
                border: '1px solid var(--border)',
                borderRadius: '4px',
                background: 'transparent',
                color: 'var(--fg-dim)',
                cursor: 'pointer',
              }}
            >
              descartar
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

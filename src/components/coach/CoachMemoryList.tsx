import { useCoach } from '../../hooks/useCoach.ts'
import { COACH_KIND_LABEL } from '../../lib/coach.ts'

export function CoachMemoryList() {
  const { memories, archiveMemory } = useCoach()

  if (memories.length === 0) {
    return <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--fg-dim)', fontSize: '13px' }}>nenhuma memória salva.</div>
  }

  return (
    <div>
      {memories.map(m => (
        <div key={m.id} style={{
          padding: '12px 0',
          borderBottom: '1px solid var(--border-light)',
          display: 'flex',
          gap: '12px',
          alignItems: 'flex-start',
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'baseline', marginBottom: '4px' }}>
              <span style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '9px',
                color: 'var(--accent)',
                textTransform: 'uppercase',
                letterSpacing: '1px',
              }}>{COACH_KIND_LABEL[m.kind]}</span>
              <span style={{ fontSize: '10px', color: 'var(--fg-dim)' }}>relevance {m.relevance}</span>
            </div>
            <div style={{ fontSize: '13px', color: 'var(--fg)' }}>{m.content}</div>
          </div>
          <button type="button" onClick={() => { void archiveMemory(m.id) }} title="arquivar"
            style={{ background: 'none', border: 'none', color: 'var(--fg-dim)', fontSize: '16px', padding: '4px', cursor: 'pointer', flexShrink: 0 }}>×</button>
        </div>
      ))}
    </div>
  )
}

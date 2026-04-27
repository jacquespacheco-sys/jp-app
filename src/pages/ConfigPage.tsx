import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Topbar } from '../components/layout/Topbar.tsx'
import { ThemeToggle } from '../components/common/ThemeToggle.tsx'
import { useAuth } from '../hooks/useAuth.ts'
import { useCalendars } from '../hooks/useCalendars.ts'
import { useSources } from '../hooks/useSources.ts'
import { api } from '../api.ts'
import type { Source } from '../types/domain.ts'

function SourceRow({ source, onToggle, onDelete }: {
  source: Source
  onToggle: () => void
  onDelete: () => void
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 0', borderBottom: '1px solid var(--border-light)' }}>
      <button
        type="button"
        onClick={onToggle}
        title={source.active ? 'Desativar' : 'Ativar'}
        style={{
          width: '32px', height: '18px', borderRadius: '9px', border: 'none', cursor: 'pointer', flexShrink: 0,
          background: source.active ? 'var(--accent)' : 'var(--border)',
          position: 'relative', transition: 'background 0.15s',
        }}
      >
        <span style={{
          position: 'absolute', top: '3px',
          left: source.active ? '16px' : '3px',
          width: '12px', height: '12px', borderRadius: '50%',
          background: source.active ? 'var(--bg)' : 'var(--fg-muted)',
          transition: 'left 0.15s',
        }} />
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '2px' }}>{source.name}</div>
        <div style={{ fontSize: '10px', fontFamily: 'Space Mono, monospace', color: 'var(--fg-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {source.url}
        </div>
      </div>
      <button
        type="button"
        onClick={onDelete}
        title="Remover"
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-dim)', fontSize: '16px', padding: '4px', flexShrink: 0, lineHeight: 1 }}
      >
        ×
      </button>
    </div>
  )
}

function AddSourceForm({ onAdd }: { onAdd: (name: string, url: string) => Promise<void> }) {
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const nameRef = useRef<HTMLInputElement>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !url.trim()) return
    setSaving(true)
    setError('')
    try {
      await onAdd(name.trim(), url.trim())
      setName('')
      setUrl('')
      nameRef.current?.focus()
    } catch {
      setError('Erro ao salvar fonte')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={e => { void handleSubmit(e) }} style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <input
        ref={nameRef}
        type="text"
        placeholder="Nome (ex: MIT Technology Review)"
        value={name}
        onChange={e => setName(e.target.value)}
        style={{
          width: '100%', padding: '10px 12px', fontSize: '13px', boxSizing: 'border-box',
          background: 'var(--bg-subtle)', border: '1px solid var(--border)', color: 'var(--fg)',
          fontFamily: 'inherit', outline: 'none',
        }}
      />
      <input
        type="url"
        placeholder="URL do feed RSS"
        value={url}
        onChange={e => setUrl(e.target.value)}
        style={{
          width: '100%', padding: '10px 12px', fontSize: '13px', boxSizing: 'border-box',
          background: 'var(--bg-subtle)', border: '1px solid var(--border)', color: 'var(--fg)',
          fontFamily: 'inherit', outline: 'none',
        }}
      />
      {error && (
        <div style={{ fontSize: '11px', fontFamily: 'Space Mono, monospace', color: 'var(--danger)', letterSpacing: '0.5px' }}>
          {error}
        </div>
      )}
      <button
        type="submit"
        disabled={saving || !name.trim() || !url.trim()}
        className="btn btn-accent"
        style={{ alignSelf: 'flex-start', fontSize: '11px' }}
      >
        {saving ? 'Salvando…' : 'Adicionar'}
      </button>
    </form>
  )
}

export function ConfigPage() {
  const { user, logout } = useAuth()
  const { googleConnected, sync: syncCalendars } = useCalendars()
  const { sources, loading: sourcesLoading, addSource, toggleSource, deleteSource } = useSources()
  const [searchParams, setSearchParams] = useSearchParams()
  const [connectMsg, setConnectMsg] = useState('')
  const [syncing, setSyncing] = useState(false)
  const [showAddSource, setShowAddSource] = useState(false)

  useEffect(() => {
    const connected = searchParams.get('connected')
    const error = searchParams.get('error')
    if (connected === 'google') {
      setConnectMsg('Google conectado com sucesso!')
      setSearchParams({})
    } else if (error === 'google') {
      setConnectMsg('Erro ao conectar Google. Tente novamente.')
      setSearchParams({})
    }
  }, [searchParams, setSearchParams])

  const handleConnectGoogle = async () => {
    const res = await api.get<{ url: string }>('/api/google-oauth?action=url')
    window.location.href = res.url
  }

  const handleSyncGoogle = async () => {
    setSyncing(true)
    try {
      await syncCalendars()
      await api.post('/api/events-sync')
      setConnectMsg('Google sincronizado!')
    } finally {
      setSyncing(false)
    }
  }

  const handleAddSource = async (name: string, url: string) => {
    await addSource(name, url)
    setShowAddSource(false)
  }

  return (
    <div>
      <Topbar title="Config" actions={<ThemeToggle />} />
      <div className="content">

        <div className="section">
          <div className="section-title">Conta</div>
          {user && (
            <div style={{ marginBottom: '24px' }}>
              <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '4px' }}>{user.name}</div>
              <div style={{ fontSize: '12px', color: 'var(--fg-muted)' }}>{user.email}</div>
            </div>
          )}
          <button type="button" className="btn btn-ghost" onClick={() => { void logout() }} style={{ borderColor: 'var(--border)' }}>
            Sair
          </button>
        </div>

        <div className="section">
          <div className="section-title">Integrações</div>

          {connectMsg && (
            <div style={{ fontSize: '11px', fontFamily: 'Space Mono, monospace', padding: '10px 12px', border: '1px solid var(--border)', marginBottom: '16px', color: connectMsg.includes('Erro') ? 'var(--danger)' : 'var(--accent)', letterSpacing: '1px' }}>
              {connectMsg}
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0', borderBottom: '1px solid var(--border-light)' }}>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '3px' }}>Google Calendar</div>
              <div style={{ fontSize: '11px', color: 'var(--fg-muted)', fontFamily: 'Space Mono, monospace', letterSpacing: '0.5px' }}>
                {googleConnected ? 'Conectado' : 'Não conectado'}
              </div>
            </div>
            {googleConnected ? (
              <button className="btn btn-ghost" onClick={() => { void handleSyncGoogle() }} disabled={syncing} style={{ fontSize: '10px' }}>
                {syncing ? 'Sync…' : 'Sincronizar'}
              </button>
            ) : (
              <button className="btn btn-accent" onClick={() => { void handleConnectGoogle() }} style={{ fontSize: '10px' }}>
                Conectar
              </button>
            )}
          </div>
        </div>

        <div className="section">
          <div className="section-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>Fontes RSS</span>
            <button
              type="button"
              onClick={() => setShowAddSource(v => !v)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', color: 'var(--fg-muted)', lineHeight: 1, padding: '0 2px' }}
            >
              {showAddSource ? '×' : '+'}
            </button>
          </div>

          {showAddSource && (
            <AddSourceForm onAdd={handleAddSource} />
          )}

          {sourcesLoading && (
            <div style={{ fontSize: '12px', color: 'var(--fg-dim)', padding: '12px 0' }}>Carregando…</div>
          )}

          {!sourcesLoading && sources.length === 0 && !showAddSource && (
            <div className="empty-state" style={{ padding: '16px 0', textAlign: 'left', fontSize: '12px' }}>
              Nenhuma fonte cadastrada
            </div>
          )}

          {sources.map(s => (
            <SourceRow
              key={s.id}
              source={s}
              onToggle={() => { void toggleSource(s) }}
              onDelete={() => { void deleteSource(s.id) }}
            />
          ))}
        </div>

        <div className="section">
          <div className="section-title">Newsletters</div>
          <div style={{ fontSize: '12px', color: 'var(--fg-dim)', fontFamily: 'Space Mono, monospace', letterSpacing: '0.5px', padding: '4px 0' }}>
            Leitura via IMAP — em breve
          </div>
        </div>

      </div>
    </div>
  )
}

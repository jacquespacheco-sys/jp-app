import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Topbar } from '../components/layout/Topbar.tsx'
import { ThemeToggle } from '../components/common/ThemeToggle.tsx'
import { useAuth } from '../hooks/useAuth.ts'
import { useCalendars } from '../hooks/useCalendars.ts'
import { api } from '../api.ts'

export function ConfigPage() {
  const { user, logout } = useAuth()
  const { googleConnected, sync: syncCalendars } = useCalendars()
  const [searchParams, setSearchParams] = useSearchParams()
  const [connectMsg, setConnectMsg] = useState('')
  const [syncing, setSyncing] = useState(false)

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
          <div className="section-title">Fontes do Briefing</div>
          <div className="empty-state" style={{ padding: '20px 0', textAlign: 'left' }}>
            RSS e newsletters — disponível em breve
          </div>
        </div>

      </div>
    </div>
  )
}

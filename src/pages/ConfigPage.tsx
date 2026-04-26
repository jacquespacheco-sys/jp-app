import { Topbar } from '../components/layout/Topbar.tsx'
import { ThemeToggle } from '../components/common/ThemeToggle.tsx'
import { useAuth } from '../hooks/useAuth.ts'

export function ConfigPage() {
  const { user, logout } = useAuth()

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
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => { void logout() }}
            style={{ borderColor: 'var(--border)' }}
          >
            Sair
          </button>
        </div>
        <div className="section">
          <div className="section-title">Integrações</div>
          <div className="empty-state" style={{ padding: '20px 0', textAlign: 'left' }}>
            Google Calendar, Tasks e Contacts — disponível em breve
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

interface SyncStatusProps {
  status: 'idle' | 'syncing' | 'error'
  lastSync?: string
  onClick?: () => void
}

const LABELS = {
  idle: 'Sincronizado',
  syncing: 'Sincronizando…',
  error: 'Erro no sync',
} as const

export function SyncStatus({ status, onClick }: SyncStatusProps) {
  return (
    <button type="button" className="sync-status" onClick={onClick} title="Status da sincronização">
      {LABELS[status]}
    </button>
  )
}

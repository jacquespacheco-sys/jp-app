import { Component } from 'react'
import type { ReactNode, ErrorInfo } from 'react'

interface Props { children: ReactNode; fallback?: ReactNode }
interface State { error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error.message, info.componentStack)
  }

  override render() {
    if (this.state.error) {
      return this.props.fallback ?? (
        <div style={{ padding: '48px 24px', textAlign: 'center' }}>
          <div style={{ fontFamily: 'Space Mono, monospace', fontSize: '9px', letterSpacing: '2px', color: 'var(--fg-dim)', marginBottom: '16px', textTransform: 'uppercase' }}>
            Algo deu errado
          </div>
          <div style={{ fontSize: '13px', color: 'var(--fg-muted)', marginBottom: '24px', maxWidth: '320px', margin: '0 auto 24px' }}>
            {this.state.error.message}
          </div>
          <button className="btn btn-ghost" onClick={() => this.setState({ error: null })}>
            Tentar novamente
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

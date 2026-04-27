import { useState, useEffect, useCallback } from 'react'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Topbar } from '../components/layout/Topbar.tsx'
import { Subtabs } from '../components/layout/Subtabs.tsx'
import { ThemeToggle } from '../components/common/ThemeToggle.tsx'
import { api } from '../api.ts'
import type { Briefing, BriefingItem } from '../types/domain.ts'
import type { BriefingHistoryResponse, BriefingResponse } from '../types/api.ts'

const TABS = ['Hoje', 'Histórico'] as const
type Tab = typeof TABS[number]

function NewsCard({ item }: { item: BriefingItem }) {
  return (
    <div className="news-item">
      <div className="news-source">{item.source}</div>
      <h4>{item.title}</h4>
      {item.summary && <p>{item.summary}</p>}
    </div>
  )
}

function BriefingView({ briefing }: { briefing: Briefing }) {
  const content = briefing.content
  return (
    <div className="content">
      {/* Highlight */}
      <div className="highlight">
        <div className="highlight-label">Insight do dia</div>
        <div className="highlight-text">{briefing.highlight}</div>
      </div>

      {/* Agenda */}
      {Array.isArray(content.agenda) && content.agenda.length > 0 && (
        <div className="section">
          <div className="section-title">
            Agenda de hoje
            <span className="count">{content.agenda.length}</span>
          </div>
          {content.agenda.map((ev, i) => (
            <div key={i} className="agenda-item">
              <div className="agenda-time">
                {(ev as { all_day?: boolean }).all_day ? 'Dia todo'
                  : format(parseISO((ev as unknown as { start_at: string }).start_at), 'HH:mm')}
              </div>
              <div>
                <div className="agenda-title">{(ev as { summary: string }).summary}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tasks */}
      {Array.isArray(content.tasks) && content.tasks.length > 0 && (
        <div className="section">
          <div className="section-title">
            Tasks do dia
            <span className="count">{content.tasks.length}</span>
          </div>
          {content.tasks.map((t, i) => (
            <div key={i} style={{ padding: '8px 0', borderBottom: '1px solid var(--border-light)', fontSize: '13px' }}>
              {(t as { title: string }).title}
            </div>
          ))}
        </div>
      )}

      {/* Global news */}
      {content.global.length > 0 && (
        <div className="section">
          <div className="section-title">Mundial</div>
          {content.global.map((item, i) => <NewsCard key={i} item={item} />)}
        </div>
      )}

      {/* Brasil news */}
      {content.brasil.length > 0 && (
        <div className="section">
          <div className="section-title">Brasil</div>
          {content.brasil.map((item, i) => <NewsCard key={i} item={item} />)}
        </div>
      )}

      {/* Newsletters */}
      {content.newsletters.length > 0 && (
        <div className="section">
          <div className="section-title">Newsletters</div>
          {content.newsletters.map((item, i) => <NewsCard key={i} item={item} />)}
        </div>
      )}

      <div style={{ fontFamily: 'Space Mono, monospace', fontSize: '9px', color: 'var(--fg-dim)', letterSpacing: '1px', marginTop: '16px' }}>
        {format(parseISO(briefing.createdAt), "d 'de' MMMM 'às' HH:mm", { locale: ptBR })}
        {briefing.tokenCount && ` · ${briefing.tokenCount.toLocaleString()} tokens`}
      </div>
    </div>
  )
}

export function BriefingPage() {
  const [tab, setTab] = useState<Tab>('Hoje')
  const [todayBriefing, setTodayBriefing] = useState<Briefing | null>(null)
  const [history, setHistory] = useState<Briefing[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')

  const loadHistory = useCallback(async () => {
    try {
      const res = await api.get<BriefingHistoryResponse>('/api/briefing-history')
      setHistory(res.briefings)
      const today = new Date().toISOString().slice(0, 10)
      const todayEntry = res.briefings.find(b => b.date === today) ?? null
      setTodayBriefing(todayEntry)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void loadHistory() }, [loadHistory])

  const handleGenerate = async () => {
    setGenerating(true)
    setError('')
    try {
      const res = await api.post<BriefingResponse>('/api/briefing-generate')
      setTodayBriefing(res.briefing)
      setHistory(h => [res.briefing, ...h])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao gerar briefing')
    } finally {
      setGenerating(false)
    }
  }

  const actions = <ThemeToggle />

  return (
    <div>
      <Topbar title="Briefing" actions={actions} />
      <Subtabs tabs={[...TABS]} active={tab} onChange={t => setTab(t as Tab)} />

      {tab === 'Hoje' && (
        <>
          {loading && <div className="empty-state">Carregando…</div>}

          {!loading && !todayBriefing && (
            <div className="content" style={{ textAlign: 'center' }}>
              <div className="empty-state" style={{ marginBottom: '24px' }}>
                Nenhum briefing gerado hoje
              </div>
              {error && (
                <div style={{ fontFamily: 'Space Mono, monospace', fontSize: '11px', color: 'var(--danger)', marginBottom: '16px', padding: '10px 12px', border: '1px solid var(--danger)' }}>
                  {error}
                </div>
              )}
              <button className="btn btn-accent" onClick={() => { void handleGenerate() }} disabled={generating}>
                {generating ? 'Gerando…' : 'Gerar briefing'}
              </button>
            </div>
          )}

          {!loading && todayBriefing && <BriefingView briefing={todayBriefing} />}
        </>
      )}

      {tab === 'Histórico' && (
        <div className="content">
          {history.length === 0 && (
            <div className="empty-state">Nenhum briefing anterior</div>
          )}
          {history.map(b => (
            <div key={b.id} style={{ padding: '14px 0', borderBottom: '1px solid var(--border-light)', cursor: 'pointer' }}
              onClick={() => { setTodayBriefing(b); setTab('Hoje') }}>
              <div style={{ fontFamily: 'Space Mono, monospace', fontSize: '10px', letterSpacing: '1.5px', color: 'var(--fg-muted)', marginBottom: '4px', textTransform: 'uppercase' }}>
                {format(parseISO(b.date), "EEEE, d 'de' MMMM", { locale: ptBR })}
              </div>
              <div style={{ fontSize: '13px', fontWeight: 500 }}>{b.highlight}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

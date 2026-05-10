import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Topbar } from '../components/layout/Topbar.tsx'
import { Subtabs } from '../components/layout/Subtabs.tsx'
import { ThemeToggle } from '../components/common/ThemeToggle.tsx'
import { useNews } from '../hooks/useNews.ts'
import { useSources } from '../hooks/useSources.ts'
import type { NewsItem } from '../types/domain.ts'

const TABS = ['Feed', 'Favoritos'] as const
type Tab = typeof TABS[number]

function NewsCard({ item, onFavorite, onRead }: { item: NewsItem; onFavorite: (item: NewsItem) => void; onRead: (id: string) => void }) {
  return (
    <div className={`news-card${item.read ? ' read' : ''}`}>
      {item.imageUrl && <img src={item.imageUrl} alt="" className="news-card-img" />}
      <div className="news-card-body">
        <div className="news-card-meta">
          <span className="news-card-date">{format(new Date(item.publishedAt), "d MMM", { locale: ptBR })}</span>
        </div>
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="news-card-title"
          onClick={() => onRead(item.id)}
        >
          {item.title}
        </a>
        {item.summary && <p className="news-card-summary">{item.summary.slice(0, 160)}{item.summary.length > 160 ? '…' : ''}</p>}
      </div>
      <div className="news-card-actions">
        <button
          className={`news-fav-btn${item.favorited ? ' active' : ''}`}
          onClick={() => onFavorite(item)}
          title={item.favorited ? 'Remover favorito' : 'Favoritar'}
        >
          {item.favorited ? '★' : '☆'}
        </button>
      </div>
    </div>
  )
}

export function NewsPage() {
  const [tab, setTab] = useState<Tab>('Feed')
  const { items, loading, fetching, load, fetchFeeds, toggleFavorite, markRead } = useNews()
  const { sources } = useSources()

  useEffect(() => {
    void load({ favorited: tab === 'Favoritos' })
  }, [tab, load])

  const actions = (
    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
      <button className="sync-status" onClick={() => void fetchFeeds()} disabled={fetching}>
        {fetching ? 'Buscando…' : 'Atualizar'}
      </button>
      <ThemeToggle />
    </div>
  )

  return (
    <div>
      <Topbar title="News" actions={actions} />
      <Subtabs tabs={[...TABS]} active={tab} onChange={t => setTab(t as Tab)} />

      {loading && <div className="empty-state">Carregando…</div>}

      {!loading && items.length === 0 && (
        <div className="empty-state" style={{ paddingTop: '20vh' }}>
          {sources.length === 0
            ? 'Configure fontes RSS em Config → Briefing para ver notícias aqui'
            : 'Nenhuma notícia. Clique em Atualizar para buscar.'}
        </div>
      )}

      {!loading && items.length > 0 && (
        <div className="content news-list">
          {items.map(item => (
            <NewsCard
              key={item.id}
              item={item}
              onFavorite={toggleFavorite}
              onRead={markRead}
            />
          ))}
        </div>
      )}
    </div>
  )
}

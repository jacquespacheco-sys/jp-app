import { useState, useEffect } from 'react'
import { Topbar } from '../components/layout/Topbar.tsx'
import { Subtabs } from '../components/layout/Subtabs.tsx'
import { ThemeToggle } from '../components/common/ThemeToggle.tsx'
import { NoteCard } from '../components/notes/NoteCard.tsx'
import { NotePanel } from '../components/notes/NotePanel.tsx'
import { TagManager } from '../components/notes/TagManager.tsx'
import { FolderTree } from '../components/notes/FolderTree.tsx'
import { useNotes } from '../hooks/useNotes.ts'
import { useNoteTags } from '../hooks/useNoteTags.ts'
import { useNoteFolders } from '../hooks/useNoteFolders.ts'
import type { Note, NoteType } from '../types/domain.ts'

const TABS = ['Home', 'Arquivos', 'Tags', 'Pastas'] as const
type Tab = typeof TABS[number]

const QUICK_ADD_ITEMS: { type: NoteType; label: string; icon: React.ReactNode }[] = [
  {
    type: 'postit',
    label: 'Post-it',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2"/>
        <path d="M15 3v12l-3-2-3 2V3"/>
      </svg>
    ),
  },
  {
    type: 'text',
    label: 'Texto',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="8" y1="13" x2="16" y2="13"/>
        <line x1="8" y1="17" x2="16" y2="17"/>
        <line x1="8" y1="9" x2="10" y2="9"/>
      </svg>
    ),
  },
  {
    type: 'audio',
    label: 'Áudio',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
        <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
        <line x1="12" y1="19" x2="12" y2="23"/>
        <line x1="8" y1="23" x2="16" y2="23"/>
      </svg>
    ),
  },
  {
    type: 'link',
    label: 'Link',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
      </svg>
    ),
  },
]

export function NotesPage() {
  const [tab, setTab] = useState<Tab>('Home')
  const [panelOpen, setPanelOpen] = useState(false)
  const [selectedNote, setSelectedNote] = useState<Note | null>(null)
  const [initialType, setInitialType] = useState<NoteType>('text')
  const [filterType, setFilterType] = useState<string>('')
  const [filterTag, setFilterTag] = useState<string>('')
  const [filterFolder, setFilterFolder] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const { notes, loading, fetch, save, remove, togglePin } = useNotes()
  const { tags, save: saveTag, remove: removeTag } = useNoteTags()
  const { folders, save: saveFolder, remove: removeFolder } = useNoteFolders()

  useEffect(() => {
    if (tab === 'Arquivos') {
      void fetch({
        ...(filterFolder ? { folder: filterFolder } : {}),
        ...(filterType ? { type: filterType } : {}),
        ...(filterTag ? { tag: filterTag } : {}),
        ...(search ? { search } : {}),
      })
    }
  }, [tab, filterFolder, filterType, filterTag, search, fetch])

  useEffect(() => {
    if (tab === 'Home') {
      void fetch({})
    }
  }, [tab, fetch])

  const openNew = (type: NoteType) => {
    setSelectedNote(null)
    setInitialType(type)
    setPanelOpen(true)
  }

  const openEdit = (note: Note) => {
    setSelectedNote(note)
    setPanelOpen(true)
  }

  const handleSave = async (input: Parameters<typeof save>[0]) => {
    const note = await save(input)
    void fetch({ ...(filterFolder ? { folder: filterFolder } : {}), ...(filterType ? { type: filterType } : {}), ...(filterTag ? { tag: filterTag } : {}) })
    return note
  }

  const handleDelete = async (id: string) => {
    await remove(id)
    void fetch({})
  }

  const recentNotes = notes.slice(0, 8)

  return (
    <div>
      <Topbar title="Notas" actions={<ThemeToggle />} />
      <Subtabs tabs={[...TABS]} active={tab} onChange={t => setTab(t as Tab)} />

      {tab === 'Home' && (
        <div className="notes-home">
          <div className="notes-quick-add">
            {QUICK_ADD_ITEMS.map(item => (
              <button key={item.type} className="notes-quick-btn" onClick={() => openNew(item.type)}>
                <span className="notes-quick-icon">{item.icon}</span>
                <span className="notes-quick-label">{item.label}</span>
              </button>
            ))}
          </div>
          {recentNotes.length > 0 && (
            <div className="content">
              <div className="notes-section-label">Recentes</div>
              <div className="notes-grid">
                {recentNotes.map(note => (
                  <NoteCard key={note.id} note={note} tags={tags} onOpen={openEdit} onTogglePin={n => void togglePin(n).then(() => void fetch({}))} />
                ))}
              </div>
            </div>
          )}
          {!loading && recentNotes.length === 0 && (
            <div className="empty-state" style={{ paddingTop: '20vh' }}>Nenhuma nota ainda — clique acima para criar</div>
          )}
        </div>
      )}

      {tab === 'Arquivos' && (
        <div className="notes-archive-layout">
          <div className="notes-sidebar">
            <FolderTree
              folders={folders}
              selectedId={filterFolder}
              onSelect={id => setFilterFolder(id)}
              onAdd={async (name, parentId) => { await saveFolder({ name, ...(parentId ? { parentId } : {}) }) }}
              onDelete={async id => { await removeFolder(id) }}
            />
          </div>
          <div className="notes-archive-main">
            <div className="notes-filter-bar">
              <input
                className="task-field-input"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar…"
                style={{ flex: 1 }}
              />
              <select className="task-field-select" value={filterType} onChange={e => setFilterType(e.target.value)}>
                <option value="">Todos os tipos</option>
                <option value="postit">Post-it</option>
                <option value="text">Texto</option>
                <option value="audio">Áudio</option>
                <option value="link">Link</option>
              </select>
              <select className="task-field-select" value={filterTag} onChange={e => setFilterTag(e.target.value)}>
                <option value="">Todas as tags</option>
                {tags.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            {loading && <div className="empty-state">Carregando…</div>}
            {!loading && notes.length === 0 && <div className="empty-state">Nenhuma nota encontrada</div>}
            {!loading && notes.length > 0 && (
              <div className="notes-grid" style={{ padding: '16px' }}>
                {notes.map(note => (
                  <NoteCard key={note.id} note={note} tags={tags} onOpen={openEdit} onTogglePin={n => void togglePin(n).then(() => void fetch({ ...(filterFolder ? { folder: filterFolder } : {}), ...(filterType ? { type: filterType } : {}), ...(filterTag ? { tag: filterTag } : {}) }))} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'Tags' && (
        <div className="content">
          <TagManager
            tags={tags}
            onSave={async input => { await saveTag(input) }}
            onDelete={async id => { await removeTag(id) }}
          />
        </div>
      )}

      {tab === 'Pastas' && (
        <div className="content">
          <FolderTree
            folders={folders}
            selectedId={null}
            onSelect={() => {}}
            onAdd={async (name, parentId) => { await saveFolder({ name, ...(parentId ? { parentId } : {}) }) }}
            onDelete={async id => { await removeFolder(id) }}
          />
        </div>
      )}

      {panelOpen && (
        <NotePanel
          note={selectedNote}
          initialType={initialType}
          tags={tags}
          folders={folders}
          onSave={handleSave}
          {...(selectedNote ? { onDelete: handleDelete } : {})}
          onClose={() => { setPanelOpen(false); setSelectedNote(null) }}
        />
      )}
    </div>
  )
}

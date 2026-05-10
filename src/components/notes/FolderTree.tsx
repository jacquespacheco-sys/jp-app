import { useState } from 'react'
import type { NoteFolder } from '../../types/domain.ts'

interface Props {
  folders: NoteFolder[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  onAdd: (name: string, parentId?: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

function FolderItem({ folder, folders, selectedId, onSelect, onAdd, onDelete, depth }: Props & { folder: NoteFolder; depth: number }) {
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const children = folders.filter(f => f.parentId === folder.id)

  return (
    <div style={{ paddingLeft: depth * 12 }}>
      <div className={`folder-row${selectedId === folder.id ? ' active' : ''}`}>
        <button className="folder-name" onClick={() => onSelect(folder.id)}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
          {folder.name}
        </button>
        <div className="folder-actions">
          <button onClick={() => setAdding(v => !v)} title="Subpasta" style={{ fontSize: '10px' }}>+</button>
          <button onClick={() => void onDelete(folder.id)} title="Excluir" style={{ fontSize: '10px' }}>×</button>
        </div>
      </div>
      {adding && (
        <div style={{ paddingLeft: (depth + 1) * 12, display: 'flex', gap: '4px', paddingBottom: '4px' }}>
          <input
            className="task-field-input"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="Nome da pasta"
            style={{ flex: 1, fontSize: '11px', padding: '4px 8px' }}
            autoFocus
            onKeyDown={e => { if (e.key === 'Enter') { void onAdd(newName, folder.id).then(() => { setAdding(false); setNewName('') }) } }}
          />
        </div>
      )}
      {children.map(child => (
        <FolderItem key={child.id} folder={child} folders={folders} selectedId={selectedId} onSelect={onSelect} onAdd={onAdd} onDelete={onDelete} depth={depth + 1} />
      ))}
    </div>
  )
}

export function FolderTree({ folders, selectedId, onSelect, onAdd, onDelete }: Props) {
  const [newName, setNewName] = useState('')
  const roots = folders.filter(f => !f.parentId)

  return (
    <div className="folder-tree">
      <button className={`folder-row folder-all${selectedId === null ? ' active' : ''}`} onClick={() => onSelect(null)}>
        Todas as notas
      </button>
      {roots.map(f => (
        <FolderItem key={f.id} folder={f} folders={folders} selectedId={selectedId} onSelect={onSelect} onAdd={onAdd} onDelete={onDelete} depth={0} />
      ))}
      <div className="folder-add">
        <input
          className="task-field-input"
          value={newName}
          onChange={e => setNewName(e.target.value)}
          placeholder="Nova pasta…"
          style={{ flex: 1, fontSize: '11px', padding: '4px 8px' }}
          onKeyDown={e => { if (e.key === 'Enter' && newName.trim()) { void onAdd(newName.trim()).then(() => setNewName('')) } }}
        />
        <button className="btn btn-ghost" style={{ fontSize: '10px', padding: '4px 8px' }} onClick={() => { if (newName.trim()) void onAdd(newName.trim()).then(() => setNewName('')) }}>+</button>
      </div>
    </div>
  )
}

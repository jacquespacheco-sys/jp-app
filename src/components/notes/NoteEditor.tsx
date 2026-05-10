import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { useEffect } from 'react'

interface Props {
  content: string
  onChange: (html: string) => void
  placeholder?: string
}

export function NoteEditor({ content, onChange, placeholder }: Props) {
  const editor = useEditor({
    extensions: [StarterKit],
    content,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  })

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      // emitUpdate: false to avoid triggering onChange and causing infinite loop
      editor.commands.setContent(content, { emitUpdate: false })
    }
  }, [content, editor])

  return (
    <div className="note-editor">
      {editor && (
        <div className="note-editor-toolbar">
          <button type="button" className={`note-toolbar-btn${editor.isActive('bold') ? ' active' : ''}`} onClick={() => editor.chain().focus().toggleBold().run()} title="Bold">B</button>
          <button type="button" className={`note-toolbar-btn italic${editor.isActive('italic') ? ' active' : ''}`} onClick={() => editor.chain().focus().toggleItalic().run()} title="Italic">I</button>
          <button type="button" className={`note-toolbar-btn${editor.isActive('heading', { level: 2 }) ? ' active' : ''}`} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} title="Heading">H2</button>
          <button type="button" className={`note-toolbar-btn${editor.isActive('heading', { level: 3 }) ? ' active' : ''}`} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} title="Subheading">H3</button>
          <button type="button" className={`note-toolbar-btn${editor.isActive('bulletList') ? ' active' : ''}`} onClick={() => editor.chain().focus().toggleBulletList().run()} title="Bullet list">•</button>
          <button type="button" className={`note-toolbar-btn${editor.isActive('orderedList') ? ' active' : ''}`} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Numbered list">1.</button>
          <button type="button" className={`note-toolbar-btn${editor.isActive('blockquote') ? ' active' : ''}`} onClick={() => editor.chain().focus().toggleBlockquote().run()} title="Quote">&ldquo;</button>
          <button type="button" className={`note-toolbar-btn${editor.isActive('code') ? ' active' : ''}`} onClick={() => editor.chain().focus().toggleCode().run()} title="Code">{'</>'}</button>
        </div>
      )}
      <EditorContent editor={editor} className="note-editor-content" data-placeholder={placeholder} />
    </div>
  )
}

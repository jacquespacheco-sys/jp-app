import { z } from 'zod'

export const NoteSaveSchema = z.object({
  id: z.string().uuid().optional(),
  folderId: z.string().uuid().nullable().optional(),
  type: z.enum(['postit', 'text', 'audio', 'link']),
  title: z.string().max(500).optional(),
  content: z.string(),
  url: z.string().max(2000).nullable().optional(),
  thumbnailUrl: z.string().max(2000).nullable().optional(),
  audioDuration: z.number().int().min(0).nullable().optional(),
  pinned: z.boolean().optional(),
  archived: z.boolean().optional(),
  tagIds: z.array(z.string().uuid()).optional(),
})
export type NoteSaveInput = z.infer<typeof NoteSaveSchema>

export const NoteTagSaveSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(50),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
})
export type NoteTagSaveInput = z.infer<typeof NoteTagSaveSchema>

export const NoteFolderSaveSchema = z.object({
  id: z.string().uuid().optional(),
  parentId: z.string().uuid().nullable().optional(),
  name: z.string().min(1).max(100),
})
export type NoteFolderSaveInput = z.infer<typeof NoteFolderSaveSchema>

export const NoteUploadSchema = z.object({
  noteId: z.string().uuid(),
  base64: z.string().min(1),
  contentType: z.string().default('audio/webm'),
})

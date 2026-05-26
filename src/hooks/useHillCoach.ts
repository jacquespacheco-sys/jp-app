import { useState, useRef, useCallback } from 'react'
import type { HillCoachMessage } from '../types/domain.ts'

interface SseEvent {
  type: string
  text?: string
  message?: string
  conversationId?: string
  userMsgId?: string
  coachMsgId?: string
  coachCreatedAt?: string
  action?: { type: string; payload: unknown } | null
}

export function useHillCoach() {
  const [messages, setMessages] = useState<HillCoachMessage[]>([])
  const [sending, setSending] = useState(false)
  const convRef = useRef<string | null>(null)

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || sending) return
    setSending(true)

    const tempUser = `temp-u-${Date.now()}`
    const tempCoach = `temp-c-${Date.now()}`
    const now = new Date().toISOString()
    const conv = convRef.current ?? ''
    setMessages(prev => [
      ...prev,
      { id: tempUser, conversationId: conv, mode: 'chat', role: 'user', content: trimmed, createdAt: now },
      { id: tempCoach, conversationId: conv, mode: 'chat', role: 'coach', content: '', createdAt: now },
    ])

    try {
      const res = await fetch('/api/hill-coach-chat', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'Accept': 'text/event-stream' },
        body: JSON.stringify({ message: trimmed, ...(convRef.current ? { conversationId: convRef.current } : {}) }),
      })
      if (!res.ok || !res.body) {
        setMessages(prev => prev.filter(m => m.id !== tempUser && m.id !== tempCoach))
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buf = ''
      let assembled = ''

      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const events = buf.split('\n\n')
        buf = events.pop() ?? ''
        for (const e of events) {
          const line = e.split('\n').find(l => l.startsWith('data: '))
          if (!line) continue
          try {
            const obj = JSON.parse(line.slice(6)) as SseEvent
            if (obj.type === 'start') {
              if (obj.conversationId) convRef.current = obj.conversationId
              if (obj.userMsgId) setMessages(prev => prev.map(m => m.id === tempUser ? { ...m, id: obj.userMsgId! } : m))
            } else if (obj.type === 'delta' && obj.text) {
              assembled += obj.text
              setMessages(prev => prev.map(m => m.id === tempCoach ? { ...m, content: assembled } : m))
            } else if (obj.type === 'done') {
              if (obj.conversationId) convRef.current = obj.conversationId
              setMessages(prev => prev.map(m => m.id === tempCoach
                ? { ...m, id: obj.coachMsgId ?? m.id, content: assembled, ...(obj.action ? { actionPayload: obj.action } : {}) }
                : m))
            }
          } catch { /* ignora evento malformado */ }
        }
      }

      setMessages(prev => prev.filter(m => !(m.id === tempCoach && !assembled)))
    } finally {
      setSending(false)
    }
  }, [sending])

  return { messages, sending, sendMessage }
}

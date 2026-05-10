import { useState, useRef } from 'react'

interface Props {
  onRecorded: (blob: Blob, durationSeconds: number) => void
}

export function AudioRecorder({ onRecorded }: Props) {
  const [recording, setRecording] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const mediaRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startTimeRef = useRef<number>(0)

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream)
      chunksRef.current = []
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      mr.start(100)
      mediaRef.current = mr
      startTimeRef.current = Date.now()
      setRecording(true)
      setSeconds(0)
      timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000)
    } catch {
      alert('Não foi possível acessar o microfone.')
    }
  }

  const stop = () => {
    if (!mediaRef.current) return
    const duration = Math.round((Date.now() - startTimeRef.current) / 1000)
    mediaRef.current.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
      onRecorded(blob, duration)
    }
    mediaRef.current.stop()
    mediaRef.current.stream.getTracks().forEach(t => t.stop())
    if (timerRef.current) clearInterval(timerRef.current)
    setRecording(false)
    setSeconds(0)
  }

  const fmt = (s: number) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`

  return (
    <div className="audio-recorder">
      {recording ? (
        <>
          <div className="audio-rec-indicator" />
          <span className="audio-rec-time">{fmt(seconds)}</span>
          <button className="btn btn-ghost" onClick={stop}>Parar</button>
        </>
      ) : (
        <button className="btn btn-accent" onClick={() => void start()}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8" stroke="currentColor" fill="none" strokeWidth="2"/>
          </svg>
          Gravar
        </button>
      )}
    </div>
  )
}

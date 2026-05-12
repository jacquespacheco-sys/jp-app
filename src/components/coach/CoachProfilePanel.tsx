import { useState, useEffect } from 'react'
import { useCoach } from '../../hooks/useCoach.ts'

export function CoachProfilePanel() {
  const { profile, saveProfile } = useCoach()
  const [form, setForm] = useState({
    name: 'Coach',
    tone: 'firme-mas-gentil',
    valuesMd: [] as string[],
    boundaries: '',
    northStarMd: '',
    morning: '',
    evening: '',
    emailMorning: true,
    emailEvening: false,
    weeklyDay: '' as '' | 'MO' | 'TU' | 'WE' | 'TH' | 'FR' | 'SA' | 'SU',
    weeklyTime: '',
    systemPromptOverride: '',
  })
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState('')

  useEffect(() => {
    if (!profile) return
    const sched = profile.checkInSchedule ?? {}
    setForm({
      name: profile.name ?? 'Coach',
      tone: profile.tone ?? 'firme-mas-gentil',
      valuesMd: profile.valuesMd ?? [],
      boundaries: profile.boundaries ?? '',
      northStarMd: profile.northStarMd ?? '',
      morning: sched.morning ?? '',
      evening: sched.evening ?? '',
      emailMorning: sched.emailMorning !== false,
      emailEvening: sched.emailEvening === true,
      weeklyDay: (sched.weeklyDay ?? '') as typeof form.weeklyDay,
      weeklyTime: sched.weeklyTime ?? '',
      systemPromptOverride: profile.systemPromptOverride ?? '',
    })
  }, [profile])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setStatus('')
    try {
      await saveProfile({
        name: form.name,
        tone: form.tone,
        valuesMd: form.valuesMd.filter(v => v.trim()),
        ...(form.boundaries ? { boundaries: form.boundaries } : {}),
        ...(form.northStarMd ? { northStarMd: form.northStarMd } : {}),
        ...(form.systemPromptOverride ? { systemPromptOverride: form.systemPromptOverride } : {}),
        checkInSchedule: {
          ...(form.morning ? { morning: form.morning } : {}),
          ...(form.evening ? { evening: form.evening } : {}),
          emailMorning: form.emailMorning,
          emailEvening: form.emailEvening,
          ...(form.weeklyDay ? { weeklyDay: form.weeklyDay } : {}),
          ...(form.weeklyTime ? { weeklyTime: form.weeklyTime } : {}),
        },
        h3Goals: [],
      })
      setStatus('salvo.')
    } catch (e) {
      setStatus(e instanceof Error ? e.message : 'erro ao salvar')
    } finally {
      setSaving(false)
      setTimeout(() => setStatus(''), 3000)
    }
  }

  const valuesText = form.valuesMd.join('\n')

  return (
    <form onSubmit={e => { void submit(e) }} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <span style={{ fontSize: '11px', color: 'var(--fg-dim)', textTransform: 'uppercase', letterSpacing: '1px' }}>nome do coach</span>
        <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
          style={{ padding: '8px 10px', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--bg)', color: 'var(--fg)' }} />
      </label>

      <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <span style={{ fontSize: '11px', color: 'var(--fg-dim)', textTransform: 'uppercase', letterSpacing: '1px' }}>tom</span>
        <input type="text" value={form.tone} onChange={e => setForm({ ...form, tone: e.target.value })}
          style={{ padding: '8px 10px', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--bg)', color: 'var(--fg)' }} />
      </label>

      <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <span style={{ fontSize: '11px', color: 'var(--fg-dim)', textTransform: 'uppercase', letterSpacing: '1px' }}>valores (um por linha)</span>
        <textarea rows={4} value={valuesText}
          onChange={e => setForm({ ...form, valuesMd: e.target.value.split('\n') })}
          style={{ padding: '8px 10px', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--bg)', color: 'var(--fg)', resize: 'vertical' }} />
      </label>

      <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <span style={{ fontSize: '11px', color: 'var(--fg-dim)', textTransform: 'uppercase', letterSpacing: '1px' }}>norte (north star)</span>
        <textarea rows={3} value={form.northStarMd}
          onChange={e => setForm({ ...form, northStarMd: e.target.value })}
          style={{ padding: '8px 10px', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--bg)', color: 'var(--fg)', resize: 'vertical' }} />
      </label>

      <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <span style={{ fontSize: '11px', color: 'var(--fg-dim)', textTransform: 'uppercase', letterSpacing: '1px' }}>limites</span>
        <textarea rows={2} value={form.boundaries}
          onChange={e => setForm({ ...form, boundaries: e.target.value })}
          style={{ padding: '8px 10px', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--bg)', color: 'var(--fg)', resize: 'vertical' }} />
      </label>

      <fieldset style={{ border: '1px solid var(--border-light)', padding: '12px', borderRadius: '6px' }}>
        <legend style={{ fontSize: '11px', color: 'var(--fg-dim)', textTransform: 'uppercase', letterSpacing: '1px', padding: '0 6px' }}>check-ins agendados</legend>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '10px' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '10px', color: 'var(--fg-dim)' }}>manhã (HH:MM)</span>
            <input type="time" value={form.morning} onChange={e => setForm({ ...form, morning: e.target.value })}
              style={{ padding: '6px 8px', border: '1px solid var(--border)', borderRadius: '4px', background: 'var(--bg)', color: 'var(--fg)' }} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '10px', color: 'var(--fg-dim)' }}>noite (HH:MM)</span>
            <input type="time" value={form.evening} onChange={e => setForm({ ...form, evening: e.target.value })}
              style={{ padding: '6px 8px', border: '1px solid var(--border)', borderRadius: '4px', background: 'var(--bg)', color: 'var(--fg)' }} />
          </label>
        </div>

        <div style={{ display: 'flex', gap: '16px', marginBottom: '10px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
            <input type="checkbox" checked={form.emailMorning} onChange={e => setForm({ ...form, emailMorning: e.target.checked })} />
            email manhã
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
            <input type="checkbox" checked={form.emailEvening} onChange={e => setForm({ ...form, emailEvening: e.target.checked })} />
            email noite
          </label>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '10px', color: 'var(--fg-dim)' }}>semanal — dia</span>
            <select value={form.weeklyDay} onChange={e => setForm({ ...form, weeklyDay: e.target.value as typeof form.weeklyDay })}
              style={{ padding: '6px 8px', border: '1px solid var(--border)', borderRadius: '4px', background: 'var(--bg)', color: 'var(--fg)' }}>
              <option value="">(nenhum)</option>
              <option value="MO">segunda</option>
              <option value="TU">terça</option>
              <option value="WE">quarta</option>
              <option value="TH">quinta</option>
              <option value="FR">sexta</option>
              <option value="SA">sábado</option>
              <option value="SU">domingo</option>
            </select>
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '10px', color: 'var(--fg-dim)' }}>semanal — hora</span>
            <input type="time" value={form.weeklyTime} onChange={e => setForm({ ...form, weeklyTime: e.target.value })}
              style={{ padding: '6px 8px', border: '1px solid var(--border)', borderRadius: '4px', background: 'var(--bg)', color: 'var(--fg)' }} />
          </label>
        </div>
      </fieldset>

      <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <span style={{ fontSize: '11px', color: 'var(--fg-dim)', textTransform: 'uppercase', letterSpacing: '1px' }}>system prompt override (avançado)</span>
        <textarea rows={4} value={form.systemPromptOverride}
          onChange={e => setForm({ ...form, systemPromptOverride: e.target.value })}
          placeholder="(vazio = usa o prompt padrão sócio sênior)"
          style={{ padding: '8px 10px', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--bg)', color: 'var(--fg)', resize: 'vertical', fontFamily: 'monospace', fontSize: '12px' }} />
      </label>

      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
        <button type="submit" disabled={saving}
          style={{ padding: '8px 16px', border: 'none', borderRadius: '6px', background: 'var(--accent)', color: 'var(--bg)', cursor: 'pointer', fontSize: '13px' }}>
          {saving ? 'salvando…' : 'salvar'}
        </button>
        {status && <span style={{ fontSize: '12px', color: 'var(--fg-dim)' }}>{status}</span>}
      </div>
    </form>
  )
}

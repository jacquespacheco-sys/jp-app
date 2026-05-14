import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Topbar } from '../components/layout/Topbar.tsx'
import { ThemeToggle } from '../components/common/ThemeToggle.tsx'
import { CategoryChip } from '../components/shared/CategoryChip.tsx'
import { useOnboardingQueue, type BulkClassifyUpdate } from '../hooks/useOnboardingQueue.ts'
import { useCategoryDimensions } from '../hooks/useCategoryDimensions.ts'
import { useCategories } from '../hooks/useCategories.ts'
import type { ContactTier } from '../types/domain.ts'

const TIER_BUTTONS: { tier: ContactTier; label: string; hint: string; color: string }[] = [
  { tier: 'inner',   label: 'Inner',   hint: 'família, sócios, top 5',     color: 'var(--chip-red-fg)' },
  { tier: 'strong',  label: 'Strong',  hint: 'ativos, contato regular',    color: 'var(--chip-orange-fg)' },
  { tier: 'network', label: 'Network', hint: 'conheço, esporádico',        color: 'var(--chip-yellow-fg)' },
  { tier: 'weak',    label: 'Weak',    hint: 'conheço pouco',              color: 'var(--fg-muted)' },
  { tier: 'dormant', label: 'Dormant', hint: 'fui próximo, sumiu',         color: 'var(--fg-dim)' },
]

const TIER_KEY: Record<string, ContactTier> = {
  '1': 'inner', '2': 'strong', '3': 'network', '4': 'weak', '5': 'dormant',
}

export function ContactsOnboardingPage() {
  const navigate = useNavigate()
  const { current, index, total, totalRemaining, counts, loading, done, classify, skip, prev } = useOnboardingQueue()
  const { dimensions } = useCategoryDimensions()
  const { categories, byDimension } = useCategories()

  const [hookText, setHookText] = useState('')
  const [tierChoice, setTierChoice] = useState<ContactTier | null>(null)
  const [selectedCatIds, setSelectedCatIds] = useState<Set<string>>(new Set())
  const [showExtra, setShowExtra] = useState(false)
  const [linkedinUrl, setLinkedinUrl] = useState('')
  const [cadenceDays, setCadenceDays] = useState('')
  const [preferredChannel, setPreferredChannel] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setTierChoice(null)
    setHookText('')
    setSelectedCatIds(new Set())
    setShowExtra(false)
    setLinkedinUrl('')
    setCadenceDays('')
    setPreferredChannel('')
  }, [current?.id])

  const handleSave = useCallback(async () => {
    if (!current) return
    const update: BulkClassifyUpdate = { id: current.id }
    if (tierChoice) update.tier = tierChoice
    else if (current.suggestedTier) update.tier = current.suggestedTier
    if (hookText.trim()) update.addHook = hookText.trim()
    if (linkedinUrl.trim()) update.linkedinUrl = linkedinUrl.trim()
    if (cadenceDays.trim()) {
      const n = parseInt(cadenceDays, 10)
      if (n > 0) update.cadenceDays = n
    }
    if (preferredChannel === 'whatsapp' || preferredChannel === 'email' || preferredChannel === 'linkedin' || preferredChannel === 'sms' || preferredChannel === 'phone') {
      update.preferredChannel = preferredChannel
    }
    if (selectedCatIds.size > 0) update.categoryIds = [...selectedCatIds]

    setSaving(true)
    try {
      await classify(update, true)
    } finally {
      setSaving(false)
    }
  }, [current, tierChoice, hookText, linkedinUrl, cadenceDays, preferredChannel, selectedCatIds, classify])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (TIER_KEY[e.key]) {
        setTierChoice(TIER_KEY[e.key] ?? null)
        e.preventDefault()
      } else if (e.key === 'ArrowRight' || e.key === 'Enter') {
        e.preventDefault()
        if (!saving) void handleSave()
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        prev()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleSave, prev, saving])

  const actions = (
    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
      <button className="btn btn-ghost" style={{ fontSize: '10px' }} onClick={() => navigate('/contacts')}>
        Sair
      </button>
      <ThemeToggle />
    </div>
  )

  if (loading) {
    return (
      <div>
        <Topbar title="Classificação Carnegie" actions={actions} />
        <div className="empty-state" style={{ paddingTop: '20vh' }}>Carregando fila…</div>
      </div>
    )
  }

  if (done || !current) {
    return (
      <div>
        <Topbar title="Classificação Carnegie" actions={actions} />
        <div className="content" style={{ padding: '32px 16px', textAlign: 'center' }}>
          <div style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: '32px', letterSpacing: '3px', marginBottom: '12px' }}>
            Fila concluída
          </div>
          <div style={{ fontSize: '13px', color: 'var(--fg-muted)', marginBottom: '20px' }}>
            Inner: {counts.inner} · Strong: {counts.strong} · Network: {counts.network} · Weak: {counts.weak} · Dormant: {counts.dormant}
          </div>
          {totalRemaining > total && (
            <div style={{ fontSize: '11px', color: 'var(--fg-dim)', marginBottom: '20px' }}>
              Ainda restam {totalRemaining - total} contatos. Volte depois pelo Config.
            </div>
          )}
          <button className="btn btn-accent" onClick={() => navigate('/contacts')}>
            Ir para o Pulso
          </button>
        </div>
      </div>
    )
  }

  const innerOverLimit = counts.inner > 5
  const innerAtLimit = counts.inner === 5

  return (
    <div>
      <Topbar title="Classificação Carnegie" actions={actions} />

      {/* Sticky progress + Dunbar */}
      <div style={{
        position: 'sticky', top: '56px', zIndex: 10,
        background: 'var(--bg)', borderBottom: '1px solid var(--border)',
        padding: '12px 16px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <div style={{ fontFamily: 'Space Mono, monospace', fontSize: '10px', color: 'var(--fg-muted)', letterSpacing: '1.5px', textTransform: 'uppercase' }}>
            {index + 1} de {total} · {totalRemaining - index} restando
          </div>
          <div style={{ display: 'flex', gap: '8px', fontFamily: 'Space Mono, monospace', fontSize: '9px', letterSpacing: '1px', textTransform: 'uppercase' }}>
            <span style={{ color: innerOverLimit ? 'var(--danger)' : innerAtLimit ? 'var(--chip-orange-fg)' : 'var(--fg-muted)' }}>
              Inner {counts.inner}/5
            </span>
            <span style={{ color: 'var(--fg-muted)' }}>Strong {counts.strong}/50</span>
            <span style={{ color: 'var(--fg-dim)' }}>Net {counts.network}/150</span>
          </div>
        </div>
        <div style={{ height: '2px', background: 'var(--border)' }}>
          <div style={{
            height: '100%',
            width: `${Math.round(((index) / Math.max(1, total)) * 100)}%`,
            background: 'var(--accent)',
            transition: 'width 0.2s',
          }} />
        </div>
      </div>

      <div className="content" style={{ padding: '20px 16px', maxWidth: '540px', margin: '0 auto' }}>
        <div style={{ border: '1px solid var(--border)', padding: '20px', background: 'var(--bg-elevated)' }}>
          {/* Identity */}
          <div style={{ marginBottom: '14px' }}>
            <div style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: '24px', letterSpacing: '2px', marginBottom: '2px' }}>
              {current.firstName}{current.lastName ? ` ${current.lastName}` : ''}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--fg-muted)' }}>
              {[current.role, current.company].filter(Boolean).join(' · ') || '—'}
            </div>
          </div>

          {/* Context */}
          <div style={{ fontFamily: 'Space Mono, monospace', fontSize: '10px', color: 'var(--fg-muted)', letterSpacing: '1px', marginBottom: '14px' }}>
            {current.lastInteractionAt
              ? `Última: ${new Date(current.lastInteractionAt).toLocaleDateString('pt-BR')}`
              : 'Sem interação registrada'}
            {' · '}
            {current.interactionCount}× últimos 12m
            {current.tier ? ` · tier atual: ${current.tier}` : ''}
          </div>

          {/* Suggestion */}
          {current.suggestedTier && !tierChoice && (
            <div style={{ fontSize: '11px', color: 'var(--fg-muted)', padding: '8px 10px', background: 'var(--accent-faint)', border: '1px solid var(--accent-soft)', marginBottom: '16px', fontFamily: 'Space Mono, monospace', letterSpacing: '1px' }}>
              Sugerido: <strong style={{ color: 'var(--accent-ink)' }}>{current.suggestedTier.toUpperCase()}</strong>
            </div>
          )}

          {/* Q1: Tier */}
          <Label>Tier (atalho: 1-5)</Label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px', marginBottom: '18px' }}>
            {TIER_BUTTONS.map((t, idx) => (
              <button
                key={t.tier}
                onClick={() => setTierChoice(t.tier)}
                style={{
                  padding: '12px 4px',
                  background: tierChoice === t.tier ? 'var(--accent)' : 'var(--bg)',
                  color: tierChoice === t.tier ? 'var(--accent-ink)' : t.color,
                  border: `1px solid ${tierChoice === t.tier ? 'var(--accent)' : 'var(--border)'}`,
                  cursor: 'pointer',
                  fontFamily: 'Space Mono, monospace',
                  fontSize: '10px',
                  letterSpacing: '1px',
                  textTransform: 'uppercase',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
                }}
                title={t.hint}
              >
                <span style={{ fontSize: '14px', fontFamily: 'Bebas Neue, sans-serif', letterSpacing: '2px' }}>
                  {idx + 1}
                </span>
                {t.label}
              </button>
            ))}
          </div>

          {/* Q2: Hook */}
          <Label>Hook de conversa {(tierChoice === 'inner' || tierChoice === 'strong') ? '(recomendado)' : '(opcional)'}</Label>
          <textarea
            className="task-panel-notes"
            value={hookText}
            onChange={e => setHookText(e.target.value)}
            placeholder="Ex: Helena (filha) entrou em Letras na USP em fev/26"
            style={{ minHeight: '60px', marginBottom: '6px' }}
          />
          {current.conversationHooks.length > 0 && (
            <div style={{ fontSize: '10px', color: 'var(--fg-dim)', marginBottom: '14px', fontStyle: 'italic' }}>
              Atuais: {current.conversationHooks.join(' · ')}
            </div>
          )}

          {/* Q3: Extras */}
          <button
            className="btn btn-ghost"
            style={{ fontSize: '10px', marginBottom: '12px' }}
            onClick={() => setShowExtra(v => !v)}
          >
            {showExtra ? '− Esconder extras' : '+ Algo mais?'}
          </button>
          {showExtra && (
            <div style={{ padding: '12px', border: '1px solid var(--border-light)', marginBottom: '14px' }}>
              <Label>Canal preferido</Label>
              <select className="input" value={preferredChannel} onChange={e => setPreferredChannel(e.target.value)} style={{ marginBottom: '10px' }}>
                <option value="">—</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="email">Email</option>
                <option value="linkedin">LinkedIn</option>
                <option value="sms">SMS</option>
                <option value="phone">Telefone</option>
              </select>
              <Label>LinkedIn URL</Label>
              <input className="input" type="url" value={linkedinUrl} onChange={e => setLinkedinUrl(e.target.value)} placeholder="https://linkedin.com/in/…" style={{ marginBottom: '10px' }} />
              <Label>Cadência custom (dias)</Label>
              <input className="input" type="number" min="1" value={cadenceDays} onChange={e => setCadenceDays(e.target.value)} placeholder="default = tier" />
            </div>
          )}

          {/* Q4: Categorias (PR8) */}
          {categories.length > 0 && (
            <div style={{ marginBottom: '14px' }}>
              <Label>Categorias (opcional)</Label>
              {dimensions.map(dim => {
                const opts = byDimension(dim.id)
                if (opts.length === 0) return null
                return (
                  <div key={dim.id} style={{ marginBottom: '8px' }}>
                    <div style={{ fontFamily: 'Space Mono, monospace', fontSize: '9px', color: 'var(--fg-muted)', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '4px' }}>
                      {dim.label}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                      {opts.map(c => (
                        <button
                          key={c.id}
                          onClick={() => {
                            setSelectedCatIds(prev => {
                              const next = new Set(prev)
                              if (next.has(c.id)) next.delete(c.id); else next.add(c.id)
                              return next
                            })
                          }}
                          style={{
                            background: 'transparent', border: 'none', padding: 0, cursor: 'pointer',
                            opacity: selectedCatIds.has(c.id) ? 1 : 0.5,
                          }}
                        >
                          <CategoryChip category={c} size="sm" />
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
          <button className="btn btn-ghost" onClick={prev} disabled={index === 0}>
            ← Anterior
          </button>
          <button className="btn btn-ghost" onClick={skip} style={{ flex: 1 }}>
            Pular essa pessoa
          </button>
          <button
            className="btn btn-accent"
            onClick={() => { void handleSave() }}
            disabled={saving}
            style={{ flex: 1, justifyContent: 'center' }}
          >
            {saving ? 'Salvando…' : 'Salvar e próximo →'}
          </button>
        </div>

        <div style={{ marginTop: '20px', fontSize: '9px', color: 'var(--fg-dim)', fontFamily: 'Space Mono, monospace', letterSpacing: '1px', textAlign: 'center' }}>
          Atalhos: 1-5 tier · ← anterior · → / enter salvar
        </div>
      </div>
    </div>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="task-panel-notes-label" style={{ display: 'block', marginTop: 0 }}>
      {children}
    </label>
  )
}

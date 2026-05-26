import { useState, useEffect, useCallback } from 'react'
import { api } from '../api.ts'
import type { ChiefAim, Affirmation, RitualStats } from '../types/domain.ts'
import type {
  ChiefAimResponse, AffirmationsListResponse, RitualStatsResponse,
  AffirmationsWizardResponse,
} from '../types/api.ts'
import type {
  ChiefAimCreateInput, ChiefAimPatchInput, AffirmationWizardInput,
} from '../../api/_schemas/hill.ts'

export function useHill() {
  const [chiefAim, setChiefAim] = useState<ChiefAim | null>(null)
  const [affirmations, setAffirmations] = useState<Affirmation[]>([])
  const [ritualStats, setRitualStats] = useState<RitualStats | null>(null)
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    try {
      const [aimRes, affRes, statsRes] = await Promise.all([
        api.get<ChiefAimResponse>('/api/hill-chief-aim'),
        api.get<AffirmationsListResponse>('/api/hill-affirmations-list'),
        api.get<RitualStatsResponse>('/api/hill-rituals-stats?days=30'),
      ])
      setChiefAim(aimRes.chiefAim)
      setAffirmations(affRes.affirmations)
      setRitualStats(statsRes.stats)
    } catch {
      // mantém defaults; tela mostra estado vazio
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void fetch() }, [fetch])

  const saveChiefAim = useCallback(async (input: ChiefAimCreateInput): Promise<ChiefAim> => {
    const res = await api.post<ChiefAimResponse>('/api/hill-chief-aim', input)
    setChiefAim(res.chiefAim)
    return res.chiefAim as ChiefAim
  }, [])

  const updateChiefAimMeta = useCallback(async (input: ChiefAimPatchInput): Promise<ChiefAim> => {
    const res = await api.patch<ChiefAimResponse>('/api/hill-chief-aim', input)
    setChiefAim(res.chiefAim)
    return res.chiefAim as ChiefAim
  }, [])

  const runWizard = useCallback(async (input: AffirmationWizardInput): Promise<Affirmation[]> => {
    const res = await api.post<AffirmationsWizardResponse>('/api/hill-affirmations-wizard', input)
    setAffirmations(res.affirmations)
    return res.affirmations
  }, [])

  return {
    chiefAim, affirmations, ritualStats, loading,
    saveChiefAim, updateChiefAimMeta, runWizard, refetch: fetch,
  }
}

import { useState, useEffect, useCallback } from 'react'
import { api } from '../api.ts'
import type { Referral, ReferralStatus } from '../types/domain.ts'
import type { ReferralsListResponse, ReferralSaveResponse } from '../types/api.ts'
import type { ReferralSaveInput, ReferralStatusUpdateInput } from '../../api/_schemas/referral.ts'

interface UseReferralsOpts {
  status?: ReferralStatus
  pendingFeedback?: boolean
}

export function useReferrals(opts: UseReferralsOpts = {}) {
  const [referrals, setReferrals] = useState<Referral[]>([])
  const [loading, setLoading] = useState(true)
  const { status, pendingFeedback } = opts

  const fetch = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (status) params.set('status', status)
      if (pendingFeedback) params.set('pendingFeedback', 'true')
      const qs = params.toString() ? `?${params}` : ''
      const res = await api.get<ReferralsListResponse>(`/api/referrals-list${qs}`)
      setReferrals(res.referrals)
    } catch {
      setReferrals([])
    } finally {
      setLoading(false)
    }
  }, [status, pendingFeedback])

  useEffect(() => { void fetch() }, [fetch])

  const save = useCallback(async (input: ReferralSaveInput): Promise<Referral> => {
    const res = await api.post<ReferralSaveResponse>('/api/referrals-save', input)
    setReferrals(prev => input.id
      ? prev.map(r => r.id === res.referral.id ? res.referral : r)
      : [res.referral, ...prev]
    )
    return res.referral
  }, [])

  const updateStatus = useCallback(async (input: ReferralStatusUpdateInput): Promise<Referral> => {
    const res = await api.post<ReferralSaveResponse>('/api/referrals-status', input)
    setReferrals(prev => prev.map(r => r.id === res.referral.id ? res.referral : r))
    return res.referral
  }, [])

  return { referrals, loading, save, updateStatus, refetch: fetch }
}

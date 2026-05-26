import type { Affirmation } from '../../types/domain.ts'
import { AFFIRMATION_DIMENSION_LABELS } from '../../types/domain.ts'
import { BeliefDots } from './BeliefDots.tsx'

interface AffirmationCardProps {
  affirmation: Affirmation
  showBelief?: boolean
}

export function AffirmationCard({ affirmation, showBelief = true }: AffirmationCardProps) {
  return (
    <div className="hill-affirmation">
      <div className="hill-affirmation-dim">
        {AFFIRMATION_DIMENSION_LABELS[affirmation.dimension]}
      </div>
      <div className="hill-affirmation-text">“{affirmation.text}”</div>
      {showBelief && (
        <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <BeliefDots score={affirmation.beliefScore} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '1px', color: 'var(--fg-muted)' }}>
            crença {affirmation.beliefScore}/5
          </span>
        </div>
      )}
    </div>
  )
}

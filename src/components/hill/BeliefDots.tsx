interface BeliefDotsProps {
  score: number
  onChange?: (score: number) => void
}

export function BeliefDots({ score, onChange }: BeliefDotsProps) {
  const interactive = typeof onChange === 'function'
  return (
    <span className="belief-dots" aria-label={`crença ${score} de 5`}>
      {[1, 2, 3, 4, 5].map(i => (
        interactive ? (
          <button
            key={i}
            type="button"
            onClick={() => onChange?.(i)}
            className={`belief-dot${i <= score ? ' filled' : ''}`}
            style={{ padding: 0, cursor: 'pointer' }}
            aria-label={`crença ${i}`}
          />
        ) : (
          <span key={i} className={`belief-dot${i <= score ? ' filled' : ''}`} />
        )
      ))}
    </span>
  )
}

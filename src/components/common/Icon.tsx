import type { CSSProperties } from 'react'

interface Props {
  size?: number
  style?: CSSProperties
}

const SVG_PROPS = {
  fill: 'none' as const,
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

function Wrap({ size = 14, style, children }: Props & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      {...SVG_PROPS}
      style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...style }}
    >
      {children}
    </svg>
  )
}

export function IconCalendar(p: Props) {
  return (
    <Wrap {...p}>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </Wrap>
  )
}

export function IconClock(p: Props) {
  return (
    <Wrap {...p}>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </Wrap>
  )
}

export function IconPause(p: Props) {
  return (
    <Wrap {...p}>
      <rect x="6" y="4" width="4" height="16" />
      <rect x="14" y="4" width="4" height="16" />
    </Wrap>
  )
}

export function IconRepeat(p: Props) {
  return (
    <Wrap {...p}>
      <polyline points="17 1 21 5 17 9" />
      <path d="M3 11V9a4 4 0 0 1 4-4h14" />
      <polyline points="7 23 3 19 7 15" />
      <path d="M21 13v2a4 4 0 0 1-4 4H3" />
    </Wrap>
  )
}

export function IconSparkle(p: Props) {
  return (
    <Wrap {...p}>
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.5 5.5l2 2M16.5 16.5l2 2M5.5 18.5l2-2M16.5 7.5l2-2" />
    </Wrap>
  )
}

export function IconInbox(p: Props) {
  return (
    <Wrap {...p}>
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
      <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </Wrap>
  )
}

export function IconTrash(p: Props) {
  return (
    <Wrap {...p}>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </Wrap>
  )
}

export function IconArrowRight(p: Props) {
  return (
    <Wrap {...p}>
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </Wrap>
  )
}

export function IconPlus(p: Props) {
  return (
    <Wrap {...p}>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </Wrap>
  )
}

export function IconBolt(p: Props) {
  return (
    <Wrap {...p}>
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </Wrap>
  )
}

export function IconCircle(p: Props) {
  return (
    <Wrap {...p}>
      <circle cx="12" cy="12" r="10" />
    </Wrap>
  )
}

export function IconCircleFilled({ size = 14, style }: Props) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24"
      style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...style }}
    >
      <circle cx="12" cy="12" r="10" fill="currentColor" />
    </svg>
  )
}

export function EnergyDots({ value, max = 5, size = 4 }: { value: number; max?: number; size?: number }) {
  return (
    <span style={{ display: 'inline-flex', gap: '2px', alignItems: 'center' }}>
      {Array.from({ length: max }, (_, i) => (
        <span
          key={i}
          style={{
            width: `${size + 1}px`,
            height: `${size + 1}px`,
            borderRadius: '50%',
            background: i < value ? 'currentColor' : 'transparent',
            border: i < value ? 'none' : '1px solid currentColor',
            opacity: i < value ? 1 : 0.3,
          }}
        />
      ))}
    </span>
  )
}
